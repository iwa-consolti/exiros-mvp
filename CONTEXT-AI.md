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
7. `Exiros/docs/exiros-reference-image/` — capturas de referencia UI (android/ + webapp/) + `documentacion UX-UI.md`.

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
- **Backend:** NestJS (TypeScript) ✅ ADR-002. **ORM:** Prisma 6.x ✅ ADR-006. **DB:** PostgreSQL ✅ ADR-005.
- **Web:** React + Vite + TypeScript ✅ ADR-003. **Mapa:** Leaflet + OpenStreetMap (gratis, sin API key).
- **Android:** Kotlin nativo + Jetpack Compose (FusedLocation + ActivityRecognition + Foreground Service + Room + WorkManager) ✅ ADR-004. Gradle 8.10.2 (wrapper) + AGP 8.7.2 + Kotlin 2.0.21 + Compose BOM 2024.10.01 + minSdk 26/compileSdk 34.
- **Auth web:** JWT (pendiente de implementar = Fase 6.1). **Ingesta:** **tripToken** (bearer por viaje+dispositivo) ✅ ADR-007, ya implementado.
- **Fotos:** disco/volumen local del backend (MVP).
- **Excel:** exceljs. **Validación:** class-validator + class-transformer. **Tests:** Jest (unit) + Supertest (e2e API).
- **Geocerca:** círculo (centro+radio) + **haversine** en el service. Sin PostGIS.

## Estructura del repo (monorepo — ADR-001)
```
/exiros-mvp
  /backend   # NestJS + Prisma
  /web       # React + Vite
  /android   # Kotlin + Compose
  /docs      # specs + /fuente + /exiros-reference-image
  /infra     # docker-compose, .env.example
  /openapi   # contrato openapi.yaml
  /scripts   # seed destinos, simulador de ruta
  PLAN.md  CONTEXT-AI.md  README.md
```

## Gates de calidad (verde antes de cada commit)
- **Backend:** `cd backend && npm run lint && npm run build && npm test && npm run test:e2e` (12 unit + 14 e2e; **e2e exige Postgres arriba**).
- **Web:** `cd web && npm run lint && npm run build`.
- **Android:** `cd android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew lintDebug assembleDebug`.
- Para cambios visuales (UI): no basta compilar — hay que **verlo renderizado** (captura/teléfono).
- Marca final `✔ Confirmado` SOLO la pone el humano. El agente: `[x] (pendiente confirmar)`.

## Reglas duras propias
- App Android: **sin login**, abre directo en el formulario. Español.
- ⚠️ **SEGURIDAD CRÍTICA — endpoint de ingesta público:** la app no tiene login → `/api/mobile/*` es la **mayor superficie de ataque**. Defensa en capas (ADR-007) ya montada en 8.1: helmet + Guard tripToken + rate-limit + ValidationPipe estricto + tope de body + Exception Filter + log de rechazos. Tratar cada dato entrante como hostil hasta validarlo.
- **No** lógica de negocio en controllers. **No** endpoints sin validación. **No** subir secretos (`.env` fuera del repo, `.env.example` sí).
- No cambiar arquitectura sin actualizar ADR; no cambiar API sin actualizar API Spec.
- Reporte Excel: **exactamente 13 columnas** del doc §6, sin más ni menos.
- IA: spec antes que código; no aceptar código que no se entienda; no cambios masivos sin revisar.

## Convenciones
- **Bloques (tickets):** id `fase.bloque` (ej. `0.3`, `2.1`); cada uno con módulo, alcance in/out, checkboxes y "Hecho cuando:". Se ejecutan con `/bloque <id>`.
- **Módulos (etiquetas):** `BE` backend · `WEB` web · `AND` android · `INF` infra · `DOC` docs/specs.
- **Ramas:** `main` siempre verde + ramas `feat/slice-...` por bloque. Commits convencionales: `feat: fix: refactor: docs: test: chore:`.

---

