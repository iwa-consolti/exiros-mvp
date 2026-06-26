# API Spec — Exiros On-Route Tracker (MVP)

> **Bloque 0.3.** Contrato de la API. Deriva de la Functional Spec (casos de uso, reglas, validaciones), la Database Spec (entidades) y ADR-007 (auth). Un front podría mockear la API solo con este doc.
> Si un endpoint cambia, se cambia **aquí primero** (regla dura: no cambiar API sin actualizar API Spec).
> **Fuente normativa = `openapi/openapi.yaml`** (contrato verificable por máquina). Este doc es la narrativa que lo explica; ante discrepancia, gana el openapi. (Cierra D-A.)

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

> **Debilidad honesta del bootstrap:** `X-App-Key` viaja embebida en el APK → es **extraíble** por un atacante decidido. Eleva la barrera frente a scripts triviales, no frente a un atacante serio (su comparación es en tiempo constante, pero la clave es extraíble). La defensa fuerte (Play Integrity / device attestation) es **upgrade path post-MVP** (ADR-007). Las capas que sí aguantan en MVP: **rate-limit por IP real** (`ProxyThrottlerGuard`, `TRUST_PROXY_IP=true` tras cloudflared), validación estricta y que el `tripToken` (lo que de verdad importa: la ingesta) está bien protegido (hasheado en BD + anti-IDOR). Lo peor que logra un atacante con la app-key es crear viajes basura, acotado por rate-limit y validación.

> **Sonda de salud:** `GET /api/health` — público y exento del rate-limit. Hace `SELECT 1` y responde `{ status, db, uptime }` (`db:"up"` si la base responde). Para monitor / auditor / cloudflared.

### 2.1 Por qué DOS espacios separados (web vs móvil)
No es duplicación gratuita: es un **borde de seguridad**. Un mismo recurso (ej. destinos) se expone por **dos puertas con candados distintos** — `GET /api/web/destinations` (JWT, staff) y `GET /api/mobile/destinations` (X-App-Key, app pública). Beneficios: (1) **auth y rate-limit distintos** por tipo de cliente (confiable vs hostil); (2) menor **superficie de ataque** (el mundo móvil nunca ve gestión de usuarios); (3) **auditoría** separada del tráfico.
> **Regla anti-duplicación:** ambos espacios comparten el **mismo Service** (reglas de negocio); lo que difiere es solo el **Guard de entrada** y el **DTO de salida**. NO se duplica lógica de negocio (anti-patrón "dos implementaciones de lo mismo").

### 2.2 Matriz de permisos (roles web)
ADMIN es **superset** de MONITOR (Functional Spec §2). "autenticado" en las tablas siguientes = cualquiera de los dos roles.

| Recurso / acción | MONITOR | ADMIN |
| :-- | :--: | :--: |
| Login, ver perfil propio | ✓ | ✓ |
| Ver viajes (lista, activos, detalle) | ✓ | ✓ |
| Forzar cierre de viaje (CU-06) | ✗ | ✓ |
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
| POST | `/api/web/trips/:id/close` | **solo ADMIN** | **cierre forzado por admin** (observación obligatoria) |

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

Respuesta: `200` con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (binario). Columnas, en orden (títulos exactos, fuente única `REPORT_HEADERS` en `reports.service.ts`): ID de Viaje · Número de Proveedor · Nombre de Proveedor · Folio de Viaje / Remito · Placa Delantera · Placa Trasera · Destino · Fecha / Hora de Inicio · Fecha / Hora de Fin · Duración Total del Viaje · Estatus del Viaje · Tipo de Cierre · Observaciones.

---

## 4. Endpoints MÓVIL (`/api/mobile/*`)

### 4.1 Bootstrap (X-App-Key + rate-limit)
| Método | Ruta | Descripción |
| :-- | :-- | :-- |
| GET | `/api/mobile/destinations` | catálogo activo para el dropdown (RN-09). Si vacío → `[]` (la app muestra estado vacío, RN-14) |
| POST | `/api/mobile/trips` | **crea viaje + emite tripToken** (CU-01) |

