# Exiros On-Route Tracker — contexto para agentes

> Sigue la metodología global (`~/.agents/METODOLOGIA.md`). Si esta contradice un impulso, gana la metodología; si este archivo contradice a la metodología en algo específico del proyecto, gana este archivo.
> **Este es el archivo de contexto vivo entre sesiones.** Leer SIEMPRE al iniciar sesión, junto con `PLAN.md`. No re-explorar el repo si esto y el plan bastan.
> **Nombre:** este archivo es la instancia para este proyecto de lo que la metodología llama genéricamente "AGENTS.md". Renombrado a `CONTEXT-AI.md` por claridad. NO se auto-carga en Claude Code (busca `CLAUDE.md`); se lee manualmente al inicio de cada sesión.

---

## Qué es
Solución **independiente** de rastreo en ruta de camiones de chatarra (patio vendedor → patio comprador): app Android de acceso libre para operadores + portal web con login para monitoristas Exiros + backend/API único. Núcleo del producto: **rastreo en segundo plano con <10% batería/jornada** y **cierre automático por geocerca**.

## Documentos de verdad (orden de autoridad)
1. `~/.agents/METODOLOGIA.md` — cómo se trabaja (protocolo maestro).
2. `Exiros/CONTEXT-AI.md` — este archivo (contexto específico).
3. `Exiros/PLAN.md` — plan maestro + backlog de bloques + bitácora.
4. `Exiros/docs/technical-spec.md` — plano de arquitectura (capas, módulos, estructura, seguridad).
5. `Exiros/docs/fuente/2026 Exiros alcance MVP On-Route Tracker.md` — alcance/requisitos del cliente (fuente).
6. `Exiros/docs/fuente/IWA-Exiros - Estrategia Ágil-*.md` — reglas de la competencia interna.

## Naturaleza del proyecto (gobierna prioridades)
- **Competencia interna iWA.** Equipo "Solo": **Rogelio con IA**. El equipo ganador continúa el proyecto.
- `main` será **auditado** (César/Emanuel, con rúbrica) y **probado por usuario** (Neto).
- **Calidad de repo + demo que no se rompe pesan tanto como las features.**
- **NO requerido:** despliegue en nube, CD, E2E. → Infra al mínimo demostrable.

## Ventana
- Desarrollo: **16–26 jun 2026**. Hoy de referencia del plan: **17 jun**. Presentación: **vie 26 jun**.
- Puntos con seniors: **19 jun** (dudas) y **23 jun** (arquitectura). Dudas funcionales: **Julio** (PM), cuando se necesiten.
- Sáb 20 / Dom 21 = buffer / ritmo ligero. Día 9 (jue 25) = congelación de `main`.

---

## Stack congelado (de PLAN §10 — no cambiar sin actualizar ADR)
- **Backend:** NestJS (TypeScript) ✅ ADR-002. **ORM:** Prisma ✅ ADR-006. **DB:** PostgreSQL ✅ ADR-005.
- **Web:** React + Vite + TypeScript ✅ ADR-003. **Mapa:** Leaflet + OpenStreetMap (gratis, sin API key).
- **Android:** Kotlin nativo (FusedLocation + ActivityRecognition + Foreground Service + Room + WorkManager) ✅ ADR-004. Plan B: plugin cross-platform en debug si la bala trazadora falla en 2º plano.
- **Auth web:** JWT. **Ingesta:** **tripToken** (bearer por viaje+dispositivo) — diseño definido, falta ADR-007.
- **Fotos:** disco/volumen local del backend (MVP).
- **Excel:** exceljs. **Validación:** class-validator + class-transformer. **Tests:** Jest (+ Supertest e2e API).
- **Geocerca:** círculo (centro+radio) + **haversine** en el service. Sin PostGIS.

## Estructura objetivo del repo (monorepo — ADR-001)
```
/exiros-on-route-tracker
  /backend   # NestJS + Prisma
  /web       # React + Vite
  /android   # Kotlin
  /docs      # specs + /adr
  /infra     # docker-compose, .env.example
  /scripts   # seed destinos, simulador de ruta
  PLAN.md  CONTEXT-AI.md  README.md
```

