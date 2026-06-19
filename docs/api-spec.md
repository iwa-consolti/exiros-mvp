# API Spec — Exiros On-Route Tracker (MVP)

> **Bloque 0.3.** Contrato de la API. Deriva de la Functional Spec (casos de uso, reglas, validaciones), la Database Spec (entidades) y ADR-007 (auth). Un front podría mockear la API solo con este doc.
> Si un endpoint cambia, se cambia **aquí primero** (regla dura: no cambiar API sin actualizar API Spec).

---

## 1. Convenciones

- **Base URL:** `/api`. Dos espacios de rutas (ADR-007): **`/api/web/*`** (Guard JWT) y **`/api/mobile/*`** (Guard tripToken o bootstrap, ver §2).
- **Formato:** JSON UTF-8. Fechas en **ISO 8601 UTC** (`2026-06-18T15:00:00Z`).
- **Error (formato único, de PLAN §8):**
  ```json
  { "error": "BadRequest", "message": "Texto en español para humanos", "details": { "campo": "motivo" } }
  ```
- **Códigos:** `200` OK · `201` creado · `400` validación · `401` sin/credencial inválida · `403` sin permiso · `404` no existe · `409` conflicto de estado · `413` payload muy grande · `429` rate-limit.
- **Paginación (listados web):** `?page=1&pageSize=50` → `{ data: [...], total, page, pageSize }`.

---

## 2. Seguridad por espacio de rutas (recap ADR-007)

| Espacio | Quién | Cómo se autentica |
| :-- | :-- | :-- |
| `/api/web/*` | Monitorista/Admin | **JWT** en `Authorization: Bearer <jwt>`. Rol verificado por Guard. |
| `/api/mobile/*` ingesta y cierre | App, viaje ya creado | **tripToken** en `Authorization: Bearer <tripToken>`. |
| `/api/mobile/*` **bootstrap** (leer destinos, crear viaje) | App, aún sin token | **`X-App-Key`** (clave estática de la app) + rate-limit. |

> **Debilidad honesta del bootstrap:** `X-App-Key` viaja embebida en el APK → es **extraíble** por un atacante decidido. Eleva la barrera frente a scripts triviales, no frente a un atacante serio. La defensa fuerte (Play Integrity / device attestation) es **upgrade path post-MVP** (ADR-007). Las capas que sí aguantan en MVP: rate-limit por IP (Cloudflare), validación estricta y que el `tripToken` (lo que de verdad importa: la ingesta) sí está bien protegido.

### 2.1 Por qué DOS espacios separados (web vs móvil)
No es duplicación gratuita: es un **borde de seguridad**. Un mismo recurso (ej. destinos) se expone por **dos puertas con candados distintos** — `GET /api/web/destinations` (JWT, staff) y `GET /api/mobile/destinations` (X-App-Key, app pública). Beneficios: (1) **auth y rate-limit distintos** por tipo de cliente (confiable vs hostil); (2) menor **superficie de ataque** (el mundo móvil nunca ve gestión de usuarios); (3) **auditoría** separada del tráfico.
> **Regla anti-duplicación:** ambos espacios comparten el **mismo Service** (reglas de negocio); lo que difiere es solo el **Guard de entrada** y el **DTO de salida**. NO se duplica lógica de negocio (anti-patrón "dos implementaciones de lo mismo").

### 2.2 Matriz de permisos (roles web)
ADMIN es **superset** de MONITOR (Functional Spec §2). "autenticado" en las tablas siguientes = cualquiera de los dos roles.

| Recurso / acción | MONITOR | ADMIN |
| :-- | :--: | :--: |
| Login, ver perfil propio | ✓ | ✓ |
| Ver viajes (lista, activos, detalle) | ✓ | ✓ |
| Forzar cierre de viaje (CU-06) | ✓ | ✓ |
| Exportar reporte .xlsx | ✓ | ✓ |
| **Leer** destinos | ✓ | ✓ |
| **Crear/editar/baja** destinos (CU-08) | ✗ | ✓ |
| **Gestionar** usuarios (alta/baja, CU-09) | ✗ | ✓ |

> En las tablas §3.x, las filas marcadas "ADMIN" son los permisos **exclusivos** del admin; todo lo marcado "autenticado" lo puede hacer también el admin por ser superset.