## ▶️ CHECKPOINT VIGENTE — 2026-06-22 (LEER ESTO PRIMERO; único checkpoint activo)
**Sesión larga (Opus). Cerrado: Fase 1+2 completa (Android 1.4/2.3/1.5) + M2 al diseño + seguridad 8.1 + tests 8.2. 9 commits, todo verde, nada a medias.**

- **DÓNDE ESTÁ EL PROYECTO:** Backend (NestJS+Prisma) y Web (React+Vite+Leaflet) funcionales y endurecidos. App Android (Kotlin+Compose) crea viajes y manda ubicación. **Fases 1 y 2 = 100% código** (falta solo el ✔ humano de Rogelio). Huecos del diagnóstico: **H1/H2/H3 cerrados**.
- **QUÉ SE HIZO HOY (commits, del más viejo al más nuevo):** `ebbe8a7` 1.4 (proyecto Kotlin+Compose) · `734d700` 2.3 (pantalla M2 → `POST /trips`) · `1637836` 1.5 (bala trazadora emulador→BD→mapa) · `0db7f6c` M2 al diseño Exiros · `cd57e34` tests unit 8.2 · `cd5a2d2` seguridad 8.1 · `8808e72` e2e 8.2 (+ commits de docs). Detalle por bloque en la bitácora de `PLAN.md` (2026-06-22).
- **CÓMO LEVANTAR TODO PARA PROBAR (orden):** (1) `docker compose -f infra/docker-compose.yml up -d` (Postgres). (2) `cd backend && npx prisma migrate deploy && npm run build && node dist/main.js` (:3000, ya endurecido). (3) `cd web && npm run dev` (:5173). (4) Emulador: `~/Library/Android/sdk/emulator/emulator -avd Pixel_3a_API_34_extension_level_7_arm64-v8a -no-snapshot-save`; build+instalar app: `cd android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew assembleDebug && ~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk`. Sembrar destino con **UUID v4** (psql user `exiros`); mobile manda header `x-app-key: dev-app-key-cambia-en-prod`; `10.0.2.2` = host desde el emulador.
- **HUECOS RESTANTES (priorizados):** **H4** `/api/web/*` sin Guard JWT (cualquiera lista viajes) → Fase 6.1. **H5** la web diverge del diseño: falta shell+sidebar (Mapa·Viajes·Destinos·Usuarios), W2 debe ser **tabla** (hoy tarjetas), W1 mapa con KPIs/clusters → bloques WEB (sidebar/routing ~6.x; KPIs/clusters/polling 3.5+). **H6** `/health` → Fase 9. **D-A** `api-spec.md` vs `openapi.yaml` (declarar openapi normativo). Menor: comparación constant-time en `AppKeyGuard`.
- **▶️ SIGUIENTE PASO (decisión de Rogelio al abrir sesión):** **Fase 3 — rastreo por lotes** (camino crítico del producto): **3.1** FusedLocation captura pasiva + Room (cola local + estado del viaje, restaura M3 tras reinicio) · **3.2** distance filter + ActivityRecognition + Foreground Service + notificación (sobrevive en 2º plano) · **3.3** WorkManager envío por lotes GZIP cada 15–20 min · **3.4** `POST /trips/:id/locations` real (GZIP + idempotencia `batchId` + selección 0–2 puntos por precisión) — **endurece el seam que dejó 1.5** · **3.5** mapa W1 con polling. Es sesión Android pesada (presupuesto fresco). ⚠️ El KPI "<10% batería" NO es verificable sin teléfono físico (emulador = Android puro): nunca reportarlo cumplido. **Alternativa más barata:** cerrar **H4** (JWT en `/api/web/*`).
- **AVISO al abrir sesión nueva:** este checkpoint + `PLAN.md` bastan; NO re-explorar el repo. Verificar `git status` limpio antes de tomar bloque. Los ✔ de Fase 1+2 siguen "pendiente confirmar humano" hasta que Rogelio los valide.