## Gates de calidad (verde antes de cada commit; el repo aún no existe)
- **Backend/Web:** `npm run typecheck && npm run lint && npm test` (definir comando exacto al hacer scaffolding).
- **Android:** `./gradlew lint testDebugUnitTest` (definir al crear el proyecto).
- Para cambios visuales (UI): no basta compilar — hay que **verlo renderizado** (captura/teléfono).
- Marca final `✔ Confirmado` SOLO la pone el humano. El agente: `[x] (pendiente confirmar)`.

## Reglas duras propias
- App Android: **sin login**, abre directo en el formulario. Español.
- ⚠️ **SEGURIDAD CRÍTICA — endpoint de ingesta público:** la app no tiene login → `/api/mobile/*` es la **mayor superficie de ataque**. NO basta el `tripToken`: hay que componer **defensa en capas** (HTTPS + Guard tripToken + rate-limit por token + ValidationPipe estricto + tope de body/GZIP + Exception Filter + log de rechazos). Detalle completo en **ADR-007 §"Defensa en capas"**. Tratar cada dato entrante como hostil hasta validarlo.
- **No** lógica de negocio en controllers. **No** endpoints sin validación. **No** subir secretos (`.env` fuera del repo, `.env.example` sí).
- No cambiar arquitectura sin actualizar ADR; no cambiar API sin actualizar API Spec.
- Reporte Excel: **exactamente 13 columnas** del doc §6, sin más ni menos.
- IA: spec antes que código; no aceptar código que no se entienda; no cambios masivos sin revisar.

## Convenciones
- **Bloques (tickets):** id `fase.bloque` (ej. `0.3`, `2.1`); cada uno con módulo, alcance in/out, checkboxes y "Hecho cuando:". Se ejecutan con `/bloque <id>`.
- **Módulos (etiquetas):** `BE` backend · `WEB` web · `AND` android · `INF` infra · `DOC` docs/specs.
- **Ramas:** `main` siempre verde + ramas `feat/slice-...` por bloque. Commits convencionales: `feat: fix: refactor: docs: test: chore:`.

---

