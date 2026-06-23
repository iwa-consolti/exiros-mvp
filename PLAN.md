# PLAN MAESTRO — Exiros On-Route Tracker (MVP)

> **Qué es:** Solución independiente de rastreo en ruta de camiones de chatarra (patio vendedor → patio comprador), con app Android para operadores y portal web para monitoristas de Exiros.
> **Metodología:** sigue `~/.agents/METODOLOGIA.md` (spec-driven, vertical slices, evidencia > suposición).
> **Autor del desarrollo:** Rogelio (solo, "vibe coding" con IA).
> **Ventana:** 16–26 jun 2026. Presentación **viernes 26 jun**. Hoy es **17 jun 2026** → quedan 9 días de trabajo + presentación.
> **Naturaleza:** competencia interna iWA. El equipo ganador continúa el proyecto. El código de `main` será auditado (César/Emanuel) con rúbrica y probado por usuario (Neto). **La calidad del repo y que la demo no se rompa pesan tanto como las features.**

---

## ⚠️ DECISIONES QUE NECESITO QUE VALIDES (antes de Día 1)

Estas dos bifurcan la mitad del plan. Mientras no las confirmes, asumo el valor por defecto marcado y sigo.

### D1 — Stack de la app Android (el fork más caro)
La estrategia de energía del doc (batching, distance filter, *activity recognition*, *fused location*, hibernación) es **exactamente** lo que ya resuelven librerías probadas. Opciones:

| Opción | Velocidad solo+IA | Costo | Encaja con doc | Defensa en revisión de código |
| :-- | :-- | :-- | :-- | :-- |
| **A) Kotlin nativo** (FusedLocationProvider + ActivityRecognition + Foreground Service + Room + WorkManager) | Media (más código) | $0 | Perfecto (el doc describe estas APIs) | Alta — código propio, auditable |
| **B) Flutter/React Native + `background_geolocation` (Transistorsoft)** | Alta (la librería ya hace batching/activity/distance) | $0 en build **debug** (la demo es debug); licencia solo para release | Perfecto (lo hace de fábrica) | Media — gran parte es la librería |

- **Recomendación provisional: Opción A (Kotlin nativo).** Razón: para una competencia donde *te auditan el código y el ganador continúa*, tener el rastreo nativo propio es más defendible y sin dependencia de licencia. Claude escribe bien este código. Riesgo: más volumen de código y la curva de *foreground services* + permisos de Android 13/14.
- **Cuándo cambiaría a B:** si el Día 2 (tracer bullet) el rastreo nativo en segundo plano da problemas de OEM (Xiaomi/Huawei matan servicios) y no avanzo, salto a B en modo debug y gano días.
- **Decisión registrada en:** `ADR-004`.

### D2 — Cómo el teléfono alcanza el backend en la demo (sin "cloud" formal)
El doc dice que el despliegue cloud NO es requisito, pero un teléfono real necesita un backend alcanzable por internet para demostrar el flujo.

| Opción                                                 | Esfuerzo | Demo en campo                                              |
|:-------------------------------------------------------| :-- |:-----------------------------------------------------------|
| **A) Túnel (cloudflared / ngrok)** sobre backend local | Mínimo | Sirve, pero la URL cambia y depende de tu laptop encendida |
| **B) Deploy gratis (Railway / Fly.io)**                | Bajo (1–2 h) | Robusto, URL estable, demo independiente de tu laptop      |
| **C) Deploy con docker o en local ** | Bajo (1–2 h) | Sin analisis                                               |

- **Recomendación provisional: B (deploy gratis en Railway).** No viola "no se requiere cloud" (no está prohibido, solo no es obligatorio), y elimina el riesgo de que la demo dependa de tu laptop + red local. Para desarrollo diario uso **túnel**, y subo a Railway desde el Día 5. Si prefieres cero cloud, me quedo en túnel.
- **Decisión registrada en:** `ADR-009`.

> El resto de decisiones técnicas las tomé yo y están justificadas más abajo. Si vetas alguna, lo registramos como cambio de ADR.

---

## 1. Resumen ejecutivo

Construir en 8 días un MVP de rastreo en ruta compuesto por: **(1)** app Android en español de **acceso libre** (sin login) donde el fletero registra un viaje y la app rastrea su ubicación con consumo de batería <10%/jornada mediante envío por lotes; **(2)** **backend/API único** que ingiere lotes de coordenadas, detecta llegada por **geocerca** y cierra viajes automáticamente; **(3)** **portal web** con login para monitoristas: mapa de tránsito (refresco 15–20 min), administración de geocercas/destinos, gestión de usuarios y exportación de reportes a Excel.

El camino crítico es el rastreo en segundo plano de Android. Se ataca primero con una **bala trazadora** extremo a extremo el Día 2–3 y luego se engorda por *vertical slices*. Despliegue y CI/CD se mantienen al mínimo demostrable (el proyecto los marca como no requeridos). Entregable del Día 8: MVP funcional, demo guionada y repo limpio para auditoría.

---

## 2. Problema y usuarios

**Problema:** Exiros no tiene visibilidad del transporte de chatarra entre el patio del proveedor y su destino. No sabe dónde va cada camión, cuándo sale, cuándo llega ni cuánto tardó — lo que dificulta auditar el pago de fletes y detectar anomalías. La restricción dura: los choferes usan **su propio teléfono**, así que cualquier solución que les drene la batería o les pida login será rechazada en campo.

**Usuarios:**
- **Operador / fletero (externo):** maneja el camión. Quiere abrir la app, registrar el viaje en 30 segundos y olvidarse. No tiene cuenta, no le interesa la tecnología, cuida su batería y sus datos. → App Android, español, acceso libre.
- **Monitorista (Exiros):** vigila los camiones en ruta desde la consola, fuerza cierres ante contingencias y descarga reportes. → Portal web, con login.
- **Administrador (Exiros):** además gestiona destinos/geocercas y usuarios monitoristas. → Portal web, con login.
- **(Implícito) Auditor de fletes:** consume el Excel para validar pagos. → Reporte exportable.

---

## 3. Huecos detectados

Formato: **Qué falta → por qué importa → qué bloquea → riesgo si se ignora → pregunta → día tope.**

| # | Hueco | Por qué importa | Bloquea | Riesgo | Pregunta a responder                                                                                                                                                                                                                                                                                                                                                               | Día tope |
| :-- | :-- | :-- | :-- | :-- |:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| :-- |
| H1 | Stack Android no definido (ver D1) | Es el 90% del riesgo técnico | Todo el trabajo móvil | Empezar mal y perder días | ¿Nativo Kotlin o cross-platform con plugin?                                                                                                                                                                                                                                                                                                                                        | D1 |
| H2 | ✅ **RESUELTO** Catálogo de destinos | El destino alimenta dropdown y cierre automático | — | — | El catálogo lo crea el **Admin desde el CRUD web** (CU-08); son **datos de runtime, NO build-time** → no bloquea diseño ni código. La app solo muestra las opciones existentes. Datos reales = solo para que la demo sea creíble (seed opcional). **Caso borde:** catálogo vacío → operador no puede iniciar (destino obligatorio) → la app muestra estado vacío y bloquea inicio. | — |
| H3 | Cómo se demuestra el flujo GPS sin manejar un camión real | La demo necesita movimiento real  | Demo final | No poder mostrar el cierre por geocerca | La localizacion debe ser real para el dia de la presentacion                                                                                                                                                                                                                                                                                                                       | D2 |
| H4 | Despliegue/alcance de red para teléfono (ver D2) | El teléfono debe llegar al backend | Slices 2+ y demo | Demo dependiente de laptop/red | Túnel vs deploy gratis                                                                                                                                                                                                                                                                                                                                                             | D2 |
| H5 | Seguridad del endpoint de ingesta (app sin login) | Cualquiera podría inyectar viajes/coordenadas falsas | Slice 2, seguridad | Datos basura, spoofing | ¿Aceptamos token de dispositivo simple para MVP?                                                                                                                                                                                                                                                                                                                                   | D4 |
| H6 | ⚠️ **PARCIAL** Disponibilidad de teléfono Android físico | Emulador no prueba bien GPS real/acelerómetro/segundo plano | Pruebas de los slices 2–4 | Creer que "funciona" sin evidencia real | **NO hay teléfono hoy** (2026-06-18). Demo sobre **emulador** (UI + permisos + ruta GPS simulada → cierre por geocerca viable). **Batería real + OEM battery-killers NO verificables** hasta conseguir dispositivo (se hará "más adelante"). Deuda de validación registrada en ADR-004.                                                                                            | — |
| H7 | Definición operativa de "tiempo real" | El doc dice mapa cada 15–20 min; "tiempo real" puede generar expectativa falsa | Alcance, demo | Reclamo de que "no es en vivo" | Confirmar con Julio que 15–20 min es aceptable                                                                                                                                                                                                                                                                                                                                     | D1 |
| H8 | Almacenamiento de la foto de carga | Decide infra y endpoint | Slice 8 | Rehacer subida de archivos | ¿Disco local del backend basta para MVP?                                                                                                                                                                                                                                                                                                                                           | D3 |
| H9 | Proveedor de mapas web | Google Maps requiere billing/API key; OSM/Leaflet es gratis | Slice "mapa" web | Bloqueo por falta de tarjeta/clave | ¿OK usar Leaflet + OpenStreetMap (gratis)?                                                                                                                                                                                                                                                                                                                                         | D5 |
| H10 | ✅ **RESUELTO** Volumen esperado | Dimensiona DB e índices | Decisiones de escala | Sobre/infra-dimensionar | ~200 usuarios, bajo volumen, usuario nunca toca la BD → índices simples bastan, sin sobre-dimensionar                                                                                                                                                                                                                                                                              | — |

---

## 4. Preguntas críticas (para Julio / seniors el 17 por la tarde y el 19)

3. **(H5)** Sin login en la app, ¿es aceptable para el MVP proteger la ingesta con un **token de dispositivo** simple (no usuario/contraseña), o el acceso es 100% abierto? No, para eso es el trip token. Revisar mas adelante.
5. **(D2)** ¿Hay objeción a un **deploy gratuito** (Railway/Render) para la demo, dado que "cloud" no es requisito pero tampoco está prohibido? Deploy puede ser local para la muestra de funcionamiento, o investigar alguna version gratis como AWS.

---

## 5. MVP recomendado

### 5.1 Obligatorio (define el éxito de la demo)

| Funcionalidad | Usuario | Justificación | Dependencias | Criterio de aceptación |
| :-- | :-- | :-- | :-- | :-- |
| App abre directo en formulario (sin login) | Operador | Requisito explícito de adopción | — | No existe ninguna pantalla de login |
| Formulario de inicio de viaje con sus 7 campos y validaciones | Operador | Origen de todo el dato | Backend `POST /trips` | Campos y reglas del doc §3.2 funcionan; viaje queda "En ruta" |
| Foto de carga (cámara o galería) | Operador | Evidencia obligatoria | Storage | La foto se sube y se ve en el portal |/
| Rastreo en segundo plano con batching + distance filter + hibernación | Operador | Núcleo del producto y de la propuesta de batería | Stack Android (D1) | <10% batería/jornada (medido); envíos cada ~15–20 min |
| Ingesta de lotes comprimidos | Sistema | Eficiencia de datos/batería | DB | `POST /trips/:id/locations` acepta lote GZIP y persiste |
| Mapa de tránsito activo (refresco 15–20 min) | Monitorista | Visibilidad | Ingesta + web | Camión en ruta aparece y se mueve en el mapa |
| Geocercas / destinos (CRUD) | Admin | Alimenta dropdown y cierre auto | DB | Alta/edición de destino con centro+radio |
| Cierre automático por geocerca | Sistema | Diferenciador clave | Ingesta + geocercas | Punto dentro del radio → viaje "Concluido", app deja de rastrear |
| Cierre manual operador (con Observaciones obligatorias) | Operador | Contingencias | — | Botón "Finalizar viaje" exige observación |
| Cierre manual admin (con Observaciones) | Monitorista | Contingencias | — | Forzar cierre desde web exige observación |
| Login + gestión de usuarios (web) | Admin/Monitorista | Seguridad de la consola | Auth | Alta/baja de monitoristas; rutas protegidas |
| Reporte de viajes + exportación .xlsx (13 columnas) | Auditor | Auditoría de fletes | DB | Excel con exactamente las 13 columnas del doc §6 |

### 5.2 Post-MVP (después del 26) 

| Funcionalidad | Por qué se posterga | Riesgo de hacerlo ahora |
| :-- | :-- | :-- |
| Notificaciones push (llegadas, alertas) | No es núcleo de visibilidad | Consume días del camino crítico |
| Roles finos / auditoría de accesos | El MVP solo necesita login básico | Sobreingeniería de seguridad |
| iOS | Alcance es Android | Duplica el esfuerzo móvil |
| Dashboards/analytics avanzados | El Excel cubre la auditoría inicial | Distrae del flujo principal |
| Reintentos/cola robusta offline-first avanzada | Room + WorkManager básico basta para MVP | Complejidad prematura |
| Alertas de desvío de ruta / ETA | Requiere routing/mapas avanzados | Fuera de alcance temporal |

### 5.3 No recomendado (sobreingeniería para 8 días)

- Microservicios, Kafka/colas, Kubernetes.
- CI/CD completo, E2E (Cypress/Playwright), pruebas de carga — **el proyecto los marca como no requeridos**.
- PostGIS / geometrías complejas: la geocerca es un **círculo (centro+radio)** → basta haversine.
- Multi-tenant, i18n más allá de español, modo oscuro, PWA offline para la web.
- Optimización prematura del payload más allá de CSV+GZIP que pide el doc.

### 5.4 Ideas en evaluación (propuestas de Rogelio — sin decidir)

> Capturadas para no perderlas. **No** son decisiones cerradas ni alcance comprometido; se evalúan antes de implementar (algunas con Julio/seniors).

**I-01 — Filtro "operador a pie" (mini-geocerca dinámica + actividad/velocidad).** *(Refinamiento del rastreo — viable en MVP)*
- **Problema:** el operador se baja del camión (baño, tienda) y camina; el GPS lo registra como "el vehículo se movió un poco", ensuciando la ruta.
- **Cómo funcionaría** (combina dos señales que la app ya pide en la pantalla de Permisos — ubicación + actividad física):
  - **Radio de permanencia (mini-geocerca dinámica):** si las nuevas lecturas caen dentro de ~50–80 m del último punto, se considera el mismo lugar → se reenvía la **misma** ubicación en vez de "viajó un poco".
  - **Actividad + velocidad:** la *Activity Recognition API* de Android clasifica `EN_VEHÍCULO` / `A_PIE` / `QUIETO`. Si detecta "a pie" o velocidad ~0, el operador se bajó y el camión sigue parado.