## Historial de sesiones (resumen; detalle por bloque en la bitácora de `PLAN.md`)
- **2026-06-22 (sesión larga, la de hoy):** Fase 1+2 completa (Android 1.4/2.3/1.5) + M2 al diseño + 8.1 seguridad + 8.2 tests (12 unit + 14 e2e). → checkpoint vigente arriba.
- **2026-06-22 (corta):** 2.4-web (portal lista viajes desde `GET /api/web/trips` + CORS) + diagnóstico de huecos H1–H7.
- **2026-06-21 (autónoma):** scaffolding 1.1 · NestJS+Prisma 1.2 · mapa Vite/Leaflet 1.3 · backend móvil 2.1 (`POST /trips` + AppKeyGuard + tripToken + RN-11 + snapshot geocerca) · foto multipart 2.2 · `GET /api/web/trips` 2.4-backend.
- **2026-06-19:** `git init`, `docs/technical-spec.md`, contrato `openapi/openapi.yaml` (18 ops); docs fuente → `docs/fuente/`. Decisión: scaffolding opción A (monorepo + docker PG); duplicación de docs aceptada conscientemente; identidad git `rogerpervaz`.
- **2026-06-18:** FASE 0 completa (4 specs + 12 ADRs + backlog Fases 1–9 en PLAN §21).

## Decisiones cerradas (no reabrir sin motivo)
- **ADRs Aceptadas (TODAS — Bloque 0.5 completo):** 001 monorepo split-ready · 002 monolito modular + NestJS · 003 React+Vite+Leaflet · **004 Kotlin nativo (+ Plan B plugin debug)** · 005 PostgreSQL · 006 Prisma · **007 JWT web + tripToken móvil** · **008 Docker solo PG local** · **009 deploy túnel+Railway (pend. confirmar Julio)** · **010 Jest unit + Supertest e2e (manuales en emulador)** · 012 geocerca haversine. **ADR-011 eliminada** (uso de IA = metodología, no entregable).
- **Functional Spec (0.2):** máquina de estados de 2 estados (En ruta → Concluido); S-01..S-07 resueltos (S-03 foto bloqueante cámara/galería).
- **Database Spec (0.4):** 4 entidades (User, Destination, Trip, Location) en `docs/database-spec.md`. `providerNumber`/`folio` = String; coords = Float; Duración NO se almacena (se deriva); soft-delete User/Destination, Trip inmutable; RN-11 = índice único parcial `deviceId WHERE status=EN_RUTA`; no se guarda identidad del chofer (solo `deviceId`). `Trip` lleva `destinationId` + snapshot inmutable de centro/radio (validar geocerca sin reconfigurar viajes activos).
- **API Spec (0.3):** `docs/api-spec.md`. `/api/web/*` (JWT) + `/api/mobile/*`. Bootstrap móvil (leer destinos + crear viaje) ocurre **antes** del tripToken → protegido con `X-App-Key` estática (debilidad documentada) + rate-limit; tripToken protege ingesta. Crear viaje usa `clientRequestId` + token HMAC derivable (sobrevive respuesta perdida). Ingesta = GZIP + `batchId` (idempotencia) + respuesta `stopTracking`. Sólo backend transiciona estado. Roles: ADMIN superset de MONITOR. Formato de error único: `{ error, message, details? }`.
- **UI/UX Spec (0.6) + referencias:** `docs/uiux-spec.md` + `docs/exiros-reference-image/` (capturas reales + `documentacion UX-UI.md`: paleta azul `#0D479C`/navy/`#F8FAFC`, Roboto móvil / Inter web, 5 pantallas móvil M1–M5 + 6 web W0–W5, reglas de negocio §6). **Es referencia visual, no contrato:** si choca con una regla dura (ej. cierre por operador = solo texto, sin foto) o con el alcance del bloque, se señala antes de copiar. Web y móvil = diseño separado.
- **Cierre/geocerca refinado (2026-06-19):** lote completo se guarda para ruta; cierre automático evalúa sólo hasta los 2 puntos válidos más recientes por `recordedAt` y elegibles por `accuracyMeters` (inicial 50 m). Si cualquiera está dentro → backend cierra; manual fuerza con observaciones. Radio 100–700 m. Cierre móvil offline se encola con `closeRequestId/requestedAt`; Room restaura viaje tras reinicio; transición de cierre atómica, segundo actor recibe `TRIP_ALREADY_CONCLUDED`.
- **H2 RESUELTO:** catálogo de destinos lo crea el Admin desde el CRUD web (runtime, no build-time) → no bloquea código. **RN-13** interacción mínima en app (solo consume opciones). **RN-14** catálogo vacío → app bloquea inicio con estado vacío.
- **H7** refresco 15–20 min (configurable). **H10** volumen bajo (~200 usuarios → índices simples).