## Decisiones cerradas (no reabrir sin motivo)
- **ADRs Aceptadas (TODAS — Bloque 0.5 completo):** 001 monorepo split-ready · 002 monolito modular + NestJS · 003 React+Vite+Leaflet · **004 Kotlin nativo (+ Plan B plugin debug)** · 005 PostgreSQL · 006 Prisma · **007 JWT web + tripToken móvil** · **008 Docker solo PG local** · **009 deploy túnel+Railway (pend. confirmar Julio)** · **010 Jest unit + Supertest e2e (manuales en emulador)** · 012 geocerca haversine.
- **ADR-011 eliminada** (uso de IA = metodología, no entregable del proyecto).
- **Functional Spec (Bloque 0.2):** máquina de estados de 2 estados (En ruta → Concluido); S-01..S-07 resueltos (S-03 foto bloqueante cámara/galería).
- **Database Spec (Bloque 0.4):** 4 entidades (User, Destination, Trip, Location) en `docs/database-spec.md` + borrador `schema.prisma`. `providerNumber`/`folio` = String; coords = Float; Duración NO se almacena (se deriva); soft-delete User/Destination, Trip inmutable; RN-11 = índice único parcial `deviceId WHERE status=EN_RUTA`; no se guarda identidad del chofer (solo `deviceId`). `Trip` mantiene `destinationId` y snapshot inmutable sólo de centro/radio para validar con la geocerca asignada sin reconfigurar viajes activos.
- **API Spec (Bloque 0.3):** `docs/api-spec.md`. `/api/web/*` (JWT) + `/api/mobile/*`. Bootstrap móvil (leer destinos + crear viaje) ocurre **antes** del tripToken → protegido con `X-App-Key` estática (debilidad documentada) + rate-limit; tripToken protege ingesta. Crear viaje usa `clientRequestId` y token derivable por HMAC para sobrevivir respuesta perdida. Ingesta = GZIP + `batchId` (idempotencia) + respuesta `stopTracking`. Android anticipa geocerca y hace sync prioritario **sin detener GPS**; sólo backend transiciona: automático exige haversine dentro, manual permite forzar con observaciones. Roles: ADMIN superset de MONITOR (matriz §2.2). Dos espacios, un solo Service (regla anti-duplicación §2.1).
- **UI/UX Spec (Bloque 0.6):** `docs/uiux-spec.md`, brief con límites duros + lista "🚫 NO diseñar" para alimentar a Claude Design. 5 pantallas móvil (M1–M5) + 6 web (W0–W5). **Cierre por operador = solo texto, NO foto** (confirmado en doc fuente líneas 119/195). Para diseñar, pasar a la IA: `uiux-spec.md` + `functional-spec.md`. Web y móvil = sesiones de diseño separadas (distinta plataforma; no comparten componentes).
- **FASE 0 COMPLETA (2026-06-18):** 4 specs (Functional/API/DB/UI-UX) + 12 ADRs + backlog de implementación (Fases 1–9 en PLAN §21). Rogelio diseña UX/UI en paralelo. **Siguiente del lado código: Bloque 1.1 (scaffolding monorepo + git init + docker-compose Postgres).** Avanzar backend/bala trazadora (independiente del diseño).
- **▶️ CHECKPOINT 2026-06-19 (LEER ESTO PRIMERO la próxima sesión, luego PLAN §21):**
  **Hecho esta sesión:** repo `git init -b main` (3+ commits) → empaquetado para GitHub privado `exiros-mvp` (push **pendiente**: `gh` 2.95.0 instalado pero `gh auth status` = NO autenticado; tras autenticar → `gh repo create exiros-mvp --private --source . --push`). Creado **`docs/technical-spec.md`** (plano de arquitectura en capas). Creado contrato **`openapi/openapi.yaml`** (OpenAPI 3.0.3, válido con @redocly, 18 operaciones con operationId) — vive en carpeta propia `/openapi`. Docs fuente movidos a `docs/fuente/`. Checkboxes de PLAN §21 reconciliados. Ideas I-01/I-02 en PLAN §5.4.
  **Decisiones tomadas con Rogelio:** Technical Spec primero (hecho) → Bloque 1.1 scaffolding **opción A** (monorepo + docker-compose Postgres). NO consolidar la duplicación de docs (aceptada conscientemente). Identidad git = `rogerpervaz` (su cuenta GitHub).
  **Diseño web descargado de Claude Design:** carpeta **`Exiros On-Route Tracker/`** (UNTRACKED, en la raíz). Es un prototipo `.dc.html` de alta fidelidad (NO una app): cubre TODAS las pantallas — web Login/Mapa/Viajes/Detalle/Destinos/Usuarios+2 modales (W0–W5), móvil Permisos/Formulario/En curso/Concluido/Finalizar (M1–M5). Reutilizable = markup+CSS inline + Leaflet (mismo stack) como **referencia visual**. Descartable = `support.js` (runtime del editor) y bindings `{{}}`/`<sc-if>`. Hay que **reconstruir en React** (el HTML depende de support.js, no corre como app).
  **PENDIENTE de decidir (no ejecutado):** (1) mover ese diseño a `docs/design/` SIN las imágenes pesadas (`oficina-exiros.jpg` = 6.8 MB duplicado en `assets/` y `uploads/`; `uploads/` trae copia vieja de `uiux-spec.md`) — quedarse solo con los 2 `.dc.html` + `assets/exiros-logo.png`. (2) si Rogelio quiere, armar el **mapa de integración** (pantalla diseño → componente React → operationId del OpenAPI → estados) antes de codear.
  **SIGUIENTE ACCIÓN:** ejecutar **Bloque 1.1 opción A** (scaffolding `/backend /web /android /scripts` + docker-compose Postgres + .env.example + git). Luego portar el diseño a React en `/web` y cablear al `openapi/openapi.yaml`. Entorno OK (Node 22, Docker 27, Java 21). NO re-explorar el repo: este checkpoint + PLAN §21 bastan.