- **Viabilidad:** **alta y barata.** `ActivityRecognition` + *distance filter* ya están en el stack (ADR-004); es lógica de filtrado en el cliente, sin infra nueva.
- **A cuidar:** que el filtro no enmascare una llegada real al destino (no debe impedir el cierre por geocerca); definir umbrales (radio, velocidad, ventana de tiempo) y que sigan siendo configurables como H7.

**I-02 — "Actualizar ubicación" on-demand desde el portal web.** *(Útil, pero arrastra push → Post-MVP)*
- **Idea:** mantener el refresco automático cada 15–20 min, pero permitir que el monitorista, desde la vista del viaje, pulse **"Actualizar ubicación"** para forzar un envío inmediato (ej. confirmar que el camión ya llegó a la planta/ciudad sin bajar el intervalo global para todos).
- **Beneficio:** ahorra batería (no se reduce el intervalo de todos), y da inmediatez solo cuando se necesita; en segundo plano se siguen guardando las coordenadas igual.
- **⚠️ Restricción técnica:** el diseño es **pull desde el dispositivo** (la app hace `POST`, el backend no inicia conexión). Forzar un envío exige un **canal de push al teléfono** (FCM o WebSocket) → es justo lo que §5.2 posterga como Post-MVP. Sin push no hay forma de "despertar" al teléfono on-demand.
- **Veredicto preliminar:** **Post-MVP.** Alternativa MVP-friendly si urge: un `pendingRefresh` que el backend marca y la app consulta/aplica en su siguiente latido (no es instantáneo, pero no necesita push). A validar con Julio/seniors si vale el costo.

---

## 6. Forma de trabajo recomendada

- **Spec-driven ligero:** antes de cada slice, una mini-spec (qué endpoint, qué pantalla, qué validación, criterio de aceptación). Las specs viven en `/docs`.
- **Vertical slices:** cada entrega cruza UI → API → lógica → DB. Nunca "todo el backend primero". 
- **Bala trazadora primero (Día 2–3):** una coordenada hardcodeada que viaje Android → API → DB → punto en el mapa web. Conecta todo antes de pulir nada.
- **Ciclo de 7 pasos por bloque** (situarse, anunciar, implementar, verificar, commitear, documentar, entregar).
- **La verdad se ejecuta:** cada slice se prueba contra el sistema real; lo visual se VE renderizado (simulador/teléfono/captura), no solo "compila".
- **Bitácora en este archivo:** notas fechadas, decisiones de una línea, bloqueos como `> Pendiente externo:`.
- **Commits pequeños y descriptivos** en `main` 
- **Validación de código IA:** no se acepta código que no entienda; no cambios masivos sin revisar; no lógica de negocio en controllers; no endpoints sin validación.

---

## 7. Specs necesarias (mínimas, en `/docs`)

| Spec | Contenido | Cuándo |
| :-- | :-- | :-- |
| **Product Spec** | Problema, usuarios, objetivo, alcance/fuera de alcance, métricas, flujos | D1 |
| **Functional Spec** | Casos de uso, reglas de negocio, validaciones, errores, criterios de aceptación | D2 |
| **Technical Spec** | Arquitectura, stack, módulos, patrones, estructura repo, seguridad, testing, deploy | D2 |
| **API Spec (OpenAPI)** | Endpoints, métodos, request/response, errores, auth, ejemplos JSON | D3 |
| **Database Spec** | Entidades, campos, relaciones, índices, datos sensibles, borrado | D3 |
| **UI/UX Spec** | Pantallas web y Android, navegación, estados (carga/vacío/error) | D2–D5 |
| **Test Spec** | Unit, integración, API, manuales; mínimos para entregar | D2 (vivo) |
| **AI Development Spec** | Cómo dividir prompts, cómo revisar, qué no hace la IA sin validación | D1 |

> **Métricas de éxito del MVP:** (1) batería <10%/jornada en prueba real; (2) cierre automático por geocerca funcionando; (3) Excel con las 13 columnas exactas; (4) demo extremo a extremo sin romperse.

---

## 8. Arquitectura recomendada

**Monolito modular, organizado por features, con capas internas por módulo, y una API única que sirve tanto a la web como a Android.** Es lo que el propio prompt sugiere por defecto y es lo correcto aquí: un solo desarrollador, 8 días, dominio acotado.

- **Por qué no más:** microservicios/hexagonal pura/event-driven serían sobreingeniería; añaden infra y ceremonia sin pagar valor en 8 días.
- **Por qué no menos:** un script monolítico sin capas reprobaría la auditoría de código y sería difícil de extender (el ganador continúa).

**Módulos del backend (features):** `trips`, `locations` (ingesta), `destinations` (geocercas), `users/auth`, `reports`.

**Responsabilidades por capa:**
- **Controller:** entrada HTTP, validación de forma (DTO), nada de lógica de negocio.
- **Service:** reglas de negocio (validaciones, detección de geocerca, cierre de viaje).
- **Repository (Prisma):** acceso a datos.
- **Entity/Model:** esquema Prisma (persistencia).
- **DTO:** entrada/salida; **Mapper:** entidad↔DTO.
- **Exception filter:** errores consistentes (formato `{ error, message, details }`).
- **Security:** JWT para web; token de dispositivo opcional para ingesta (ver H5).
- **Config:** variables de entorno tipadas.

```
[Android App] --(POST /trips, POST /trips/:id/locations [GZIP])--> [API NestJS]
[Web Portal]  --(REST + JWT)----------------------------------->  [API NestJS]
                                                                      |
                                                                 [PostgreSQL]
                                                                      |
                                                          [Storage fotos: disco/volumen]
```

---

## 9. Patrones recomendados y NO recomendados

**Recomendados:**
| Patrón | Dónde | Qué resuelve | Riesgo si se usa mal |
| :-- | :-- | :-- | :-- |
| Repository | Acceso a datos por módulo | Aísla persistencia | Repos anémicos que filtran SQL a services |
| Service Layer | Reglas de negocio | Controllers delgados | Meter acceso HTTP en el service |
| DTO + Mapper | Bordes de la API | Contrato estable, no exponer entidades | Mappers que duplican lógica |
| Dependency Injection | Nativo en NestJS | Testeo y desacople | Inyectar de más |
| Strategy | Tipo de cierre (auto/manual-operador/manual-admin) | Variantes de cierre limpias | Strategy para 2 casos triviales = ruido |
| Repository de ubicación + batch insert | Ingesta de lotes | Eficiencia de escritura | Inserts uno a uno |

**NO recomendados (para este MVP):**
- **Observer/Event-driven, CQRS, Saga:** la detección de geocerca se resuelve síncrono en el service de ingesta; eventos añaden complejidad sin valor.
- **Factory/Builder:** los objetos son simples; constructores directos bastan.
- **Facade:** no hay subsistemas complejos que ocultar todavía.

---

## 10. Stack técnico

| Capa | Recomendado | Por qué | Alternativa descartada | Riesgo |
| :-- | :-- | :-- | :-- | :-- |
| **Backend** | **NestJS (TypeScript)** | Estructura por módulos/capas lista, DI nativa, validación con `class-validator`, OpenAPI integrado; ideal para auditoría | Express puro (menos estructura), Spring Boot (más lento para solo+IA en 8d) | Curva si no conoces Nest (mitigable) |
| **Web** | **React + Vite + TypeScript** | Rápido, ecosistema mapas, DX con IA | Next.js (SSR innecesario aquí) | Bajo |
| **Mapa** | **Leaflet + OpenStreetMap** | Gratis, sin API key/billing | Google Maps (requiere tarjeta/clave) | Tiles OSM con límites de uso (ok demo) |
| **Android** | **Kotlin nativo** (D1, ver ADR-004) | Control total, $0, encaja con doc, defendible | Flutter/RN + plugin background-geolocation | Segundo plano + OEM battery killers |
| **DB** | **PostgreSQL** | Robusta, gratuita, Prisma de 1ª clase | MySQL (igual válido), SQLite servidor (no escala) | Bajo |
| **ORM** | **Prisma** (ver §11) | Type-safe, migraciones, DX excelente con IA | TypeORM, SQL manual | Batch insert grande: usar `createMany` |
| **Auth (web)** | **JWT** (access token simple) | Suficiente para consola | Sessions/OAuth (sobra) | Guardar secreto fuera del repo |
| **Storage fotos** | **Disco/volumen local del backend** (MVP) | Cero infra extra | S3 (post-MVP) | Pérdida si se recrea contenedor (aceptable MVP) |
| **Excel** | **exceljs** | Control de columnas/formato | csv plano (menos pro) | Bajo |
| **Validación** | **class-validator + class-transformer** | Integra con DTOs Nest | Zod (válido) | Bajo |
| **Testing** | **Jest** (unit + e2e de API con Supertest) | Estándar Nest | — | No sobre-testear UI |
| **Notificaciones** | **Ninguna en MVP** | Fuera de alcance | FCM (post-MVP) | — |
| **IA en el producto** | **Ninguna** | El "AI" del doc es el Fused Location nativo, no IA propia | — | No confundir alcance |

---

## 11. ORM / Acceso a datos recomendado

**Prisma.** 
- **Ventajas:** modelo declarativo, migraciones versionadas, cliente type-safe (menos bugs, mejor para auditoría), `createMany` para lotes de ubicaciones, excelente con generación por IA.
- **Desventajas:** consultas geoespaciales avanzadas no son su fuerte — **no las necesitamos** (geocerca = haversine en el service).
- **Curva:** baja. **Velocidad MVP:** alta.
- **Descartados:** TypeORM (más fricción/decoradores frágiles), SQL manual (rápido pero sin seguridad de tipos ni migraciones, peor para auditoría), Supabase/Firebase client (acoplan a un BaaS y el doc pide solución independiente y aislada).

**Nota de rendimiento:** la ingesta inserta lotes de ~10 puntos cada 15–20 min por camión → volumen bajo; índices en `tripId`, `recordedAt` y `trip.status` bastan.

---

## 12. Docker y despliegue

> El proyecto marca **despliegue cloud, CD y E2E como NO requeridos**. Mantener al **mínimo demostrable**.

**Docker (solo conveniencia local, no obligatorio):**
- `docker-compose.yml` con **PostgreSQL** (y opcionalmente el backend) para levantar la DB en un comando.
- Variables en `.env` (no versionado); `.env.example` sí versionado.
- Diferencia entornos: solo **local** vs **demo** (no hay staging). Una sola URL de API por entorno.
- Riesgo común: persistencia de volúmenes y puertos ocupados → documentar en README.

**Despliegue (ver D2/ADR-009):**
- **Desarrollo:** backend local + **túnel** (cloudflared) para que el teléfono lo alcance.
- **Demo:** **Railway/Render gratis** (backend + Postgres administrado) para una URL estable, independiente de tu laptop.
- **Web:** build estático servido por el mismo backend o **Vercel/Netlify gratis**.
- **Fotos:** volumen local (MVP).
- **Logs/monitoreo:** logs estructurados de Nest + lo que dé el panel de Railway. Sin observabilidad avanzada.

---

## 13. Tipo de repositorio y Git

**Monorepo** (un solo dev, despliegue y revisión más simples, IA con todo el contexto):

```
/exiros-on-route-tracker
  /backend      # NestJS + Prisma
  /web          # React + Vite
  /android      # Kotlin
  /docs         # specs + ADRs + API/DB spec
  /infra        # docker-compose, .env.example
  /scripts      # seed de destinos, simulador de ruta
  PLAN.md
  CONTEXT-AI.md
  README.md
```

**Estrategia Git:**
- Rama principal: **`main`** (auditada por César/Emanuel — mantenerla siempre verde y demostrable).
- Ramas de feature por slice: `feat/slice-1-trip-start`, etc. PR/merge a `main` al cerrar cada slice.
- **Commits convencionales:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- **Antes de merge a main:** compila, lint en verde, prueba del slice ejecutada, criterio de aceptación cumplido.
- Como trabajas solo, los PR pueden ser auto-merge tras checklist, pero **cada slice = al menos un commit limpio** para que la auditoría tenga granularidad.

---

## 14. ADRs necesarias (en `/docs/adr/`)

> ⚠️ **ESTADO REAL (2026-06-17):** la columna "Punto de partida" NO es una decisión cerrada. Es el borrador del arquitecto. **Cada ADR se trabaja una por una en el Bloque 0.5** (contexto · opciones reales · pros/cons · por qué · decisión) y SOLO ahí se fija. Nada en §8 (arquitectura) ni §10 (stack) es definitivo hasta que su ADR esté en estado `Aceptado` por Rogelio.

Cada una con: contexto, decisión, alternativas, consecuencias +/−, riesgos, estado.

| ADR | Tema | Punto de partida (a debatir en 0.5) | Estado |
| :-- | :-- | :-- | :-- |
| ADR-001 | Tipo de repositorio | **Monorepo split-ready** | ✅ Aceptado |
| ADR-002 | Arquitectura + framework backend | **Monolito modular por features + NestJS** | ✅ Aceptado |
| ADR-003 | Stack frontend web | **React + Vite + Leaflet/OSM** | ✅ Aceptado |
| ADR-004 | **Stack Android** | Kotlin nativo vs Flutter/RN+plugin (D1) | ✅ Aceptado (Kotlin nativo + Plan B) |
| ADR-005 | Base de datos | **PostgreSQL** | ✅ Aceptado |
| ADR-006 | ORM / acceso a datos | **Prisma** (independiente del motor) | ✅ Aceptado |
| ADR-007 | Autenticación | JWT web; token de dispositivo en ingesta (H5) | ✅ Aceptado (JWT web + tripToken móvil) |
| ADR-008 | Docker | Solo Postgres local; no obligatorio | ✅ Aceptado |
| ADR-009 | **Despliegue** | Túnel en dev + Railway/Render en demo (D2) | ✅ Aceptado (default, pend. Julio) |
| ADR-010 | Estrategia de pruebas | Jest unit + e2e API; manuales en teléfono real | ✅ Aceptado |
| ~~ADR-011~~ | ~~Uso de IA~~ | **MOVIDO:** no es ADR del proyecto. Cómo usamos IA es **metodología interna** (`~/.agents/METODOLOGIA.md` + `CONTEXT-AI.md`), no un entregable ni integración visible para el cliente/auditoría del producto. | ❌ No aplica como ADR |
| ADR-012 | Geocerca | **Haversine en service, sin PostGIS** (spatial = upgrade path) | ✅ Aceptado (pend. confirmar) |

---

## 15. Vertical slices