`POST /api/mobile/trips` — **multipart/form-data** (7 campos + foto + metadato idempotente en un solo request, S-04/RN-15):
```
Campos: providerNumber, providerName, folio, frontPlate, rearPlate?, destinationId, deviceId, clientRequestId
Archivo: photo (jpg/png, 1 archivo, validar tamaño/tipo)
```
```json
// 201 — la misma combinación clientRequestId+deviceId puede regenerar la misma respuesta
{
  "tripId": "t1",
  "tripToken": "trk_live_9f3a...",   // derivado con HMAC y secreto de servidor; en BD sólo vive su hash
  "status": "EN_RUTA",
  "startedAt": "2026-06-18T15:00:00Z",
  "geofence": { "centerLat": 25.6866, "centerLng": -100.3161, "radiusMeters": 250 }
}
// 400 validación de campos (§6 Functional) · 409 si ya hay un viaje EN_RUTA en ese deviceId (RN-11)
```

**Idempotencia de creación (RN-15):** la app genera y guarda `clientRequestId` antes del primer envío. El backend mantiene `clientRequestId` único y deriva el `tripToken` de forma determinista mediante HMAC con un secreto exclusivo del servidor y los identificadores del viaje/dispositivo. Así puede devolver la misma credencial tras una respuesta perdida sin guardar el token en claro. Mismo `clientRequestId` con payload o `deviceId` diferente → `409`.

**Snapshot de geocerca (RN-16):** al crear el viaje se copian centro y radio vigentes al propio viaje; el nombre no se duplica y se consulta mediante `destinationId`. La respuesta devuelve la geocerca asignada para detección local y el backend usa los mismos valores al confirmar.