- **ADR-004 Android = Kotlin nativo** (Flutter/RN descartado: núcleo no sería código propio + licencia release; Java descartado: Kotlin > Java; plugins gratis descartados: poco fiables en 2º plano).
- **H7** refresco 15–20 min (configurable; límite batería+datos). **H10** volumen bajo (~200 usuarios, usuario nunca toca la BD → índices simples).
- **Cierre/geocerca refinado (2026-06-19):** lote completo se guarda para ruta; cierre automático evalúa sólo hasta los 2 puntos válidos más recientes por `recordedAt` y elegibles por `accuracyMeters` (inicial 50 m, pendiente tabla). Si cualquiera está dentro → backend cierra; manual fuerza con observaciones. Radio 100–700 m. Cierre móvil offline se encola con `closeRequestId/requestedAt`; Room restaura viaje tras reinicio; transición de cierre atómica y segundo actor recibe `TRIP_ALREADY_CONCLUDED`.
- **H2 RESUELTO:** catálogo de destinos lo crea el Admin desde el CRUD web (datos de **runtime, no build-time**) → no bloquea código; datos reales solo para demo creíble. **RN-13** interacción mínima en app (solo consume opciones, no crea nada). **RN-14** catálogo vacío → app bloquea inicio con estado vacío.

## Pendientes externos (NO bloquean código — esperan a terceros; seguimos con default)
| # | Tema | Default asumido | Resolver |
| :-- | :-- | :-- | :-- |
| D2 / ADR-009 | Deploy gratis vs solo túnel | Túnel en dev + Railway/Render en demo | Confirmar con Julio que deploy gratis no choca con "cloud no requerido" |
| H11 | iOS fuera de alcance | Sí, fuera | Confirmar con Julio |
| H6 | Teléfono físico para batería/OEM | Emulador (batería NO verificable) | Conseguir dispositivo "más adelante" |

> **Todas las ADRs están cerradas.** Lo que sigue NO es diseño de decisiones, es **specs que alimentan código**: 0.4 (DB→Prisma), 0.3 (API→contratos), luego scaffolding + bala trazadora.

## Conservación de tokens/sesión (leer si el gasto preocupa)
> Diagnóstico 2026-06-21: el gasto por turno lo domina el **costo fijo del system prompt** (cache-read/write de 150k+ tokens), NO el trabajo de código. Palancas, de mayor a menor:
- **Desactivar servidores MCP que no se usan** (Canva ~55 tools, Google Drive, Playwright hasta que exista `/web`). Es el ahorro grande: inflan el prompt cada turno aunque estén "diferidos".
- **Cerrar sesión / `/clear` = mejor reset de caché.** Al volver: sesión nueva + leer SOLO este `CONTEXT-AI.md` (checkpoint) en vez de re-explorar el repo.
- **Commit por bloque** = el seguro real contra perder trabajo (ya es el protocolo).
- No re-leer archivos enteros: usar `grep` + lectura por rangos. `token-check.sh` mide la ventana de contexto; `/usage` mide la cuota dura (5h/semana) — son cosas distintas.