> ⚠️ **Estas slices son del borrador del arquitecto (pre-Fase 0).** La versión ejecutable, ordenada y con "Hecho cuando" vive en **§21** y se construye en el **Bloque 0.7**, DESPUÉS de cerrar las specs de diseño. **No son la fuente de orden de trabajo todavía.**
>
> **Sobre Slice 0 (bala trazadora) vs API Spec:** la bala trazadora es *deliberadamente* ligera en spec — su único trabajo es matar el riesgo #1 (¿Android en segundo plano → backend → DB → mapa funciona siquiera?) con UN endpoint desechable y hardcodeado. NO espera al OpenAPI completo. En nuestra secuencia actual (diseño primero), el **API Spec (0.3) queda listo ANTES de cualquier código**, y la bala trazadora es implementación (Fase 1+), así que no hay contradicción: el spec define el contrato objetivo, la bala prueba la tubería.

Orden por dependencia + riesgo alto temprano. Cada slice: UI → endpoint → lógica → persistencia → validación → errores → prueba → criterio.

- **Slice 0 — Bala trazadora (D2–D3):** Android envía 1 coordenada hardcodeada → `POST /locations` → DB → punto en mapa web. *Hecho cuando:* veo el punto en el mapa desde un envío real del teléfono.
- **Slice 1 — Inicio de viaje (D3–D4):** formulario Android (7 campos + validaciones) → `POST /trips` → DB → aparece en lista de "activos" en web. *Hecho cuando:* un viaje creado en el móvil se ve "En ruta" en la web.
- **Slice 2 — Rastreo por lotes + energía (D4):** captura pasiva (2–3 min), distance filter (300–500 m), hibernación por inactividad, envío GZIP cada 15–20 min → `POST /trips/:id/locations` → mapa se actualiza. *Hecho cuando:* el camión se mueve en el mapa y la batería baja <10%/jornada en prueba real.
- **Slice 3 — Cierre automático por geocerca (D4–D5):** Android anticipa la entrada usando el snapshot y dispara sync prioritario sin detenerse; el service verifica el mismo punto → dentro: `Concluido` + `stopTracking:true`; fuera: `En ruta` + `stopTracking:false`. *Hecho cuando:* con red disponible no espera el ciclo de 15–20 min y sólo se detiene tras confirmación.
- **Slice 4 — Cierres manuales (D5):** botón "Finalizar viaje" en app (Observaciones obligatorias) + forzar cierre desde web (Observaciones). *Hecho cuando:* ambos cierres exigen observación y quedan registrados con su tipo.
- **Slice 5 — Destinos/geocercas + dropdown (D5):** CRUD web de destinos (centro+radio) que alimenta el dropdown del formulario móvil. *Hecho cuando:* un destino nuevo aparece en el selector de la app.
- **Slice 6 — Reportes + Excel (D7):** listado y `GET /reports/export` con las 13 columnas exactas. *Hecho cuando:* el .xlsx descargado tiene exactamente las 13 columnas del doc §6.
- **Slice 7 — Auth web + usuarios (D7):** login JWT + alta/baja de monitoristas + rutas protegidas. *Hecho cuando:* sin token no se entra; admin da de alta un monitorista que luego entra.
- **Slice 8 — Foto de carga (D4, junto a Slice 1):** captura/galería → subida → visible en portal. *Hecho cuando:* la foto del viaje se ve en el detalle web.

---

## 16. Estrategia de uso de IA

- **Spec antes que código:** ningún prompt de implementación sin mini-spec del slice.
- **Estructura de cada prompt:** contexto · objetivo · archivos involucrados · restricciones · criterios de aceptación · código esperado · pruebas esperadas · validación manual · commit sugerido.
- **Reglas duras:** no aceptar código que no entiendas; no cambios masivos sin revisar; no cambiar arquitectura sin actualizar ADR; no cambiar API sin actualizar API Spec; no lógica de negocio en controllers; no endpoints sin validación; no subir secretos.
- **La IA genera código Y pruebas** cuando aplique.
- **Anti-alucinación:** verificar que cada archivo/flag/endpoint citado exista antes de construir encima; probar contra el sistema real, no contra la imaginación.
- **División de prompts por slice**, no "hazme toda la app".

---

## 17. Plan de 8 días

> ⚠️ **Borrador original del arquitecto.** Asignaba días antes de existir la Fase 0 de diseño. Se **reconcilia en el Bloque 0.7** con el backlog de §21. Úsalo como referencia de ritmo, no como secuencia fija.

> Fechas reales. **Sáb 20 y Dom 21 son fin de semana** → tratados como buffer/ritmo ligero. Puntos con seniors: **19 jun (dudas)** y **23 jun (arquitectura)**. Dudas funcionales con Julio cuando se necesiten.

### Día 1 — Mié 17 jun · Análisis y cimientos de decisión
- **Objetivo:** cerrar análisis, validar D1/D2 y preguntas críticas, dejar specs base.
- **Tareas:** revisar este PLAN con stakeholders; hacer las 5 preguntas críticas (Julio/seniors esta tarde); confirmar teléfono físico (H6); escribir Product Spec + AI Dev Spec; crear monorepo + scaffolding vacío; ADR-001/002/003/005/006.
- **IA puede:** generar scaffolding, drafts de specs y ADRs.
- **Humano valida:** D1 (stack Android), D2 (deploy), respuestas de Julio.
- **Entregables:** repo inicial, specs base, ADRs propuestas.
- **Criterio:** D1 y D2 resueltas o con default asumido y registrado.

### Día 2 — Jue 18 jun · Specs técnicas + arranque bala trazadora
- **Objetivo:** Technical/Functional/UI Spec base + empezar Slice 0.
- **Tareas:** Technical Spec, Functional Spec, esqueleto NestJS (módulo `locations`), Postgres en Docker, esquema Prisma inicial, endpoint `POST /locations` mínimo; arrancar proyecto Android vacío que mande una coordenada.
- **IA:** scaffolding backend, Prisma schema, endpoint mínimo.
- **Humano valida:** que el endpoint reciba y persista (curl real).
- **Entregables:** backend que guarda una coordenada; specs técnicas.
- **Criterio:** `curl` inserta una coordenada y se ve en DB.

### Día 3 — Vie 19 jun · Bala trazadora completa + API/DB Spec *(día de dudas con seniors)*
- **Objetivo:** cerrar **Slice 0** y arrancar **Slice 1**; API Spec (OpenAPI) + Database Spec; túnel/deploy listo (D2).
- **Tareas:** Android envía coordenada real → API → DB → **punto en mapa web (Leaflet)**; API Spec; Database Spec; seed de destinos (datos provisionales si H2 sigue abierto).
- **IA:** OpenAPI, componentes React de mapa, seed script.
- **Humano valida:** ver el punto en el mapa desde el teléfono real; aprovechar la sesión con seniors para validar arquitectura.
- **Entregables:** flujo extremo a extremo vivo; API/DB Spec.
- **Criterio (Hecho cuando):** una coordenada enviada desde el teléfono aparece en el mapa web.

### Día 4 — Sáb 20 jun · Backend del flujo crítico + energía Android *(ritmo ligero)*
- **Objetivo:** **Slice 1** (inicio de viaje), **Slice 2** (rastreo por lotes/energía), **Slice 8** (foto).
- **Tareas:** `POST /trips` + DTOs/validaciones; formulario Android con 7 campos; captura local (Room) + batching GZIP + distance filter + hibernación; subida de foto; ingesta de lote `POST /trips/:id/locations`; pruebas Jest del service de viajes.
- **IA:** DTOs, validaciones, service, código de batching, lote/GZIP.
- **Humano valida:** medir batería en prueba real; ver viaje "En ruta" en web; foto visible.
- **Entregables:** viaje creado desde móvil con rastreo por lotes funcionando.
- **Criterio:** camión se mueve en el mapa; batería <10%/jornada en prueba.

### Día 5 — Dom 21 jun · Geocercas, cierres y conexión web *(ritmo ligero)*
- **Objetivo:** **Slice 3** (cierre auto), **Slice 4** (cierres manuales), **Slice 5** (destinos/geocercas + dropdown).
- **Tareas:** haversine en service de ingesta → cierre automático + orden de detener GPS; botón "Finalizar viaje" (Observaciones) en app; forzar cierre desde web; CRUD web de destinos que alimenta el dropdown móvil.
- **IA:** lógica geocerca, endpoints de cierre, CRUD destinos, UI web.
- **Humano valida:** simular ruta entrando al radio → ver cierre automático.
- **Entregables:** ciclo de vida del viaje completo.
- **Criterio:** al entrar al radio el viaje se cierra solo y la app detiene rastreo.

### Día 6 — Lun 22 jun · Portal web sólido + Android pulido
- **Objetivo:** consolidar webapp (mapa de tránsito, detalle de viaje, estados de carga/vacío/error) y estabilizar la app Android (permisos Android 13/14, foreground service notif).
- **Tareas:** mapa de tránsito activo con refresco 15–20 min; pantalla de detalle con foto y observaciones; manejo de errores de red en la app; reintentos básicos de lote.
- **IA:** componentes web, manejo de estados, lógica de reintento.
- **Humano valida:** flujo web completo navegado a mano; app sobrevive a pérdida de red.
- **Entregables:** web y app presentables.
- **Criterio:** monitorista ve y opera viajes activos sin errores visibles.

### Día 7 — Mar 23 jun · Auth, reportes, integración y seguridad mínima *(día de arquitectura con seniors)*
- **Objetivo:** **Slice 6** (reportes/Excel), **Slice 7** (auth web + usuarios), endurecimiento.
- **Tareas:** login JWT + guardas de ruta + gestión de monitoristas; `GET /reports/export` .xlsx con las 13 columnas; token de dispositivo en ingesta (si H5 aprobado); exception filter global; validación en todos los endpoints; pasada de seguridad (secretos fuera del repo, CORS, rate-limit básico).
- **IA:** auth module, exportador Excel, filtros de error.
- **Humano valida:** descargar Excel y verificar columnas; intentar entrar sin token.
- **Entregables:** consola segura + reporte auditable.
- **Criterio:** Excel con exactamente 13 columnas; rutas web protegidas.

### Día 8 — Mié 24 jun · Despliegue demo, pruebas, demo y backlog
- **Objetivo:** dejar todo demostrable y documentado.
- **Tareas:** deploy a Railway/Render (D2); README de arranque; **script simulador de ruta** para la demo (H3); ensayo de demo extremo a extremo; checklist final; backlog post-MVP; pulir repo para auditoría.
- **IA:** README, simulador de ruta, limpieza.
- **Humano valida:** ensayo completo de la demo sin romperse.
- **Entregables:** MVP desplegado, demo guionada, docs.
- **Criterio:** demo extremo a extremo corre dos veces seguidas sin fallar.

### Día 9 — Jue 25 jun · Buffer y congelación
- Buffer para imprevistos, corrección de bugs de la prueba de usuario (Neto), congelar `main`, preparar la presentación.

### Vie 26 jun — Presentación.

---

## 18. Riesgos y mitigaciones

| Riesgo | Impacto | Prob. | Mitigación |
| :-- | :-- | :-- | :-- |
| Rastreo en segundo plano inestable / OEM matan el servicio | Alto (núcleo) | Media | Foreground service + notificación persistente; probar en teléfono físico desde D2; plan B = plugin (D1) |
| No poder demostrar movimiento real | Alto | Media | Script simulador de ruta + mock locations; confirmar con Julio (H3) |
| Curva de Kotlin/segundo plano consume días | Alto | Media | Bala trazadora temprana; si D2 no avanza, saltar a plugin |
| Faltan datos reales de destinos/geocercas | Medio | Alta | Seed provisional; pedir a Julio (H2) con fecha tope D3 |
| Demo dependiente de laptop/red | Medio | Media | Deploy gratis (D2) |
| Ingesta sin auth → datos basura | Medio | Media | Token de dispositivo (H5) |
| Solo dev + alcance amplio en 8 días | Alto | Media | Priorizar slices obligatorios; post-MVP claro; fin de semana como buffer |
| Auditoría de código encuentra deuda | Medio | Media | Capas limpias, commits por slice, validación de todo código IA |
| Tiles OSM con límites en demo | Bajo | Baja | Cachear/usar provider alterno si falla |
| Geocercas con falsos positivos (ruta pasa cerca del destino) | Medio | Baja | Radio ajustable + requerir punto dentro en lote, no en tránsito |

---

## 19. Checklist final (antes del 26)

**App Android**
- [ ] Abre directo en el formulario (sin login)
- [ ] 7 campos con validaciones del doc §3.2 (numéricos estrictos, placas flexibles MX, destino dropdown)
- [ ] Foto de carga obligatoria (cámara o galería)
- [ ] Rastreo por lotes (captura 2–3 min, envío 15–20 min, GZIP)
- [ ] Distance filter (300–500 m) e hibernación por inactividad
- [ ] Botón "Finalizar viaje" con Observaciones obligatorias
- [ ] Batería <10%/jornada medida en prueba real

**Portal web**
- [ ] Login y rutas protegidas
- [ ] Mapa de tránsito activo (refresco 15–20 min)
- [ ] CRUD de destinos/geocercas (centro+radio)
- [ ] Forzar cierre con Observaciones
- [ ] Gestión de monitoristas (alta/baja)
- [ ] Exportar .xlsx con las 13 columnas exactas

**Backend / sistema**
- [ ] `POST /trips`, `POST /trips/:id/locations` (GZIP), cierres, destinos, auth, export
- [ ] Cierre automático por geocerca + orden de detener GPS
- [ ] Validación en todos los endpoints + exception filter
- [ ] Secretos fuera del repo; `.env.example` presente

**Entrega**
- [ ] Deploy demo accesible (o túnel listo)
- [ ] Script simulador de ruta para la demo
- [ ] README de arranque (local) y de despliegue
- [ ] ADRs y specs actualizadas
- [ ] `main` limpia y verde para auditoría
- [ ] Demo ensayada sin fallos
- [ ] Backlog post-MVP escrito

---

## 20. Mejoras sugeridas al prompt / documentación / enfoque

1. **El prompt sobredimensiona Docker/CI/CD/despliegue cloud** que el proyecto marca explícitamente como NO requeridos. Se degradaron a mínimo demostrable. *Sugerencia:* en futuros prompts, dejar que el documento del proyecto gobierne el alcance de infra.
2. **El prompt no menciona que es una competencia ni que el código será auditado.** Eso cambia prioridades (calidad de repo, demo robusta). Está incorporado en el plan; conviene tenerlo explícito en cualquier brief.
3. **El doc de batería mezcla iOS (CoreMotion/CoreLocation)** aunque el alcance es solo Android → ruido. Confirmar exclusión de iOS (H11).
4. **"Tiempo real" vs "refresco 15–20 min"** es una contradicción de expectativas en el propio doc (§4.1 dice "tiempo real" pero también "cada 15–20 min"). Alinear el lenguaje con el negocio (H7).
5. **Falta el insumo más crítico para una demo creíble:** los destinos reales con coordenadas y radios (H2). Sin eso la geocerca se prueba con datos inventados. Pedirlo el Día 1–3.
6. **Estrategia probada > recrear:** el doc describe a mano lo que ya hacen librerías de background-geolocation; vale la pena evaluar usarlas (D1) en lugar de reimplementar la administración de energía desde cero, dado que eres un dev solo en 8 días.
7. **Demostrabilidad del GPS:** definir desde ya cómo se mostrará el movimiento el día de la presentación (simulador de ruta), porque manejar un camión real en vivo no es viable (H3).