## Pendientes externos (NO bloquean código — esperan a terceros; seguimos con default)
| # | Tema | Default asumido | Resolver |
| :-- | :-- | :-- | :-- |
| D2 / ADR-009 | Deploy gratis vs solo túnel | Túnel en dev + Railway/Render en demo | Confirmar con Julio que deploy gratis no choca con "cloud no requerido" |
| H11 | iOS fuera de alcance | Sí, fuera | Confirmar con Julio |
| H6-disp | Teléfono físico para batería/OEM | Emulador (batería NO verificable) | Conseguir dispositivo "más adelante" |

## Conservación de tokens/sesión
- **Desactivar servidores MCP que no se usan** (Canva, Google Drive, Playwright hasta que se use) — inflan el system prompt cada turno aunque estén "diferidos".
- **`/clear` o sesión nueva = reset de caché.** Al volver: leer SOLO este `CONTEXT-AI.md` (checkpoint vigente) + `PLAN.md`, no re-explorar el repo.
- **Commit por bloque** = el seguro real contra perder trabajo.
- No re-leer archivos enteros: `grep` + lectura por rangos.

## Notas acumuladas (descubrimientos no-obvios; una línea c/u)
- 2026-06-22: **Foreground Service de ubicación (Android 14)** → `startForeground()` debe llamarse con `FOREGROUND_SERVICE_TYPE_LOCATION` en los primeros ~segundos del `onStartCommand`, **ANTES de cualquier `await`/lectura de Room** (si no, `ForegroundServiceDidNotStartInTimeException`) → arranca la notificación genérica y actualízala después. Necesita permisos `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` + ubicación concedida. Lint `MissingPermission` exige `@SuppressLint` en las llamadas de `ActivityRecognition` aunque las envuelvas en `runCatching`. **ActivityRecognition NO es verificable en emulador** (sin acelerómetro; reporta STILL fijo) — la hibernación es objetivo de diseño hasta teléfono real, igual que la batería.
- 2026-06-22: **Convención de nombres de migración Prisma = `AAAA_MM_DD_NNN_descripcion`** (ej. `2026_06_21_001_init`; AAAA_MM_DD = fecha de creación, NNN = versión correlativa del día). Prisma `migrate dev` genera por defecto el formato `AAAAMMDDHHMMSS_nombre` (un timestamp pegado) → **tras crear una migración, renombrar la carpeta a la convención ANTES de commitear** (si no se mezclan formatos, el orden lexicográfico se mantiene). Para renombrar una YA aplicada: `git mv` de la carpeta **+** `UPDATE "_prisma_migrations" SET migration_name=...` (el nombre se anota en la BD; renombrar solo la carpeta rompe el sync). El checksum es del `migration.sql` (no cambia al renombrar).
- 2026-06-22: **Android sin `gradle`/Studio en PATH** → el wrapper del repo (apunta a Gradle 8.10.2) se generó corriendo el gradle **cacheado** en `~/.gradle/wrapper/dists/.../bin/gradle` sobre un `settings.gradle.kts` vacío en `/tmp` (Gradle 9 EXIGE settings file para la task `wrapper`). Build SIEMPRE con `JAVA_HOME=$(/usr/libexec/java_home -v 21)`. `10.0.2.2` = host de la Mac desde el emulador; `usesCleartextTraffic=true` en manifest para HTTP en dev.
- 2026-06-22: **KDoc/comentario con `/*` ROMPE el compilador Kotlin** ("Unclosed comment") — la secuencia `/*` (ej. al escribir una ruta `/api/mobile/*`) se interpreta como comentario de bloque anidado. No usar `/*` dentro de comentarios.
- 2026-06-22: **e2e backend (`npm run test:e2e`) exige Postgres arriba**; siembra y limpia su propio destino+deviceId. `setupApp()` en `main.ts` es la config endurecida compartida con producción; `bootstrap()` sólo corre si `require.main===module` (para importar `setupApp` sin arrancar server).
- 2026-06-21: **Prisma fijado a 6.x** (no 7). Prisma 7.8 rompe: `url=env()` ya NO va en el schema (se mueve a `prisma.config.ts`) y `PrismaClient` exige driver adapter (`@prisma/adapter-pg`). Si se sube a v7, reescribir datasource + adapter.
- 2026-06-21: **Enums Prisma = un valor por línea** (multi-línea en el `schema.prisma` real).
- 2026-06-21: **Índice parcial RN-11** no se expresa en `schema.prisma` (Prisma no soporta `WHERE`) → vive como `CREATE UNIQUE INDEX ... WHERE status='EN_RUTA'` en la migración inicial. Si se regenera la migración, re-añadir ese SQL a mano.
- 2026-06-17: El "AI" del doc de batería = Fused Location nativo, **no IA propia** en el producto.
- 2026-06-17: El doc menciona iOS pero el alcance es **solo Android** → ruido a ignorar. La línea de AWS está **tachada** → cloud no es requisito.
- 2026-06-17: **tripToken** = bearer ligado a UN viaje + dispositivo, emitido en `POST /trips`, en cada lote, invalidado al cerrar. Resuelve ingesta sin login (H5). → ADR-007.
- 2026-06-17: **Geocerca = haversine en el service**, NO PostGIS (overkill). PostGIS es upgrade path sin cambiar de motor. → ADR-012.
- 2026-06-17: **NO validar coords "dentro de geocerca"** como filtro de ingesta — toda la ruta está fuera (la geocerca es solo el destino). Sí validar: lat/lng en rango, timestamp no futuro, bbox MX.
- 2026-06-18: **AOP NO existe en NestJS** (es Spring/AspectJ). La capa transversal = componer **Guards + Interceptors + Pipes + Filters** globalmente. No perseguir AOP en Nest.
- 2026-06-17: **ORM y motor son decisiones separadas.** Prisma soporta Postgres y MySQL → motor intercambiable. Postgres se eligió por DX/hosting-gratis, NO por escala.
- 2026-06-17: **No tengo memoria persistente entre sesiones.** METODOLOGIA se auto-carga vía `@import` del CLAUDE.md global; `PLAN.md` y `CONTEXT-AI.md` NO → leerlos al inicio. Estos archivos SON la memoria.
- 2026-06-18: **GPS/energía/permisos = APIs de Android**, Kotlin es solo el lenguaje. `FusedLocationProvider` fusiona GPS+WiFi+celular. Permisos runtime A13/14: ubicación precisa + **2º plano** (clave) + activity recognition + foreground service + notificaciones + cámara/galería.
- 2026-06-19: **Ideas en evaluación (PLAN §5.4):** **I-01** filtro "operador a pie" (mini-geocerca dinámica ~50–80 m + ActivityRecognition). **I-02** botón "Actualizar ubicación" on-demand desde la web → requiere push (FCM/WS) = Post-MVP; alternativa MVP = flag `pendingRefresh` que la app aplica en su siguiente latido.
- 2026-06-18: **Sin teléfono físico → emulador.** El emulador SÍ: UI, permisos, ruta GPS simulada (GPX). El emulador NO: batería real ni battery-killers OEM. → KPI "<10% batería" = objetivo de diseño NO verificado hasta dispositivo real; nunca reportarlo cumplido sin teléfono.