---

## 3. Endpoints WEB (`/api/web/*`, Guard JWT)

### 3.1 Auth
| Método | Ruta | Rol | Descripción |
| :-- | :-- | :-- | :-- |
| POST | `/api/web/auth/login` | público | email+password → JWT |
| GET | `/api/web/auth/me` | autenticado | perfil del usuario actual |

`POST /api/web/auth/login`
```json
// request
{ "email": "ana@exiros.com", "password": "••••••" }
// 200
{ "accessToken": "eyJ...", "user": { "id": "u1", "name": "Ana", "role": "MONITOR" } }
// 401 → mensaje genérico, sin filtrar si el email existe (Functional §7)
```

### 3.2 Usuarios (solo ADMIN)
| Método | Ruta | Descripción |
| :-- | :-- | :-- |
| POST | `/api/web/users` | alta de monitorista/admin |
| GET | `/api/web/users` | listar |
| PATCH | `/api/web/users/:id` | editar / **baja** (`isActive:false`, soft delete) |

`POST /api/web/users` → request `{ email, name, password, role }`; `201` devuelve el user sin `passwordHash`.

### 3.3 Destinos / geocercas (CRUD, solo ADMIN escribe)
| Método | Ruta | Rol | Descripción |
| :-- | :-- | :-- | :-- |
| POST | `/api/web/destinations` | ADMIN | crear destino + geocerca |
| GET | `/api/web/destinations` | autenticado | listar (`?active=true`) |
| GET | `/api/web/destinations/:id` | autenticado | detalle |
| PATCH | `/api/web/destinations/:id` | ADMIN | editar centro/radio / **baja** (`isActive:false`) |

`POST /api/web/destinations`
```json
// request
{ "name": "Patio Monterrey", "centerLat": 25.6866, "centerLng": -100.3161, "radiusMeters": 250 }
// 201
{ "id": "d1", "name": "Patio Monterrey", "centerLat": 25.6866, "centerLng": -100.3161, "radiusMeters": 250, "isActive": true }
```

### 3.4 Viajes (monitoreo y cierre)
| Método | Ruta | Rol | Descripción |
| :-- | :-- | :-- | :-- |
| GET | `/api/web/trips` | autenticado | listado con filtros `?status=&destinationId=&from=&to=` (alimenta tabla/reporte) |
| GET | `/api/web/trips/active` | autenticado | viajes `EN_RUTA` + su **último punto** (alimenta el mapa, refresco 15–20 min) |
| GET | `/api/web/trips/:id` | autenticado | detalle: campos, foto, observaciones y **ruta** (puntos) |
| POST | `/api/web/trips/:id/close` | autenticado | **cierre forzado por admin/monitorista** (observación obligatoria) |

`POST /api/web/trips/:id/close`
```json
// request
{ "observations": "Camión averiado, cierre administrativo." }   // obligatorio (RN, CU-06)
// 200 → closureType = MANUAL_ADMIN, closedById = usuario actual, endedAt = ahora
// 409 si el viaje ya está CONCLUIDO (terminal)
```

### 3.5 Reportes
| Método | Ruta | Descripción |
| :-- | :-- | :-- |
| GET | `/api/web/reports/export` | descarga **.xlsx** con las **13 columnas exactas** (RN-07). Filtros `?from=&to=&status=&destinationId=` |

Respuesta: `200` con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (binario). Columnas, en orden: ID de Viaje · Núm. de Proveedor · Nombre de Proveedor · Folio/Remito · Placa Delantera · Placa Trasera · Destino · Fecha/Hora Inicio · Fecha/Hora Fin · Duración Total (HH:MM) · Estatus · Tipo de Cierre · Observaciones.

---

## 4. Endpoints MÓVIL (`/api/mobile/*`)

### 4.1 Bootstrap (X-App-Key + rate-limit)
| Método | Ruta | Descripción |
| :-- | :-- | :-- |
| GET | `/api/mobile/destinations` | catálogo activo para el dropdown (RN-09). Si vacío → `[]` (la app muestra estado vacío, RN-14) |
| POST | `/api/mobile/trips` | **crea viaje + emite tripToken** (CU-01) |