---

## 21. Backlog de bloques (ejecutable)

> La unidad atómica de trabajo es el **bloque** (`fase.bloque`). Cada uno: alcance in/out, checkboxes, "Hecho cuando:" medible. Etiqueta de módulo: `BE` backend · `WEB` web · `AND` android · `INF` infra · `DOC` docs/specs · `PLAN` este plan. Se ejecutan con `/bloque <id>`. Orden = dependencia + riesgo alto temprano (NO por módulo).

### Fase 0 — Diseño (puro diseño, sin código) · 17–19 jun

Cierra los huecos que dependen de nosotros (distintos de H1–H11, que dependen de terceros). Al terminar, cada bloque de código tendrá contrato.

#### Bloque 0.1 — Product Spec + AI Dev Spec `[DOC]` · deps: — · **diferido (cubierto por otros docs)**
**Incluye:** formalizar problema, usuarios, objetivo, alcance/fuera-de-alcance, métricas de éxito, flujos principales (gran parte ya en PLAN §1–5); reglas de uso de IA (PLAN §16).
**NO incluye:** detalle funcional ni técnico.
- [ ] `docs/product-spec.md` — **no creado a propósito.** Contenido cubierto por `README.md` + PLAN §1–5. Bajo valor consolidarlo; reabrir solo si la auditoría lo pide.
- [ ] `docs/ai-dev-spec.md` — **no creado a propósito.** El uso de IA es metodología interna (`~/.agents/METODOLOGIA.md` + `CONTEXT-AI.md`), no entregable del producto (ver ADR-011 eliminada).
**Hecho cuando:** un revisor entiende qué se construye y para quién sin leer el doc fuente. → **Se cumple vía README + PLAN; no se materializa archivo aparte.**

#### Bloque 0.2 — Functional Spec + máquina de estados `[DOC]` · deps: 0.1 · **[x] (pendiente confirmar)**
**Incluye:** casos de uso, máquina de estados del viaje, reglas de negocio, validaciones campo a campo, errores esperados, criterios de aceptación.
**NO incluye:** endpoints/contratos (eso es 0.3), esquema de tablas (0.4).
- [x] `docs/functional-spec.md` con las 9 secciones
- [x] Máquina de estados (diagrama + tabla de transiciones)
- [x] Validaciones de los 7 campos del formulario (incl. regex placa MX)
- [x] Supuestos a validar marcados (S-01 a S-07)
**Hecho cuando:** puedo derivar de aquí cada endpoint y cada tabla sin volver a inventar reglas.

#### Bloque 0.3 — API Spec (OpenAPI) `[DOC]` · deps: 0.2 · **[x] (pendiente confirmar)**
**Incluye:** endpoints, métodos, request/response, errores, auth, ejemplos JSON.
- [x] `docs/api-spec.md` (web + móvil, 2 guards, ejemplos JSON, validaciones de ingesta)
**Hecho cuando:** un front podría mockear la API solo con este doc.

#### Bloque 0.4 — Database Spec `[DOC]` · deps: 0.2 · **[x] (pendiente confirmar)**
**Incluye:** entidades (Trip, Location, Destination, User), campos, relaciones, índices, datos sensibles, borrado. Mapear a las 13 columnas del reporte.
- [x] `docs/database-spec.md` (4 entidades, enums, índices, mapeo 13 columnas, borrador `schema.prisma`)
**Hecho cuando:** un revisor dibuja el diagrama sin preguntarme nada.

#### Bloque 0.5 — ADRs 001–012 `[DOC]` · deps: 0.1 · **[x] (pendiente confirmar)**
**Incluye:** redactar cada ADR (contexto, decisión, alternativas, consecuencias +/−, riesgos, estado). Hoy solo están como filas en PLAN §14.
- [x] `docs/adr/ADR-001..012.md` (11 archivos en `docs/adr/`; ADR-011 eliminada por diseño)
**Hecho cuando:** cada decisión técnica tiene su porqué escrito y auditable.

#### Bloque 0.6 — UI/UX Spec `[DOC]` · deps: 0.2 · **[x] (pendiente confirmar)**
**Incluye:** pantallas web + Android, navegación, componentes, estados carga/vacío/error (referencia Figma del doc).
- [x] `docs/uiux-spec.md` (brief con límites duros + lista "NO diseñar", 5 pantallas móvil + 6 web, estados transversales)
**Hecho cuando:** sé qué pantallas construir y qué estados maneja cada una.

#### Bloque 0.7 — Decomponer Slices 0–8 en bloques `[PLAN]` · deps: 0.2–0.6 · **[x] (pendiente confirmar)**
**Incluye:** convertir los vertical slices en Fases 1–N con bloques ejecutables (checkboxes + "Hecho cuando").
- [x] Fases 1–9 escritas en este §21 (abajo)
**Hecho cuando:** todo el camino a la demo está en bloques tomables con `/bloque`.

### Insumos de coaching seniors (2026-06-17) — a integrar en las specs

| Acción | Dónde aterriza | Estado |
| :-- | :-- | :-- |
| Auditoría `createdBy` / `createdAt` (y `updatedAt`) en entidades | Database Spec (0.4) | Pendiente |
| Validar timestamps **no futuros** + coords con rango válido + bbox MX de cordura. **NO** rechazar coords "fuera de geocerca" (es la ruta) | Functional Spec (0.2) + API Spec (0.3) | Pendiente |
| `tripToken` + identidad de dispositivo para ingesta sin login | ADR-007 + API Spec (0.3) | Diseño definido, falta ADR |
| Rechazar coords de viaje terminado / otro dispositivo (lo cubre `tripToken` + invariante S-05) | ADR-007 | Pendiente |
| `lastLocationAt` para rate-limit de ingesta + rate-limit básico | Database Spec (0.4) + API Spec (0.3) | Pendiente |
| Una sola API, rutas `/api/web/*` (Guard JWT) y `/api/mobile/*` (Guard tripToken) — NestJS Guards, no AOP | Technical Spec + ADR-007 | Pendiente |
| `syncState` (PENDING/SENT/FAILED) en cola local Android | UI/UX + diseño Android | Pendiente |
| Validar imágenes (tamaño/tipo) al subir | Functional Spec (0.2) | Pendiente |
| Almacenamiento nube (S3/R2/B2, pre-signed URLs) | ADR-008 / post-MVP | Diferido |

### Fases 1–N — Implementación (decompuesto en Bloque 0.7, 2026-06-18)
> Orden = dependencia + riesgo alto temprano. Etiquetas: `BE WEB AND INF SCRIPT DOC`. Cada bloque se toma con `/bloque <id>`. Lo que NO depende del diseño visual (backend, bala trazadora) puede avanzar mientras Rogelio diseña el UX/UI.