### 4.2 Ingesta de ubicaciones (Guard tripToken)
`POST /api/mobile/trips/:id/locations`
```
Headers: Authorization: Bearer <tripToken> · Content-Type: application/json · Content-Encoding: gzip
```
```json
// request (GZIP)
{
  "batchId": "44444444-4444-4444-8444-444444444444", // idempotencia (ADR-007 #9)
  "points": [
    { "lat": 25.71, "lng": -100.30, "accuracyMeters": 18.5, "recordedAt": "2026-06-18T15:18:00Z" },
    { "lat": 25.69, "lng": -100.31, "accuracyMeters": 12.0, "recordedAt": "2026-06-18T15:36:00Z" }
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
- **Idempotencia:** persistencia y evaluación ocurren en una transacción; el índice único `(tripId,batchId,recordedAt)` impide duplicar puntos incluso con solicitudes concurrentes. Replay completo → `accepted:0, duplicateBatch:true`.
- **Viaje ya CONCLUIDO:** `200`, puntos **descartados** silenciosamente, `stopTracking:true` (S-05).
- **Cada punto** pasa validación §5; los inválidos se rechazan (lote válido se acepta parcial, se reporta `accepted`).
- **Sync prioritario de llegada (RN-17):** si Android detecta entrada local a la geocerca, envía inmediatamente el lote que contiene el punto; no espera el ciclo normal y **continúa rastreando** hasta recibir respuesta.
- **Intento automático fuera del radio:** el backend no transiciona el viaje; responde `status:EN_RUTA`, `stopTracking:false` y la app sigue con su ciclo normal. No se convierte en cierre manual ni requiere callback separado.
- **Lote vs cierre:** todos los puntos válidos se persisten para dibujar la ruta. Para cierre automático se consultan únicamente hasta los **dos puntos válidos más recientes del viaje por `recordedAt`**, incluyendo históricos y recién insertados; basta que uno esté dentro del radio. Un punto sólo es candidato si `accuracyMeters` cumple el umbral configurado.

### 4.3 Cierre por operador (Guard tripToken)
`POST /api/mobile/trips/:id/close`
```json
// request
{
  "observations": "Entrega cancelada por el cliente.",
  "requestedAt": "2026-06-18T17:40:00Z",
  "closeRequestId": "33333333-3333-4333-8333-333333333333"
}
// 200 → closureType = MANUAL_OPERATOR, endedAt = requestedAt validado, stopTracking implícito
// 409 si ya CONCLUIDO
```

**Reglas distintas por tipo de cierre:**
- `AUTO_GEOFENCE`: sólo el backend cierra y debe verificar con haversine que al menos un punto recibido esté dentro del snapshot de radio asignado al viaje.
- `MANUAL_OPERATOR` / `MANUAL_ADMIN`: permite cierre forzoso aunque el punto esté fuera; exige observaciones no vacías, credencial válida y estado `EN_RUTA`.
- **Offline/idempotencia móvil:** Android persiste `closeRequestId`, `requestedAt` y observaciones en Room. Reintenta al reconectar; el mismo `closeRequestId` devuelve el mismo resultado. `endedAt` usa el `requestedAt` validado, no la hora tardía de reconexión.
- **Validación de `requestedAt`:** debe ser `>= startedAt` y no futuro más allá de la tolerancia de reloj definida; si falla, `400` y el cierre continúa pendiente para corrección/reintento controlado.
- **Carrera:** la actualización es condicional (`WHERE status='EN_RUTA'`). Otro cierre distinto que perdió la carrera recibe `409` con código `TRIP_ALREADY_CONCLUDED`; la UI lo presenta como información, no como fallo recuperable.

---

## 5. Validaciones compartidas de ingesta (capa de seguridad, ADR-007)

| Regla | Detalle | Si falla |
| :-- | :-- | :-- |
| `lat` / `lng` en rango | lat ∈ [-90,90], lng ∈ [-180,180] **y bbox MX de cordura** (lat ~14–33, lng ~ -119 a -86) | punto rechazado |
| `recordedAt` **no futuro** | ≤ ahora + 2 min de tolerancia de reloj | punto rechazado |
| `accuracyMeters` | número finito, > 0; para geocerca debe ser ≤ umbral configurable (inicial 50 m, pendiente tabla de negocio) | se almacena, pero no es candidato al cierre si excede umbral |
| **NO** filtrar "fuera de geocerca" | toda la ruta vive fuera de la geocerca | — (no validar) |
| Tamaño de lote | máx. **1000** puntos por lote (`@ArrayMaxSize(1000)`) | `400` (validación) |
| Tamaño de body / GZIP | tope al descomprimir (anti zip-bomb) | `413` |
| Campos desconocidos | `whitelist` + `forbidNonWhitelisted` | `400` |
| Rate-limit | por tripToken (ingesta) y por IP (bootstrap) | `429` |

---

## 6. Notas
- **Mapa web:** el front hace **polling** a `GET /api/web/trips/active` cada 15–20 min (no hay websockets en MVP, RN-12 / H7).
- **La app conoce el cierre confirmado** por `stopTracking:true`. Puede anticipar localmente la llegada y disparar el POST de inmediato, pero continúa rastreando y no declara `CONCLUIDO` antes del acuse (RN-17). Sin push, un cierre admin se conoce en la siguiente comunicación normal.
- **Restauración Android:** viaje activo, token, snapshot, puntos y cierre pendiente sobreviven reinicio de proceso/app/dispositivo mediante Room + WorkManager; no se crea otro viaje mientras exista estado local activo o cierre pendiente.
- **Bala trazadora (Slice 0):** usará un endpoint desechable y hardcodeado, NO este contrato; este spec es el objetivo al que converge la implementación.
- **OpenAPI:** formalizado en [`openapi/openapi.yaml`](../openapi/openapi.yaml) (3.0.3, válido, carpeta propia en la raíz) como **puente** para alinear/generar el front antes de que exista el backend. Este `.md` sigue siendo la fuente narrativa; cuando exista el backend NestJS, `@nestjs/swagger` autogenera el OpenAPI desde el código y ese pasa a ser la fuente de verdad (este `.yaml` se descarta para no mantener dos contratos).