`POST /api/mobile/trips` — **multipart/form-data** (7 campos + foto en un solo request, S-04):
```
Campos: providerNumber, providerName, folio, frontPlate, rearPlate?, destinationId, deviceId
Archivo: photo (jpg/png, 1 archivo, validar tamaño/tipo)
```
```json
// 201 — el tripToken se devuelve UNA sola vez (en BD solo vive su hash)
{
  "tripId": "t1",
  "tripToken": "trk_live_9f3a...",   // guardar en el dispositivo; se envía en cada lote
  "status": "EN_RUTA",
  "startedAt": "2026-06-18T15:00:00Z"
}
// 400 validación de campos (§6 Functional) · 409 si ya hay un viaje EN_RUTA en ese deviceId (RN-11)
```

### 4.2 Ingesta de ubicaciones (Guard tripToken)
`POST /api/mobile/trips/:id/locations`
```
Headers: Authorization: Bearer <tripToken> · Content-Type: application/json · Content-Encoding: gzip
```
```json
// request (GZIP)
{
  "batchId": "b-uuid-123",            // idempotencia (ADR-007 #9)
  "points": [
    { "lat": 25.71, "lng": -100.30, "recordedAt": "2026-06-18T15:18:00Z" },
    { "lat": 25.69, "lng": -100.31, "recordedAt": "2026-06-18T15:36:00Z" }
  ]
}
// 200
{
  "accepted": 2,
  "duplicateBatch": false,
  "trip": { "status": "CONCLUIDO", "stopTracking": true }  // si entró a geocerca o admin cerró → la app detiene GPS (CU-04)
}
```
Reglas:
- **Idempotencia:** si `(tripId, batchId)` ya existe → `accepted:0, duplicateBatch:true` (no error).
- **Viaje ya CONCLUIDO:** `200`, puntos **descartados** silenciosamente, `stopTracking:true` (S-05).
- **Cada punto** pasa validación §5; los inválidos se rechazan (lote válido se acepta parcial, se reporta `accepted`).

### 4.3 Cierre por operador (Guard tripToken)
`POST /api/mobile/trips/:id/close`
```json
// request
{ "observations": "Entrega cancelada por el cliente." }   // obligatorio (CU-05)
// 200 → closureType = MANUAL_OPERATOR, endedAt = ahora, stopTracking implícito
// 409 si ya CONCLUIDO
```

---

## 5. Validaciones compartidas de ingesta (capa de seguridad, ADR-007)

| Regla | Detalle | Si falla |
| :-- | :-- | :-- |
| `lat` / `lng` en rango | lat ∈ [-90,90], lng ∈ [-180,180] **y bbox MX de cordura** (lat ~14–33, lng ~ -119 a -86) | punto rechazado |
| `recordedAt` **no futuro** | ≤ ahora + 2 min de tolerancia de reloj | punto rechazado |
| **NO** filtrar "fuera de geocerca" | toda la ruta vive fuera de la geocerca | — (no validar) |
| Tamaño de lote | máx. N puntos por lote (ej. 500) | `413` |
| Tamaño de body / GZIP | tope al descomprimir (anti zip-bomb) | `413` |
| Campos desconocidos | `whitelist` + `forbidNonWhitelisted` | `400` |
| Rate-limit | por tripToken (ingesta) y por IP (bootstrap) | `429` |

---

## 6. Notas
- **Mapa web:** el front hace **polling** a `GET /api/web/trips/active` cada 15–20 min (no hay websockets en MVP, RN-12 / H7).
- **La app conoce el cierre** (geocerca o admin) por la respuesta de `POST .../locations` (`stopTracking`), no por un endpoint aparte → menos llamadas, coherente con interacción mínima (RN-13).
- **Bala trazadora (Slice 0):** usará un endpoint desechable y hardcodeado, NO este contrato; este spec es el objetivo al que converge la implementación.
- **OpenAPI:** formalizado en [`openapi.yaml`](openapi.yaml) (3.0.3, válido) como **puente** para alinear/generar el front antes de que exista el backend. Este `.md` sigue siendo la fuente narrativa; cuando exista el backend NestJS, `@nestjs/swagger` autogenera el OpenAPI desde el código y ese pasa a ser la fuente de verdad (este `.yaml` se descarta para no mantener dos contratos).