#### Fase 1 — Cimientos + bala trazadora *(ataca el riesgo #1 temprano; independiente del diseño)*
- [x] **1.1 `[INF]`** Scaffolding monorepo (`/backend /web /android /scripts`), `git init`, `.gitignore`, `.env.example`, `docker-compose.yml` (Postgres). **Hecho cuando:** `docker compose up` levanta Postgres y el repo tiene estructura ADR-001. *(2026-06-21: hecho. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **1.2 `[BE]`** NestJS base + Prisma + `schema.prisma` (de `database-spec.md` §10) + 1ª migración + índice único parcial RN-11. **Hecho cuando:** la API arranca y migra contra Postgres; tablas creadas. *(2026-06-21: hecho. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **1.3 `[WEB]`** React+Vite+TS base + Leaflet con mapa vacío. **Hecho cuando:** `npm run dev` muestra un mapa OSM. *(2026-06-21: hecho, verificado con screenshot Playwright. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **1.4 `[AND]`** Proyecto Kotlin vacío que compila y arranca en emulador. **Hecho cuando:** la app abre una pantalla en el emulador. *(2026-06-22: hecho, Kotlin+Compose, verificado en emulator-5554 con captura. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **1.5 `[AND+BE+WEB]` Slice 0 — Bala trazadora:** Android manda 1 coord hardcodeada → endpoint desechable → DB → punto en mapa web. **Hecho cuando:** veo el punto en el mapa desde un envío real del emulador. *(2026-06-22: hecho, E2E verificado: tap emulador → fila en Location → punto rojo en mapa Leaflet del portal. ✔ Confirmado por Rogelio 2026-06-22)*

#### Fase 2 — Inicio de viaje + foto (Slices 1 y 8)
- [x] **2.1 `[BE]`** `GET /api/mobile/destinations` + `POST /api/mobile/trips` (DTO, validación 7 campos, `clientRequestId` idempotente, tripToken derivado por HMAC y hasheado en BD, deviceId, RN-11, snapshot inmutable de geocerca). **Hecho cuando:** curl crea viaje "En ruta" y devuelve tripToken+geocerca; repetir exactamente la solicitud devuelve el mismo viaje/token y no duplica registros. *(2026-06-21: hecho, verificado curl; foto multipart → 2.2. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **2.2 `[BE]`** Subida de foto multipart (validar tipo/tamaño, guardar en disco). **Hecho cuando:** la foto se persiste y se sirve. *(2026-06-21: hecho, verificado curl; huérfano-en-rechazo pendiente para 8.1. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **2.3 `[AND]`** Pantalla M2 (7 campos + validaciones + foto + dropdown destinos) → `POST /trips`. **Hecho cuando:** un viaje creado en el emulador aparece en la BD. *(2026-06-22: hecho, Compose; viaje EN_RUTA creado desde emulador aparece en BD con 7 campos+foto+deviceId. ✔ Confirmado por Rogelio 2026-06-22)*
- [x] **2.4 `[WEB]`** Lista/tarjetas de viajes activos. **Hecho cuando:** el viaje creado se ve "En ruta" en web con su foto. *(2026-06-21: frente web hecho y verificado con Playwright; backend ya en 20f1ddd. ✔ Confirmado por Rogelio 2026-06-22)*

#### Fase 3 — Rastreo por lotes + energía (Slice 2) *(núcleo, riesgo)*
- [x] **3.1 `[AND]`** FusedLocation captura pasiva (`accuracyMeters`) + Room cola local y estado completo del viaje (`tripToken`, snapshot, puntos, cierre pendiente). **Hecho cuando:** se acumulan puntos y la app restaura M3 tras reiniciar proceso/app sin perder el viaje. *(2026-06-22: hecho. Room (`active_trip` fila única + `location_queue`) + `TripRepository`; `LocationCapture` (FusedLocation HIGH_ACCURACY + getCurrentLocation seed); M3 `EnRutaScreen` restaurada vía Flow; M2 persiste viaje → navega solo a M3. **Verificado en emulador:** ruta GPS simulada → 18 puntos acumulados; force-stop del proceso → reabre en M3 con el viaje intacto; flush debug "17/17" → 18 filas en `Location`. Gates Android verdes. Pendiente confirmar humano.)*
- [x] **3.2 `[AND]`** Distance filter + ActivityRecognition (hibernación) + Foreground Service + notificación. **Hecho cuando:** el servicio sobrevive en 2º plano en el emulador. *(2026-06-22: hecho. `TrackingService` (FGS tipo `location` + notificación fija) aloja la captura, antes en la pantalla; `ActivityTransitionReceiver` conmuta MOVING↔HIBERNATING; distance filter 25 m corta los puntos con el camión quieto. **Verificado:** `dumpsys` muestra `isForeground=true types=00000008(location)`, proc en adj=50 con la app en HOME; la cola creció y el "Último" cambió a un fix mandado en 2º plano; notificación visible mostrando "camión detenido" (la ruta de hibernación corrió). Gates Android verdes. Pendiente confirmar humano.)*
- [x] **3.3 `[AND]`** WorkManager envío por lotes GZIP cada 15–20 min con reintentos. **Hecho cuando:** un lote GZIP llega al backend. *(2026-06-22: hecho. `SyncWorker` (CoroutineWorker) drena la cola de Room → `ApiClient.sendBatch` (GZIP via GZIPOutputStream + `Content-Encoding: gzip`); `batchId` determinista `UUID.nameUUIDFromBytes(tripId+ids)` (reintento idéntico = mismo batchId = idempotente); `markSent` sólo tras éxito, `Result.retry()` si falla. `SyncScheduler`: periódico 15 min (mín. WorkManager) con constraint de red + backoff exponencial, programado por `TrackingService` al arrancar / cancelado al cerrar. Botón debug ahora encola `syncNow` (worker real, no el flush inline). **Verificado en emulador:** viaje creado → 5 puntos en Room (0 en backend) → "Sincronizar" → WorkManager subió el lote, backend 0→4 puntos bajo UN solo batchId (`f8de9449…`, UUID v3). Gates Android verdes. Pendiente confirmar humano.)*
- [x] **3.4 `[BE]`** `POST /api/mobile/trips/:id/locations` (Guard tripToken, GZIP, validaciones de ingesta §5, `accuracyMeters`, idempotencia `batchId`, `lastLocationAt`). Todos los puntos válidos alimentan ruta; sólo los dos más recientes elegibles por precisión alimentan geocerca. **Hecho cuando:** el lote persiste; duplicado se ignora y la consulta fresca selecciona correctamente 0–2 puntos. *(2026-06-22: hecho. `IngestBatchDto` (batchId UUID + points[]); `addBatch` filtra semántica (bbox MX + futuro), `createMany skipDuplicates` (idempotencia vía índice único tripId+batchId+recordedAt), avanza `lastLocationAt`, selecciona ≤2 puntos `accuracyMeters≤50` para geocerca (cierre = Fase 4), responde `stopTracking:false`. GZIP lo infla body-parser solo. **Verificado:** unit 3/3, e2e 16/16 (incl. idempotencia stored 0 + bbox skip), y curl con lote REALMENTE gzippeado (190 B) → stored:2, geofenceCandidates:2. Pendiente confirmar humano.)*
- [x] **3.5 `[WEB]`** Mapa de tránsito W1 con polling 15–20 min. **Hecho cuando:** el camión se mueve en el mapa (batería = objetivo de diseño, NO verificable sin teléfono — ADR-004/H6). *(2026-06-22: hecho. `App.tsx` re-consulta `GET /api/web/trips` cada `POLL_MS` (env `VITE_POLL_MS`, default 15 min) + botón "Actualizar" + "Actualizado HH:MM"; un fallo de polling no borra el mapa; `inFlight` evita solapes. `TripsMap` filtra a EN_RUTA (mapa de tránsito). **Verificado con Playwright (evaluate, no screenshot — capturas salen en blanco en este entorno):** 1 solo camión rojo en el mapa; moví el punto en backend (emulador→sync, lng -100.3150→-100.2750) + "Actualizar" → el marcador rojo pasó de (593,241) a (651,305) y el timestamp avanzó. Gates web lint+build verdes. Pendiente confirmar humano.)*

#### Fase 4 — Cierres automático y manuales (Slices 3 y 4)
- **4.1 `[BE+AND]`** Haversine sobre hasta los dos puntos válidos/precisos más recientes y snapshot idéntico: Android anticipa llegada y dispara sync prioritario sin detener GPS; backend automático cierra si cualquiera está dentro, fuera devuelve `false`. **Hecho cuando:** lote completo queda en ruta pero sólo los dos frescos deciden; precisión insuficiente no cierra. *(2026-06-22: hecho. **Backend:** `evaluateGeofence` con `haversineMeters` (ADR-012) sobre los ≤2 puntos más recientes `accuracyMeters≤50` vs snapshot centro/radio; si alguno dentro → cierre **atómico** `updateMany WHERE status=EN_RUTA` (AUTO_GEOFENCE+endedAt), responde `stopTracking:true`. `TripTokenGuard` relajado (`findUnique` por hash, cualquier estado) → viaje CONCLUIDO responde `200 + stopTracking:true` y descarta (S-05, cierra el seam del 401). **Android:** `TrackingService.handleFix` dispara `syncNow` prioritario (una vez) si un fix cae a ≤ radio+100 m, sin detener GPS. **Verificado:** unit 17/17, e2e 18/18 (cierra dentro / no cierra fuera / CONCLUIDO descarta), y curl live: lejos→EN_RUTA, centro→CONCLUIDO+AUTO_GEOFENCE+endedAt. La app aún NO detiene GPS al recibir stopTracking (eso es 4.4). Pendiente confirmar humano.)*
- [x] **4.2 `[BE+AND]`** `POST /api/mobile/trips/:id/close` (observaciones, `requestedAt`, `closeRequestId`); cola offline y replay idempotente. **Hecho cuando:** cerrar sin red queda pendiente, al reconectar usa la hora solicitada y no duplica. *(2026-06-22: hecho. Backend en `d8db7a7`; Android: `pendingClose`+`closeRequestId` en Room, `requestClose`, `ApiClient.closeTrip`, `SyncWorker` lo drena con reintento (cola offline). Verificado en emulador con 4.4. Pendiente confirmar humano.)*
- [x] **4.3 `[BE]`** `POST /api/web/trips/:id/close` (admin, observaciones, `closedById`) y transición atómica compartida. **Hecho cuando:** dos cierres simultáneos producen un ganador y el otro recibe `TRIP_ALREADY_CONCLUDED`. *(2026-06-22: hecho. `TripCloseService` compartido (cierre atómico `updateMany WHERE EN_RUTA`); web cierra MANUAL_ADMIN (`closedById` null hasta JWT). e2e: carrera → 409 TRIP_ALREADY_CONCLUDED. Pendiente confirmar humano.)*
- [x] **4.4 `[AND]`** M4 finalizar + M5 concluido + recibir `stopTracking` y detener GPS. **Hecho cuando:** la app deja de rastrear al cerrarse el viaje. *(2026-06-22: hecho. Navegación por estado en `RootScreen` (M2/M3/M4/M5); el servicio sólo corre EN_RUTA → al concluir (geocerca, cierre admin vía `stopTracking`, o cierre operador) se detiene. Room v2 (`fallbackToDestructiveMigration`, caché local). **Verificado emulador:** M3→Finalizar→M4 obs→confirmar→worker cierra→M5 + servicio detenido (dumpsys vacío). ✔ Confirmado por Rogelio 2026-06-22 — botones M4→M5 funcionan.)*
- [x] **4.5 `[WEB]`** W3 forzar cierre con observaciones. **Hecho cuando:** desde la web se cierra un viaje activo con observación. *(2026-06-22: hecho. Botón "Forzar cierre" en tarjetas EN_RUTA → pide observación (`window.prompt`, MVP) → `closeTripAdmin` → refresca. Verificado Playwright: clic+observación → CONCLUIDO/MANUAL_ADMIN en BD. Página de detalle W3 completa = bloque WEB posterior. ✔ Confirmado por Rogelio 2026-06-22 — botón Forzar cierre funciona.)*

#### Fase 5 — Destinos/geocercas (Slice 5) — hecha como parte de 10.5
- [x] **5.1 `[BE]`** CRUD `/api/web/destinations`. **(pendiente confirmar humano)** *(2026-06-23: hecho en 10.5. `DestinationsService` extraído a `DestinationsModule` (compartido web+mobile, DRY); CRUD findAllWeb/create/update/setActive (baja lógica, no borra: viajes referencian destino). Controller `/api/web/destinations` GET/POST/PATCH/:id/deactivate|restore, protegido `JwtAuthGuard`+`AdminRolesGuard` (nuevo, ADMIN/SUPER_ADMIN; doc UX §6.1 validar en backend). DTO radio 100-700. e2e +6 incl. 403 MONITOR.)*
- [x] **5.2 `[WEB]`** W4 CRUD con mapa (centro+radio visualizado). **Hecho cuando:** un destino nuevo aparece en el dropdown de la app. **(pendiente confirmar humano)** *(2026-06-23: hecho en 10.5. Verificado.)*
  - **Decisión confirmada:** radio mínimo **100 m**, máximo **700 m**, default recomendado 100 m. Reflejar en DTO, constraint, OpenAPI y UI.

#### Fase 6 — Auth web + usuarios (Slice 7)
- [x] **6.1 `[BE]`** Módulo auth JWT + Guard JWT + `POST /auth/login`. **(pendiente confirmar humano)** *(2026-06-22: hecho. `AuthModule` con `@nestjs/jwt`+`bcryptjs`; `POST /api/web/auth/login` (público, 401 genérico, compare con hash dummy para no filtrar existencia por timing) + `GET /api/web/auth/me`; `JwtAuthGuard` custom (verifica Bearer JWT, adjunta `req.user`) + `@CurrentUser()`, aplicado explícito en `WebTripsController` (no global → móvil y login intactos); cierre admin ya llena `closedById` real (cierra el TODO). Seed idempotente `prisma/seed.ts` (admin@exiros.com / admin1234, env `SEED_ADMIN_*`) vía `npx prisma db seed`. Env nuevos: `JWT_SECRET`, `JWT_EXPIRES_IN`. **Gotcha:** añadir `prisma/seed.ts` movió el build a `dist/src/main.js` → excluido `prisma` en `tsconfig.build.json` para conservar `node dist/main.js`. Verificado: e2e 28/28 (7 nuevos de auth) + unit 21/21 + smoke curl real (login→token, 401 sin/ con token basura, 200 con token, /me, móvil 401 intacto). FUERA, anotado: CRUD usuarios/RolesGuard ADMIN = 6.2; W0 login web + W5 = 6.3.)*
- [x] **6.2 `[BE]`** CRUD usuarios + Guard de rol ADMIN. **(pendiente confirmar humano)** **Decidido 2026-06-22:** modelo con **3 roles** (`SUPER_ADMIN`, `ADMIN`, `MONITOR`) fiel al diseño; Super admin protegido (no baja, no cambio de rol, siempre ≥1) — backend bloquea. Acceso a Usuarios/Destinos exclusivo de Admin+ (validar en backend, no solo ocultar en UI). *(2026-06-23: hecho en 10.6. `UsersService` + controller `/api/web/users` (GET/POST/PATCH/:id/deactivate|restore) con `JwtAuthGuard`+`AdminRolesGuard`. Alta hashea password (bcrypt), email único → 409. Protección super admin (no baja / no cambio de rol → 403). Seed promovido a SUPER_ADMIN. e2e +6 (403 MONITOR / 400 pass corta / 201 / 409 dup / update+baja / 403 baja super admin) → 47/47.)*
- [x] **6.3 `[WEB]`** W0 login + rutas protegidas + W5 gestión usuarios. **Hecho cuando:** sin token no se entra; admin da de alta un monitorista que luego entra. **(pendiente confirmar humano)** *(2026-06-23: COMPLETO. W5 gestión de usuarios hecho en 10.6 (tabla + panel lateral de alta + modal "Dar de baja" + candado para super admin); verificado Playwright: alta real de "María Pérez" monitorista. "¿olvidaste tu contraseña?" = modal informativo, fuera de MVP. Shell+routing = 10.1.)* *(2026-06-22: PARCIAL — adelantado como enabler de 7.2, que necesitaba sesión web. HECHO: W0 login (split-screen al diseño), token+usuario en localStorage, `Authorization` en toda llamada `/api/web/*`, gate de sesión (sin token → login), botón "Salir", 401→logout automático. Verificado en navegador (Playwright). FALTA para cerrar 6.3: **W5 gestión de usuarios** (depende de 6.2 CRUD usuarios) y "¿olvidaste tu contraseña?" (fuera de MVP). Routing real (react-router) no añadido: el portal es una sola vista; el shell+sidebar es bloque WEB posterior.)*

#### Fase 7 — Reportes Excel (Slice 6)
- [x] **7.1 `[BE]`** `GET /api/web/reports/export` .xlsx con las **13 columnas exactas** (exceljs). **(pendiente confirmar humano)** *(2026-06-22: hecho. `ReportsService` + `ReportsController` (`GET /api/web/reports/export`, protegido JWT) con filtros opcionales `from/to/status/destinationId` (DTO validado, enum basura→400). 13 encabezados exactos del doc §6 en `REPORT_HEADERS` (constante única, reutilizada por el e2e); enums→español (`En ruta/Concluido`; `Automático por geocerca/Manual por Operador/Manual por Administrador`); fechas `DD/MM/AAAA HH:MM` en TZ America/Mexico_City; Duración derivada `HH:MM` (RN-05, vacía si En ruta). Verificado: e2e 32/32 (+4: 401 sin token, headers=13 exactos, filtro status, enum→400) + smoke real: `file` reporta "Microsoft Excel 2007+", 13 columnas en orden, mappings correctos. FUERA, anotado: botón/filtros en la web = 7.2.)*
- [x] **7.2 `[WEB]`** W2 botón exportar + filtros. **Hecho cuando:** el .xlsx tiene exactamente 13 columnas en orden. **(pendiente confirmar humano)** *(2026-06-22: hecho. `ReportsBar` (Estatus/Desde/Hasta + "Exportar a Excel") → `exportReport()` en `api.ts` (descarga blob con `Authorization`, nombre de archivo desde `Content-Disposition`). Backend expone `Access-Control-Expose-Headers: Content-Disposition` para que el portal (otro origen) lea el nombre fechado. **Verificado en navegador real (Playwright):** login→portal→Exportar→descarga `reporte-viajes-2026-06-23.xlsx` (Excel real, 13 columnas, 15 filas). Filtro destino queda para cuando exista el catálogo web (Fase 5). Gates web lint+build OK.)*

#### Fase 8 — Endurecimiento + seguridad + pruebas
- [x] **8.1 `[BE]`** Exception filter global, ValidationPipe global (whitelist), helmet, CORS, rate-limit (throttler), Guard `X-App-Key` bootstrap, límites body/GZIP. **Hecho cuando:** capas de ADR-007 §"Defensa en capas" implementadas. **(pendiente confirmar humano)** *(hecho sesión 2026-06-22 prev., commit `cd5a2d2`. Mantenido: cada endpoint web nuevo (auth/reports/detalle/destinos/usuarios) pasa por el mismo pipeline endurecido + JWT (+ AdminRolesGuard donde aplica).)*
- [x] **8.2 `[BE]`** Jest unit (geocerca, máquina de estados, validaciones) + e2e Supertest (trips, ingesta, cierre). **Hecho cuando:** gates verdes. **(pendiente confirmar humano)** *(hecho prev.; AMPLIADO 2026-06-23: e2e 14→47 cubriendo authz de TODO endpoint nuevo (401 sin token, 403 MONITOR, protección super admin 403, validaciones 400, idempotencia/409). Unit 21. **Pendiente menor (mejora, no bloquea):** unit tests aislados para los services nuevos (Auth/Users/Destinations) — hoy cubiertos vía e2e.)*

#### Fase 9 — Deploy + demo
- **9.1 `[INF]`** Túnel cloudflared (dev) + deploy Railway/Render + Postgres managed (demo).
- **9.2 `[SCRIPT]`** Simulador de ruta (reproduce GPX / mock locations) para la demo (H3).
- **9.3 `[DOC]`** README de arranque + ensayo de demo. **Hecho cuando:** la demo e2e corre 2 veces seguidas sin fallar.

#### Fase 10 — Portal web fiel al diseño (shell + 6 pantallas)
> Referencia obligatoria: `docs/exiros-reference-image/webapp/` + `documentacion UX-UI.md`. Replicar, no improvisar. Ver renderizado (Playwright) antes de entregar cada pantalla. **Decisiones (2026-06-22):** 3 roles fieles (Super admin protegido) · estados-mapa derivados POSPUESTOS (solo En ruta/Concluido por ahora).
> **Corrección 2026-06-22:** el portal actual (vista única con Mapa+tarjetas+Export) está MAL. El export es de **Viajes (W2)**, no de Mapa. La vista única se reemplaza por el shell+sidebar.
- **10.1 `[WEB]`** Shell: sidebar (logo + Mapa·Viajes·Destinos·Usuarios + Cerrar sesión; Destinos/Usuarios solo Admin) + header (nombre/rol) + routing (react-router) entre secciones sin recargar. Reubica el login dentro del shell. **Hecho cuando:** se navega entre secciones por el sidebar; sin token → login; Monitorista no ve Destinos/Usuarios.
- [x] **10.2 `[WEB]`** W1 Mapa "Monitoreo en tiempo real": KPIs (En ruta/Concluidos por ahora), buscador + filtros, capas (Mapa/Satélite/Geocercas/Clusters), clusters. **SIN export.** **(pendiente confirmar humano)** *(2026-06-22: hecho. KPIs clicables En ruta/Concluidos (filtran), buscador (placa/folio/proveedor) + filtros estado/destino/proveedor + Limpiar, `LayersControl` Mapa(OSM)/Satélite(Esri)/Geocercas, leyenda. Verificado Playwright. **DIFERIDO (decisión de Rogelio, no hacer sin avisar):** (a) KPIs/markers de estados derivados Detenido/Sin actualización/Cerca de destino — requieren umbrales que Rogelio difirió; (b) capa **Clusters** — optimización para alto volumen, omitida en MVP (react-leaflet-cluster con react19/RL5 = riesgo de build).)*
- [x] **10.3 `[WEB]`** W2 Viajes: tabla (Folio/Proveedor/Destino/Placa/Estado/Inicio) + filtros (buscador/Estado/rango fechas/Destino) + paginación + **"Exportar a Excel"** (mover aquí el export de 7.2) + ojo→detalle. **(pendiente confirmar humano)** *(2026-06-23: hecho. Tabla con badges de estado, filtros client-side (buscar folio/placa, Estado, rango from/to, Destino), paginación 8/pág, botón verde Exportar (reusa exportReport con filtros estado/from/to). Fila/ojo → `/viajes/:id` (detalle 10.4). Eliminados `ReportsBar` y `TripsList` (reemplazados por la tabla; cierre admin se reubica en el detalle 10.4). Verificado Playwright. Nota menor: el export aún no aplica el filtro Destino (el trip trae nombre, no id; el BE export usa destinationId) — pendiente cuando el listado traiga destinationId.)*
- [x] **10.4 `[BE+WEB]`** W3 Viaje seleccionado: `GET /api/web/trips/:id` (datos+cierre+foto+puntos de ruta) + pantalla detalle (Datos/Cierre/Foto/mapa "Ruta recorrida"). **(pendiente confirmar humano)** *(2026-06-23: hecho. BE `GET /api/web/trips/:id` → TripDetail (campos+cierre+foto+durationMinutes derivada+route[]); 404 si no existe; protegido JWT. e2e +3 (401/200-con-ruta/404), total 35/35. FE: breadcrumb + Datos del viaje + Cierre (tipo español/fin/duración HH:MM/observaciones) + Foto + `RouteMap` (polilínea+inicio/fin+geocerca). Admin: "Forzar cierre" en viajes EN_RUTA (reusa closeTripAdmin, window.prompt MVP). Verificado Playwright.)*
- [x] **10.5 `[BE+WEB]`** W4 Destinos: tabla (Nombre/Centro/Radio/Maps/Estado/Acciones) + modal "Nuevo/Editar destino" con mapa para fijar pin + radio (máx 700 m) + baja/restaurar. **(pendiente confirmar humano)** *(2026-06-23: hecho. BE = Fase 5.1 (CRUD + AdminRolesGuard + enum SUPER_ADMIN migrado). FE: tabla fiel + modal con mapa interactivo (clic fija el centro, círculo del radio). Verificado Playwright: alta real "Patio Vendedor Saltillo" aparece en la tabla. Gates: backend lint+build+e2e 41/41, web lint+build.)*
- [x] **10.6 `[BE+WEB]`** W5 Usuarios: tabla (Nombre/Correo/Rol/Estado/Acciones) + panel lateral "Nuevo usuario" + modal "Dar de baja". Super admin con candado (no baja). **(pendiente confirmar humano)** *(2026-06-23: hecho. BE = Fase 6.2 (UsersService + AdminRolesGuard + protección super admin). FE: tabla fiel + búsqueda + filtro rol + `UsuarioPanel` (slide-over alta/edición) + modal confirm "Dar de baja" + candado deshabilitado para super admin. Verificado Playwright: alta real de monitorista aparece en la tabla. Gates: backend e2e 47/47, web lint+build.)*

---

### Bitácora
- **2026-06-17:** Plan maestro creado a partir de `2026 Exiros alcance MVP On-Route Tracker.md` y `IWA-Exiros - Estrategia Ágil`. Pendientes externos: D1, D2 y respuestas a las 5 preguntas críticas (Julio/seniors).
- **2026-06-17:** Creado `AGENTS.md` (contexto vivo entre sesiones). Adoptado modelo de 3 capas (AGENTS + PLAN + backlog de bloques). Agregado §21 con Fase 0 de diseño. Decisión: módulo = etiqueta, fase = orden de ejecución por dependencia. Arranca Bloque 0.2 (Functional Spec).
- **2026-06-17:** Functional Spec validada con Rogelio. Resueltos S-01..S-07 (S-03 = foto obligatoria bloqueante, cámara o galería). Máquina de estados de 2 estados confirmada. **Backlog v2.0:** estado `En incidencia` (resuelve S-06).
- **2026-06-17:** Rogelio señala que el PLAN trata decisiones como cerradas sin pros/cons. Corregido: ADRs marcadas "🔲 Sin trabajar", se debaten en 0.5. **ADR-011 (uso de IA) eliminada**: es metodología interna, no entregable del proyecto. §15/§17 marcados como borrador pre-Fase-0 (se reconcilian en 0.7). Aclarada relación tracer bullet ↔ API Spec.
- **2026-06-17:** Trabajadas y **Aceptadas** ADR-001 (monorepo split-ready), ADR-002 (monolito modular + NestJS), ADR-003 (React+Vite+Leaflet). Criterio del dev: mejor opción técnica > confort; curva no es factor. Escritas en `docs/adr/`. Pendientes en 0.5: ADR-004 Android (D1), 005 DB, 006 ORM, 007 auth, 008 Docker, 009 deploy (D2), 010 pruebas, 012 geocerca.
- **2026-06-17:** ADR-005 **Postgres** Aceptada (criterio Rogelio: independiente, escala, rápido; duda cubierta por reversibilidad vía Prisma). Creado `infra/eval/docker-compose.yml` (eval PG vs MySQL, desechable). Analizado coaching seniors: ADR-012 **haversine** (spatial/PostGIS = overkill, upgrade path si hay polígonos/miles). Definido concepto **tripToken** (bearer por viaje+dispositivo → resuelve H5 y rechazo de coords de viajes terminados/otro device). Capturados insumos de coaching en §21. **Pushback:** no validar coords "dentro de geocerca" (rompería el rastreo).
- **2026-06-17:** **ADR-006 Prisma** Aceptada (independiente del motor). **H10 resuelto:** escala pequeña (~200 usuarios, bajo volumen, el usuario nunca toca la BD) → el argumento "Postgres escala mejor" NO aplica; Postgres se mantiene por DX/estrictez/hosting gratis, no por escala.
- **2026-06-17 (cierre de sesión):** **Postgres CONFIRMADO** por Rogelio → ADR-005 firme; bloque de datos cerrado. **`AGENTS.md` renombrado a `CONTEXT-AI.md`** (más claro; referencias actualizadas en PLAN y en el propio archivo). Aclarado a Rogelio: METODOLOGIA se auto-carga vía `@import` del CLAUDE.md global; PLAN/CONTEXT-AI se leen manualmente (no hay memoria persistente). **Próxima sesión:** trabajar **ADR-004 (Stack Android, riesgo #1)**, luego ADR-007/008/009/010. Fase 0 docs pendientes: 0.1, 0.3 (API), 0.4 (DB), 0.5 (resto ADRs), 0.6 (UI/UX), 0.7 (decomponer slices).
- **2026-06-18:** **ADR-004 Aceptada — Kotlin nativo** (FusedLocation + ActivityRecognition + Foreground Service + Room + WorkManager) con **Plan B** documentado (plugin cross-platform en debug si la bala trazadora falla en 2º plano). Flutter/RN descartado como principal por defendibilidad en auditoría (núcleo no sería código propio) + licencia en release; Java nativo descartado (Kotlin > Java); plugins gratis descartados (poco fiables en 2º plano = empeoran riesgo #1). **H6 PARCIAL:** Rogelio **no tiene teléfono físico** → demo en **emulador** (UI/permisos/ruta GPS simulada OK; cierre por geocerca demostrable). **Métrica "<10% batería/jornada" y supervivencia OEM = NO verificables hasta dispositivo real** → deuda de validación honesta en ADR-004 (no se reportará "cumplido"). **Próxima sesión:** ADR-007 (auth: JWT web + tripToken móvil, diseño ya definido), luego 008/009/010, y docs Fase 0 (0.1, 0.3, 0.4, 0.6, 0.7).
- **2026-06-18:** **Todas las ADRs cerradas** (007 auth JWT+tripToken · 008 Docker solo PG local · 009 deploy túnel+Railway *pend. confirmar Julio* · 010 Jest unit + Supertest e2e, manuales en emulador). **Bloque 0.5 COMPLETO.** Rogelio expresó urgencia (2 días en diseño, 0 código) → decisión: **no sobre-deliberar specs**; comprimir Fase 0 restante a lo que alimenta código directo. **Plan acordado:** las specs de alto valor son **0.4 (DB → schema Prisma)** y **0.3 (API → contratos)**; 0.1 (Product) ya está casi todo en PLAN §1–5 y 0.6 (UI/UX) se hace ligero. Ruta a código: cerrar 0.4 + 0.3 compactas → scaffolding monorepo + bala trazadora (Slice 0). **Pendientes externos vivos:** D2 (Julio), H2 destinos reales (Julio, tope D3), H11 iOS (Julio).
- **2026-06-18:** **Seguridad del endpoint público reforzada** (preocupación de Rogelio: app sin login → ingesta pública). Aclarado: **AOP no existe en NestJS** → la capa transversal = Guards+Interceptors+Pipes+Filters. **ADR-007 ampliada** con "Defensa en capas" + capas MVP #8–12 (tripToken hasheado, idempotencia por batchId, chequeo de teletransporte, helmet/CORS, rate-limit de borde Cloudflare) y upgrade path post-MVP (HMAC, Play Integrity, WAF). Regla de oro escrita: **tratar todo dato entrante como hostil**. Creado **`docs/prompt-aprende-proyecto.md`**: prompt reutilizable para que en sesiones nuevas el agente actúe como mentor y exponga el proyecto (Rogelio quiere aprender programación/ciberseguridad, no solo delegar).
- **2026-06-18:** **Bloque 0.4 (Database Spec) HECHO** → `docs/database-spec.md`. 4 entidades (User, Destination, Trip, Location), 3 enums, mapeo explícito a las **13 columnas** (Duración Total NO se almacena, se deriva), borrador `schema.prisma` listo para código. Decisiones de modelo: `providerNumber`/`folio` = **String** (identificadores con posibles ceros a la izquierda, no cantidades); coords = **Float**; soft-delete en User/Destination, Trip nunca se borra; auditoría `createdBy/createdAt/updatedAt`. Seguridad en BD: `passwordHash` + `tripTokenHash` hasheados, **no se guarda identidad del chofer** (solo `deviceId` anónimo). **RN-11 reforzada con índice único parcial** (`deviceId WHERE status=EN_RUTA`, vía SQL en migración). **Siguiente:** Bloque 0.3 (API Spec).
- **2026-06-18:** **H2 RESUELTO** por Rogelio: el catálogo de destinos lo crea el Admin desde el CRUD web (datos de **runtime, no build-time**) → deja de bloquear; datos reales solo para demo creíble. Nuevas reglas: **RN-13** interacción mínima en app (solo consume, no crea), **RN-14** catálogo vacío → app bloquea inicio con estado vacío. H2 marcado ✅ en §3.
- **2026-06-18:** **Bloque 0.3 (API Spec) HECHO** → `docs/api-spec.md`. Endpoints web (`/api/web/*` JWT) y móvil (`/api/mobile/*`), formato de error único, códigos, ejemplos JSON de los flujos críticos (login, crear viaje multipart+tripToken, ingesta GZIP con idempotencia y `stopTracking`, cierres, export 13 columnas), validaciones de ingesta. **Descubrimiento de diseño:** "arranque de confianza" — leer destinos y crear viaje ocurren **antes** del tripToken → endpoints bootstrap protegidos con `X-App-Key` (estática, debilidad honesta documentada) + rate-limit; el tripToken protege la ingesta (lo que importa). **Fase 0 casi cerrada:** faltan 0.1 (Product, casi todo en PLAN §1–5 → ligero), 0.6 (UI/UX ligero) y 0.7 (decomponer slices). **Próximo paso de peso: scaffolding del monorepo + bala trazadora (Slice 0).**
- **2026-06-18:** Rogelio revisó la API Spec y detectó 2 cosas: (1) los permisos de **lectura del admin** estaban implícitos → añadida **matriz de permisos §2.2** (ADMIN superset de MONITOR); (2) confirmó/entendió la **separación web vs móvil** (ya existía como `/api/web` vs `/api/mobile`) → formalizada en **§2.1** con la **regla anti-duplicación** (mismo Service, distinto Guard/DTO; NO duplicar lógica de negocio). Buena lectura crítica de la spec por parte del dev.
- **2026-06-18:** **Confirmado con doc fuente:** el cierre por operador es **solo texto** (Observaciones, líneas 119 y 195: "campo de texto") → **NO foto en el cierre**; la única foto es la de carga al inicio. Sin cambios al diseño (ya estaba correcto). Foto en cierre = posible v2.0, no MVP.
- **2026-06-18:** **Bloque 0.6 (UI/UX Spec) HECHO** → `docs/uiux-spec.md`. Escrito como **brief con límites duros** para alimentar a Claude Design (Rogelio va a diseñar el UX/UI): incluye lista explícita **"🚫 NO diseñar"** (anti-scope-creep), 5 pantallas móvil (M1–M5) + 6 web (W0–W5), estados transversales (carga/vacío/error/sin red), restricciones de la app (sin login, botones grandes, interacción mínima). **Fase 0: solo falta 0.1 (Product, ligero/redundante con PLAN) y 0.7 (decomponer slices, para implementación).** Para diseñar, Rogelio debe pasar a la IA: `uiux-spec.md` + `functional-spec.md`.
- **2026-06-18:** Aclarado que **web y móvil son dos plataformas distintas** → diseñar en sesiones separadas (Material Design móvil vs UI escritorio web); comparten marca/dominio/API, NO componentes. Anotado en `uiux-spec.md` §0.
- **2026-06-18:** **Bloque 0.7 HECHO → FASE 0 COMPLETA.** Slices 0–8 decompuestos en **Fases 1–9** con bloques `fase.bloque`, checkboxes y "Hecho cuando" (ver §21). Rogelio arrancó el **diseño UX/UI en paralelo**. **Estrategia acordada:** del lado del código avanzar lo **independiente del diseño** = Fase 1 (scaffolding + bala trazadora) y backend. **Siguiente acción:** Bloque 1.1 (scaffolding monorepo + git init + docker-compose Postgres). 0.1 Product Spec queda como relleno opcional de baja prioridad (redundante con PLAN §1–5).
- **2026-06-18 (CIERRE DE SESIÓN):** Verificado entorno: **Node 22.21, npm 10.9, Docker 27.4 + Compose v2.31, Git 2.50, Java 21** (Nest vía npx). Repo **aún sin `git init`** y sin carpetas `/backend /web /android /scripts` (solo `/docs` e `/infra/eval`). **Pendiente de decisión de Rogelio para arrancar Bloque 1.1 (scaffolding):** 3 opciones planteadas → (A) todo 1.1 con docker-compose Postgres [recomendado], (B) estructura sin Docker (Postgres local propio), (C) saltar directo a backend NestJS+Prisma. **RETOMAR MAÑANA AQUÍ:** preguntar a Rogelio cuál opción y ejecutar Bloque 1.1. Rogelio sigue diseñando UX/UI en paralelo (Claude Design). Nada del working tree es código aún → arrancar limpio.
- **2026-06-19:** **Empaquetado para GitHub.** `git init -b main` + `.gitignore` + `README.md` (portada). Repo privado destino: **`exiros-mvp`** (cuenta `rogerpervaz`); push pendiente de `gh auth login`. Ideas nuevas de Rogelio registradas en §5.4 (I-01 filtro "a pie", I-02 refresh on-demand → Post-MVP por requerir push).
- **2026-06-19:** **Technical Spec creado** → `docs/technical-spec.md` (consolida arquitectura en capas, módulos, estructura monorepo, seguridad transversal; antes disperso en §8–13 + ADRs). **Reorganización de docs:** los dos docs *fuente* (alcance + estrategia) movidos a `docs/fuente/`; enlaces actualizados en README y CONTEXT-AI; `PLAN.md`/`CONTEXT-AI.md` siguen en raíz. **Checkboxes reconciliados:** 0.5 (ADRs) marcado hecho; 0.1 (Product/AI-Dev Spec) marcado **diferido a propósito** (cubierto por README+PLAN, no se materializa archivo). **Decidido con Rogelio:** Technical Spec primero (hecho) → luego Bloque 1.1 scaffolding **opción A** (monorepo + docker-compose Postgres). **RETOMAR AQUÍ:** ejecutar Bloque 1.1 opción A.
- **2026-06-21:** Sesión de preparación (sin código). Creado medidor de tokens **`~/.claude/token-check.sh`** (lee el transcript `.jsonl` → % de ventana de contexto, semáforo: verde <70 / ámbar 70-85 / rojo >85). **Distinción importante:** `/usage` muestra la **cuota del plan** (hard-stop por ventana 5h/semanal, se resetea por hora) ≠ **ventana de contexto** (lo que mide el script; al llenarse hay auto-resumen, no bloqueo). El script NO reproduce la cuota; esa la lee Rogelio de `/usage`. Protocolo acordado para cuando el agente esté "a cargo" de varios bloques: commit + bitácora por bloque (seguro real) + correr `token-check.sh` al cerrar cada bloque. **RETOMAR AQUÍ:** ejecutar **Bloque 1.1 opción A** (scaffolding monorepo + docker-compose Postgres) → luego **1.2** (NestJS + Prisma + 1ª migración). Entorno y specs ya listos; working tree limpio.
- **2026-06-21 (BLOQUE 1.1 HECHO — agente Opus a cargo):** Scaffolding opción A. Creadas carpetas `/backend /web /android /scripts` (con README de propósito) + `/infra/docker-compose.yml` (Postgres 16-alpine, healthcheck, volumen `exiros_pgdata`, defaults sin .env) + `/infra/.env.example`. `.gitignore` y `git init` ya existían (no se rehicieron). **Verificado:** `docker compose -f infra/docker-compose.yml up -d` → contenedor `exiros-postgres` **healthy** en ~9s, `pg_isready` acepta conexiones. Estructura ADR-001 completa. Decisión A/B: compose+env en `/infra` (sigue ADR-001), no en raíz → comando con `-f infra/...`. Diagnóstico de gasto + tips de conservación añadidos a `CONTEXT-AI.md` (sección "Conservación de tokens/sesión"). token-check al cierre: ver siguiente nota. **SIGUIENTE:** Bloque 1.2 (NestJS + Prisma + schema + 1ª migración + índice RN-11).
- **2026-06-21 (BLOQUE 1.2 HECHO):** NestJS scaffold en `/backend` (CLI) + Prisma. **Decisión clave:** Prisma fijado a **6.x** — Prisma 7.8 rompe (`url` fuera del schema + driver adapters obligatorios); para Nest/demo estable, v6 es el combo probado. `schema.prisma` portado 1:1 de `database-spec.md §10` (corregido: enums multi-línea, la spec los tenía en 1 línea = inválido). Migración inicial `20260621224907_init` aplicada + **índice parcial RN-11** (`uniq_active_trip_per_device ... WHERE status='EN_RUTA'`) como SQL crudo. Verificado: 4 tablas creadas, índice presente, `PrismaService`+`PrismaModule` (global) cableados, `ConfigModule` para `.env`, **API arranca** (`Nest application successfully started`, responde en :3000, Prisma conecta). Gates: lint 0 err, build OK, test 1/1. **SIGUIENTE:** Bloque 1.3 (React+Vite+TS + Leaflet mapa vacío).
- **2026-06-21 (BLOQUE 1.3 HECHO):** Vite React-TS en `/web` (React 19, react-leaflet 5, leaflet 1.9). `App.tsx` = mapa OSM a pantalla completa (centro Monterrey, zoom 6); `index.css` ajustado (el default de Vite limitaba `#root` a 1126px). Build verde. **Verificado VISUALMENTE** con Playwright MCP: screenshot muestra tiles OSM, zoom y atribución → mapa renderiza. Artefactos `.playwright-mcp/` añadidos a `.gitignore`. **SIGUIENTE:** Bloque 1.4 (proyecto Kotlin vacío que compila en emulador) — ⚠️ riesgo: requiere Android SDK/emulador, verificar disponibilidad antes.
- **2026-06-21 (DECISIÓN DE SECUENCIA + BLOQUE 2.1 HECHO):** Probado el tooling Android: **SÍ disponible** (`~/Library/Android/sdk` con adb/emulator/build-tools/platforms; AVD `Pixel_3a_API_34_extension_level_7_arm64-v8a` ya creado; sin Android Studio ni `gradle` en PATH → se usaría el wrapper). PERO el primer build Gradle + boot de emulador es caro en tokens. **Decisión (máximo valor verificado por token):** diferir **1.4/1.5/2.3 (Android)** a una sesión dedicada y avanzar Fase 2 por backend (independiente). **Bloque 2.1 hecho:** `GET /api/mobile/destinations` + `POST /api/mobile/trips`. Implementado: `AppKeyGuard` (X-App-Key), `DestinationsService` (único, compartible web/mobile), `CreateTripDto` (class-validator), `TripsService` (tripToken HMAC determinista `trk_live_<hmac>` + hash SHA256 en BD, idempotencia por `clientRequestId`, snapshot geocerca RN-16, RN-11 vía P2002 del índice parcial), `ValidationPipe` global (whitelist) + prefijo global `/api`. **Verificado curl:** 201+token+geofence, repetición idéntica = mismo tripId/token (count=1), 409 payload distinto, 409 RN-11, 400 validación, 401 sin X-App-Key. Secretos `APP_KEY`/`TRIP_TOKEN_SECRET` en `.env(.example)`. **Seam:** `photoPath='PENDING'` hasta el Bloque 2.2. Gates verdes. **SIGUIENTE:** Bloque 2.2 (foto multipart) o 2.4 (web lista de viajes); Android pendiente (ver checkpoint en CONTEXT-AI).
- **2026-06-21 (BLOQUE 2.2 HECHO):** `POST /api/mobile/trips` subido a **multipart** (foto + 7 campos en un request, S-04). `FileInterceptor` + `diskStorage` → `uploads/` con nombre `uuid.ext`; validación `ParseFilePipe` (≤5MB + mimetype jpeg/png con `skipMagicNumbersValidation:true` porque diskStorage no expone buffer). Foto servida por `ServeStaticModule` en `/uploads/<archivo>`. `TripsService` ahora recibe `photoPath` (quitado el seam `'PENDING'`) y limpia huérfanos (`discardOrphan`) en idempotencia/errores del service. **Verificado curl:** 201+foto, GET foto = 200 image/png, .txt→400, idempotente count=1, sin foto→400. **Limitación conocida:** archivos rechazados por ValidationPipe/ParseFilePipe quedan como huérfanos en `uploads/` (el rechazo ocurre antes del service) → limpiar en **8.1** (exception filter global). Gates verdes. **SIGUIENTE:** Bloque 2.4 (web: lista/tarjetas de viajes activos) — necesita un GET de viajes para web; o sesión Android (1.4/1.5/2.3).
- **2026-06-22 (BLOQUE 2.4-web HECHO):** Frente web de 2.4. `app.enableCors({origin: WEB_ORIGIN ?? true})` en `main.ts` (CORS para Vite :5173). Nuevo `web/src/api.ts` (base URL por `VITE_API_URL` con default `localhost:3000`, tipo `Trip`, `fetchTrips`, `photoUrl`); `TripsList.tsx` (tarjetas con badge En ruta/Concluido, foto, folio/placa/destino/inicio, estados loading/error/vacío) + `TripsList.css`; `App.tsx` ahora es shell del portal (header + lista) — el mapa de 1.3 queda en historial, se reintegrará bajo el shell (sidebar) en bloque WEB posterior. `photoPath` se guarda como `/uploads/<archivo>` → URL foto = `API_BASE + photoPath`. **Verificado Playwright:** sembré destino (UUID v4) + creé viaje multipart → la tarjeta se ve "En ruta" con foto (200 image/jpeg), folio, placa, destino. **Fuera de alcance (anotado):** filtros/paginación/export (W2 completo), routing/sidebar, Guard JWT (Fase 6.1). Gates: web lint+build OK, backend lint+build OK. **SIGUIENTE:** sesión Android dedicada (1.4→1.5→2.3) para cerrar Fase 1+2.
- **2026-06-22 (SESIÓN ANDROID — FASE 1+2 COMPLETA: 1.4 + 2.3 + 1.5 HECHOS):** Cerrados los 3 bloques Android pendientes en una sesión. **1.4** proyecto Kotlin+Compose (Gradle 8.10.2 wrapper + AGP 8.7.2 + Kotlin 2.0.21 + Compose BOM 2024.10; minSdk 26/compileSdk 34) que compila y abre pantalla en emulator-5554 (verificado captura). **2.3** pantalla M2 (form 7 campos + dropdown destinos desde API + foto vía PickVisualMedia) → `POST /api/mobile/trips`; `ApiClient` OkHttp, `deviceId` persistido (SharedPreferences, RN-11), `clientRequestId` UUID que se renueva tras éxito. En **debug** el form se siembra con datos de ejemplo + foto de muestra (`res/raw/sample_truck.jpg`) + 1er destino preseleccionado (verificación de un tap); en release arranca vacío. Verificado: viaje EN_RUTA creado desde emulador → fila en BD con 7 campos+foto+deviceId. **1.5** bala trazadora E2E: `TripTokenGuard` (Bearer, hash, solo EN_RUTA) + `POST /trips/:id/locations` (1 punto; batchId generado — lotes GZIP idempotentes = 3.4), `web-trips.service` añade `lastLocation`+centro geocerca, app manda 1 coord hardcodeada (25.6700,-100.3000) con tripToken, `TripsMap` Leaflet (CircleMarker, evita bug iconos PNG con Vite) bajo el shell del portal (fetch elevado a `App`, compartido con la lista). Verificado: tap emulador → fila en `Location` → punto rojo en el mapa web. **Gates verdes:** Android `lintDebug`+`assembleDebug`; backend `lint`+`build`+`test`; web `lint`+`build`. Commits: `ebbe8a7` (1.4), `734d700` (2.3), `1637836` (1.5). **Notas de entorno (caras de averiguar):** sin `gradle`/Studio en PATH → wrapper generado con el gradle 9.4.1 cacheado en `~/.gradle` corrido sobre un settings vacío en /tmp (Gradle 9 exige settings file para la task `wrapper`); KDoc con `/api/mobile/*` rompe el compilador Kotlin (`/*` = comentario de bloque anidado → "Unclosed comment"); emulador `~/Library/Android/sdk/emulator/emulator -avd Pixel_3a_API_34_extension_level_7_arm64-v8a -no-snapshot-save`; `10.0.2.2` = host desde el emulador; build necesita `JAVA_HOME=$(/usr/libexec/java_home -v 21)`. **SIGUIENTE:** decisión de Rogelio — adelantar tests (8.2) y/o seguridad (8.1) vs arrancar Fase 3 (rastreo por lotes).
- **2026-06-22 (PULIDO M2 AL DISEÑO + SUBSET DE TESTS 8.2):** Con Fase 1+2 cerrada y tokens de sobra, Rogelio aportó las **imágenes de referencia** (`docs/exiros-reference-image/` + `documentacion UX-UI.md`) y pidió (1) pulir M2 al diseño y (2) adelantar tests. **(1) M2 restyle** (commit `0db7f6c`): `ui/ExirosTheme.kt` con la paleta del doc (azul `#0D479C`, navy, fondo `#F8FAFC`; colorScheme claro, sin modo oscuro). M2 rehecha al mockup: wordmark `exiros` (x azul), labels arriba, placas en fila, caja "Foto de la Carga" verde con check+nombre+ícono cámara, botón azul "▶ Iniciar viaje". Sin cambios de lógica. Verificado captura == `formulario-android.png`. **(2) Subset 8.2** (commit `cd57e34`): tests unitarios reales (Prisma mockeado, sin DB) de `TripsService` (RN-16 snapshot, RN-15 idempotencia, 409 payload, 400 destino, RN-11 vía P2002), `TripTokenGuard` (401 sin Bearer / no-EN_RUTA, hash+adjunta viaje) y `LocationsService` (batchId/Date, 400 futuro). **12/12 tests verdes** (antes era 1/1 scaffold = hueco H1) → **H1 parcialmente cerrado**. Gates verdes en todo. **Pendiente de H1 (futuro 8.2 completo):** e2e Supertest del flujo móvil + cobertura de `WebTripsService`/`AppKeyGuard`. **Hallazgo de diseño (web, NO ejecutado, anotado para bloques futuros):** el portal del diseño usa **shell con sidebar** (Mapa·Viajes·Destinos·Usuarios) + **W2 = tabla** (no tarjetas) + W1 mapa con KPIs/clusters/filtros; lo que hay (lista de tarjetas + mapa simple de 1.5/2.4) **diverge** de esa IA → alinear cuando lleguen los bloques WEB (sidebar/routing = ~6.x; KPIs/clusters/polling = 3.5+). No rebuildear ahora (fuera de alcance).
- **2026-06-22 (SEGURIDAD 8.1 + TESTS 8.2 COMPLETOS → H1/H2/H3 CERRADOS):** Misma sesión, Rogelio pidió cerrar ambos. **8.1 defensa en capas** (commit `cd5a2d2`): `helmet` (CSP/nosniff/HSTS/COOP) con `crossOriginResourcePolicy:cross-origin` (no romper fotos del portal); `@nestjs/throttler` global (APP_GUARD, 100 req/min IP por env `THROTTLE_*` → **429**); tope body JSON 256kb (`bodyParser:false` + json/urlencoded, multipart 5MB intacto → **413**); `AllExceptionsFilter` global = formato único `{error,message,details?}` (PLAN §8/api-spec, mapea errores de middleware como body-parser, log de rechazos, **borra foto huérfana** en uploads/ cuando un Pipe rechaza = **H3**). Extraído `setupApp()` en `main.ts` compartido por bootstrap y e2e. Verificado curl (helmet/401/413/429/200). **8.2 tests** (commits `cd57e34` unit + `8808e72` e2e): subset unit (TripsService/TripTokenGuard/LocationsService, Prisma mockeado, 12/12) **+ e2e Supertest** (`mobile.e2e-spec.ts`, 13 casos contra app endurecida + Postgres real: AppKeyGuard 401/200, POST /trips 201/idempotencia/409/RN-11/400, WebTrips con/sin lastLocation, ingesta tripToken 401/201/403). **Total 12 unit + 14 e2e verdes.** `main.ts` con `require.main===module` para importar `setupApp` sin arrancar server; `app.e2e` ajustado a `/api`. **H1 cerrado** (tests reales unit+e2e), **H2 cerrado** (defensa en capas; queda comparación constant-time del AppKey como mejora menor), **H3 cerrado** (huérfanos). Gates backend: lint+build+`npm test`(12)+`npm run test:e2e`(14) verdes. **Pendientes del diagnóstico que siguen:** H4 (`/api/web/*` sin JWT = Fase 6.1), H5 (mapa/shell web), H6 (/health), D-A (docs redundantes). **SIGUIENTE:** decisión de Rogelio (Fase 3 rastreo por lotes, o seguir puliendo).
- **2026-06-22 (BLOQUE 3.1 HECHO — arranca Fase 3, rastreo por lotes):** Rogelio eligió Fase 3. **Persistencia local + captura pasiva.** Añadidos a `/android`: plugin **KSP** `2.0.21-1.0.28` (atado a Kotlin 2.0.21) + Room 2.6.1 + `play-services-location` 21.3.0; permisos `ACCESS_FINE/COARSE_LOCATION`. **Room** (`data/LocalStore.kt`): `active_trip` (fila única id=1: tripToken, status, snapshot geocerca centro/radio, proveedor/folio, `pendingClose`) + `location_queue` (cola de puntos con `accuracyMeters`+`sent`); `AppDatabase` singleton; `TripRepository` envuelve el DAO. **`LocationCapture`**: FusedLocation **HIGH_ACCURACY** (no BALANCED: el emulador alimenta el GPS vía `geo fix`, balanced no lo ve) + semilla `getCurrentLocation` para el 1er fix; captura ligada al ciclo de vida de M3 vía `DisposableEffect` (el Foreground Service que sobrevive en 2º plano es **3.2**). **`EnRutaScreen` (M3)**: estado restaurado desde Room por Flow (`MainActivity.RootScreen` enruta M2/M3 con gate de carga para evitar parpadeo); M2 al crear el viaje lo persiste → navega sola a M3. El catálogo de destinos ya devolvía `centerLat/Lng/radiusMeters` → snapshot gratis, sin tocar backend. **Afordancias DEBUG en M3:** "Sincronizar ahora" (drena la cola con el `sendLocation` de 1.5; el lote GZIP real es **3.3**) + "Olvidar viaje (solo local)" para reset de prueba (NO cierra el viaje en backend; el cierre es Fase 4). Quitada la bala trazadora de M2. **Verificado en emulador (stack completo arriba):** ruta GPS simulada con `adb emu geo fix` → puntos acumulándose (llegó a 18); **force-stop del proceso → reabre directo en M3** con el viaje intacto y la cuenta preservada; flush debug "17/17" → **18 filas en `Location`** (Postgres). Gates Android `lintDebug`+`assembleDebug` verdes. **Notas de entorno (caras):** string-template `${X}` NO es constante válida en anotaciones Room `@Query` → literal `id = 1`; lint `ProduceStateDoesNotAssignValue` es falso positivo si asignas dentro de `collect{}` anidado → usar `Flow.map + collectAsState`; `geo fix` necesita prioridad HIGH_ACCURACY para que FusedLocation lo reciba. **SIGUIENTE:** 3.2 (distance filter + ActivityRecognition + Foreground Service + notificación) o 3.4 (endpoint de ingesta robusto) — o cerrar H4 (JWT web) como alternativa barata.
- **2026-06-22 (BLOQUE 3.2 HECHO — rastreo en 2º plano):** El rastreo ahora sobrevive con la app en background / pantalla apagada. **`service/TrackingService`** = Foreground Service tipado `location` (Android 14) con notificación fija; aloja `LocationCapture` (movida fuera de la pantalla M3, que ahora solo observa Room) y escribe cada fix en Room. **`service/ActivityTransitionReceiver`** escucha transiciones STILL↔movimiento (`ActivityRecognition`/`ActivityTransition`) y manda al servicio una orden de hibernación → conmuta entre `LocationCapture.MOVING` (5 s, distance filter 25 m) y `HIBERNATING` (60 s, 50 m). `LocationCapture` ahora toma `CaptureConfig` (intervalo + `minUpdateDistanceMeters`). **Distance filter resuelve el "143 puntos parado"** que vio Rogelio. `MainActivity.RootScreen` arranca/para el servicio según haya viaje activo + permiso (`LaunchedEffect`), pidiendo también POST_NOTIFICATIONS + ACTIVITY_RECOGNITION. Manifest: permisos FGS/FGS_LOCATION/POST_NOTIFICATIONS/ACTIVITY_RECOGNITION/ACCESS_BACKGROUND_LOCATION + `<service foregroundServiceType=location>` + `<receiver>`. **Verificado en emulador:** `dumpsys activity services` → `isForeground=true foregroundId=1 types=00000008` (LOCATION) + notificación canal `tracking`; con HOME el proceso queda en oom-adj 50 (nivel FGS, no background); la cola creció y el "Último" cambió a un `geo fix` enviado estando en 2º plano; la notificación mostró "camión detenido" = la ruta de hibernación se ejecutó. Gates `lintDebug`+`assembleDebug` verdes. **Notas (caras):** lint `MissingPermission` exige `@SuppressLint` aunque envuelvas en `runCatching` (calls de ActivityRecognition); Android 14 exige `startForeground` con `FOREGROUND_SERVICE_TYPE_LOCATION` en los primeros segundos ANTES de cualquier `await` → notificación inicial genérica y luego se actualiza con el destino; **ActivityRecognition NO es 100% verificable en emulador** (sin acelerómetro real; aquí reportó STILL por defecto, sin transiciones de marcha) → la hibernación efectiva queda como objetivo de diseño hasta teléfono real, igual que la batería. **Pendiente seam:** el envío real de la cola sigue siendo el flush DEBUG (3.3 = WorkManager + lote GZIP). **SIGUIENTE:** 3.3 (envío por lotes), 3.4 (endpoint ingesta robusto) o 3.5 (mapa web con polling).
- **2026-06-22 (FASE 4 COMPLETA — cierres):** Ciclo de vida del viaje cerrado. `TripCloseService` compartido (cierre atómico `WHERE EN_RUTA`, idempotente por `closeRequestId`, carrera → 409). 4.1 auto-geocerca (haversine) + guard relajado (CONCLUIDO → 200/stopTracking, descarta). 4.2 cierre operador (offline vía `SyncWorker`+Room) · 4.3 cierre admin web · 4.4 M4/M5 + el servicio sólo corre EN_RUTA (al concluir, GPS off) · 4.5 "Forzar cierre" en la web. Verificado: backend unit 21/21 + e2e 22/22 + curl live; emulador (M3→M4→M5+servicio detenido); Playwright (forzar cierre → MANUAL_ADMIN). Gotchas: tras tocar backend hay que reconstruir+reiniciar `node dist/main.js` (404 con dist viejo). Detalle por bloque en los checkboxes de §Fase 4.
- **2026-06-22 (AUDITORÍA Fase 3↓ + ALINEACIÓN AL SPEC):** A petición de Rogelio, revisión de cabos sueltos Fase 0–3. **Resultado:** todo `[x]`; Fase 0 (0.1 omitido a propósito), Fase 1 y 2 ✔ confirmadas. **Único cabo real e independiente:** la respuesta de 3.4 divergía del contrato `IngestResponse` documentado (api-spec §4 + openapi). **Corregido (alineado al spec):** `addBatch` ahora devuelve **`{ accepted, duplicateBatch, trip:{status,stopTracking} }`** con **HTTP 200** (antes 201 + `{stored,received,skipped,geofenceCandidates,stopTracking}`); `duplicateBatch = valid>0 && accepted==0` (replay). El controller pasa `req.trip.status`. Android `sendBatch` lee `trip.stopTracking` (anidado). La **selección de 2 puntos para geocerca se difiere a Fase 4** (donde la consume el haversine; ya no se calcula en 3.4 al no ir en la respuesta). Tests actualizados: unit 14/14, e2e 16/16; **verificado live**: `{accepted:1,duplicateBatch:false,trip:{status:EN_RUTA,stopTracking:false}}` 200, reenvío `{accepted:0,duplicateBatch:true}`. Limpiados comentarios obsoletos "Slice 0 / bala trazadora" (web-trips.service, api.ts, TripsMap). **D-A cerrado:** `openapi.yaml` declarado fuente normativa en api-spec.md. **Anotado para Fase 4:** el `TripTokenGuard` rechaza viaje CONCLUIDO con **401**, pero el spec quiere **200 + stopTracking:true** (para que la app detenga GPS tras el cierre) → suavizar el guard al implementar el cierre.
- **2026-06-22 (DIAGNÓSTICO DE HUECOS — Fase 1+2, sin tocar lógica):** Auditoría de salud con evidencia (leí código real + corrí gates). **Conclusión general:** el código de Fase 1+2 está cuidado y el plan YA anticipó los huecos grandes en Fase 8 (8.1 defensa en capas, 8.2 tests). Hallazgos con severidad y bloque destino:
  - **H1 (ALTO) → 8.2.** Tests reales **ausentes**: solo `app.controller.spec.ts` (scaffold "Hello World") + `app.e2e-spec.ts` (default Nest). **Cero** cobertura de `TripsService` (idempotencia RN-15, RN-11, snapshot RN-16, `samePayload`), `AppKeyGuard`, `WebTripsService`. Lo verificado hasta hoy es **por curl/Playwright manual**, no automatizado → una rúbrica de auditoría penaliza esto. *Recomendación:* adelantar un subset de 8.2 (unit `TripsService` con Prisma mockeado + e2e Supertest de los 6 casos ya probados: 201/idempotente/409 payload/409 RN-11/400/401) **antes** de abrir más superficie en Fase 3.
  - **H2 (ALTO/seguridad) → 8.1.** Defensa en capas del endpoint público **incompleta** vs ADR-007. *Presente hoy:* `AppKeyGuard` + `ValidationPipe(whitelist)` + límite foto 5MB + CORS (recién, 2.4-web). *Falta:* `helmet` (headers), **rate-limit** (`@nestjs/throttler` NO instalado — verificado en package.json), límite global de body JSON, **exception filter global**, log de rechazos, comparación **constante-time** en `AppKeyGuard` (hoy `!==` directo → timing teórico, menor por clave débil-por-diseño). El Guard de **tripToken** (ingesta) aún no existe = Fase 3. ⚠️ Nota: `enableCors({origin: WEB_ORIGIN ?? true})` deja CORS **abierto** en dev → en prod fijar `WEB_ORIGIN` (env hook ya dejado en `main.ts`).
  - **H3 (MEDIO) → 8.1 (ya anotado).** Huérfanos en `uploads/` cuando el Pipe rechaza antes del service. Mitigado parcialmente: `uploads/` está **gitignored** (no contamina el repo). Cierra con exception filter global.
  - **H4 (MEDIO) → 6.1 (ya planificado).** `/api/web/*` sin Guard JWT: hoy **cualquiera lista todos los viajes** (TODO presente en `web-trips.controller.ts`). Con CORS abierto, desde cualquier origen. No es regresión (era el alcance de 2.4), pero es deuda a cerrar antes de exponer la demo.
  - **H5 (BAJO) → bloque WEB futuro.** El mapa de 1.3 quedó **desplazado** por 2.4-web (App.tsx ya no lo muestra; vive en git). Reintegrar bajo el shell del portal (sidebar Mapa·Viajes·…) cuando exista routing.
  - **H6 (BAJO) → 9.x.** No hay endpoint `/api/health`. Útil para que el auditor/deploy verifique "vivo" sin tocar la BD. Añadir a Fase 9.
  - **H7 (decidido).** Android (1.4/1.5/2.3) bloquea el cierre formal de Fase 1+2 → sesión dedicada (caro en tokens).
  **Gate de tests al cierre:** `npm test` = 1/1 verde **pero es el test de scaffold** (no mide la lógica). Gates lint/build verdes en backend y web.
- **2026-06-22 (DOCS REDUNDANTES — señalado, NO borrado; la consolidación fue decisión de Rogelio):**
  - **D-A (vigilar):** `docs/api-spec.md` (narrativa) **vs** `openapi/openapi.yaml` (contrato, 18 operationId). Dos fuentes de verdad de la API → riesgo de **divergencia** al implementar Fases 3–7. *Recomendación sin borrar:* declarar `openapi.yaml` como **normativo** y añadir una línea al inicio de `api-spec.md`: "documento narrativo; el contrato vinculante es `openapi/openapi.yaml`".
  - **D-B (bajo):** `docs/technical-spec.md` solapa con ADRs + CONTEXT-AI "Stack congelado". Es consolidación intencional; solo mantener sincronía al cambiar stack.
  - **D-C (poda sugerida):** `CONTEXT-AI.md` acumula checkpoints 06-19 / 06-21 / 06-22; el de **06-19 está superado** (su "siguiente acción" = Bloque 1.1, ya hecho) → colapsable a 1–2 líneas históricas. (Rogelio edita CONTEXT-AI; queda a su criterio.)
  - **D-D (menor):** la bitácora de PLAN repite al final el checkpoint 06-19 que ya vive en CONTEXT-AI.
- **2026-06-19 (CHECKPOINT / cierre de sesión):** Creado `openapi/openapi.yaml` (OpenAPI 3.0.3, válido, carpeta propia). La referencia visual del diseño vive en `docs/exiros-reference-image/` (capturas + `documentacion UX-UI.md`). *(2026-06-23: el prototipo `.dc.html` de Claude Design se eliminó del repo por ruido; los assets reales se conservan en `web/src/assets/`.)* Pendientes de ese día (ya resueltos después): push a GitHub, reconstruir el diseño en React. Siguiente de entonces: Bloque 1.1 opción A.