## Notas acumuladas (descubrimientos no-obvios; una línea c/u)
- 2026-06-17: El "AI" del doc de batería = Fused Location nativo, **no IA propia** en el producto. No confundir alcance.
- 2026-06-17: El doc menciona iOS (CoreMotion/CoreLocation) pero el alcance es **solo Android** → ruido a ignorar.
- 2026-06-17: La línea de AWS en el alcance está **tachada** en el doc fuente → cloud no es requisito.
- 2026-06-17: **tripToken** = credencial bearer ligada a UN viaje + dispositivo, emitida en `POST /trips`, enviada en cada lote, invalidada al cerrar. Resuelve ingesta sin login (H5) y "no aceptar coords de viaje terminado / otro dispositivo". → ADR-007.
- 2026-06-17: **Geocerca = haversine en el service**, NO PostGIS (overkill para círculos + volumen bajo). PostGIS es upgrade path si hay polígonos/miles de geocercas; Postgres lo soporta sin cambiar de motor. → ADR-012.
- 2026-06-17: **NO validar coords "dentro de geocerca"** como filtro de ingesta — toda la ruta está fuera de las geocercas (la geocerca es solo el destino). Sí validar: lat/lng en rango, timestamp no futuro, bbox MX de cordura.
- 2026-06-17: Seguridad móvil con NestJS = **Guards/Interceptors**, no AOP de Spring. Una sola API, rutas `/api/web/*` (Guard JWT) y `/api/mobile/*` (Guard tripToken).
- 2026-06-18: **AOP NO existe en NestJS** (es paradigma Spring/AspectJ). La "capa de seguridad transversal" que se quiere = componer **Guards + Interceptors + Pipes + Filters** globalmente. Mismo objetivo que AOP, mecanismo nativo. No perseguir AOP en Nest.
- 2026-06-17: **ORM y motor son decisiones separadas.** Prisma soporta Postgres y MySQL por igual → el motor queda intercambiable (cambiar `provider` + regenerar migraciones). Por eso ADR-005 es de bajo riesgo.
- 2026-06-17: Postgres se eligió por DX/estrictez/hosting-gratis, **NO por escala** (a ~200 usuarios da igual). Si la duda vuelve: MySQL sería idéntico en calidad de producto.
- 2026-06-17: **No tengo memoria persistente entre sesiones.** METODOLOGIA se auto-carga vía `@import` del CLAUDE.md global; `PLAN.md` y `CONTEXT-AI.md` NO → leerlos manualmente al inicio. Estos archivos SON la memoria.
- 2026-06-18: **GPS/energía/permisos = APIs de Android**, Kotlin es solo el lenguaje. `FusedLocationProvider` fusiona GPS+WiFi+celular (menos batería). Permisos runtime A13/14: ubicación precisa + **ubicación en 2º plano** (clave) + activity recognition + foreground service + notificaciones + cámara/galería.
- 2026-06-19: **Ideas en evaluación de Rogelio (PLAN §5.4, sin decidir):** **I-01** filtro "operador a pie" (mini-geocerca dinámica ~50–80 m + ActivityRecognition/velocidad → reenviar misma ubicación cuando el operador camina; viable y barato, ya en stack ADR-004). **I-02** botón "Actualizar ubicación" on-demand desde la web → choca con diseño *pull*: requiere push (FCM/WebSocket) = Post-MVP; alternativa MVP = flag `pendingRefresh` que la app aplica en su siguiente latido.
- 2026-06-18: **Sin teléfono físico → emulador.** El emulador SÍ: UI, flujo de permisos, **ruta GPS simulada (GPX)** → demo de cierre por geocerca viable (cubre también H3). El emulador NO: batería real ni battery-killers OEM (es Android puro). → KPI "<10% batería" = objetivo de diseño NO verificado hasta dispositivo real; nunca reportarlo como cumplido sin teléfono.

## Ultimo mensaje que enviaste tu (Opus, arquitecto)


> 4. ¿Los bloques ya son "tickets listos"?
>Parcialmente. Tengo las fases (1–9) y los bloques definidos a alto nivel en PLAN.md §21 — eso es el épica/backlog. Pero un bloque como "1.1
>scaffolding" todavía no está partido en sub-tareas accionables (ej: "instalar NestJS", "configurar ESLint", "docker-compose de Postgres",
>"verificar healthcheck"). Eso es justo lo que la metodología hace al ejecutar /bloque 1.1: lo desglosa en pasos con checkpoints.
> 👉 Si quieres, en la próxima sesión (o ahora si me lo pides) convierto Bloque 1.1 y 1.2 en tickets finos para que veas exactamente qué haré antes
>     de tocar nada. ¿Lo quieres así de granular, o prefieres que el desglose salga al momento de ejecutar el bloque?
>
>5. Playwright para "ver" la vista — sí, recomendado
>
>Para que yo vea cómo avanza el front (tomar capturas, verificar que una pantalla renderiza) necesito una herramienta de navegador. Opciones:
>
>- Playwright (MCP) → me deja abrir el /web, tomar screenshot y verificar la UI yo mismo. Es la que recomiendo para tu caso: ligera y enfocada.
>- "Superpowers" es un paquete más amplio de skills; trae más de lo que necesitas ahora. No lo descartes, pero no es requisito para arrancar.
>
>No hace falta instalarlo ya — recién sirve cuando exista /web con pantallas. Te aviso en su momento y te paso el comando exacto.
