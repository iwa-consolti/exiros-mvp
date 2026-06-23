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
- **Auth web:** JWT ✅ implementado (Fase 6.1: `@nestjs/jwt`+`bcryptjs`, `JwtAuthGuard`+`AdminRolesGuard`, 3 roles SUPER_ADMIN/ADMIN/MONITOR). **Ingesta:** **tripToken** (bearer por viaje+dispositivo) ✅ ADR-007, ya implementado.
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

## ▶️ CHECKPOINT VIGENTE — 2026-06-23 (LEER ESTO PRIMERO; único checkpoint activo)
**FASE 10 COMPLETA (portal web fiel al diseño). Falta del MVP: Fase 9 (deploy+demo). Todo verde. Todo `[x]` pendiente de validación humana.**

- **DÓNDE ESTÁ:** Producto casi completo. (1) **Móvil** (Fase 1–4): crear viaje → rastrear en 2º plano (FGS+Room+WorkManager GZIP) → cerrar (geocerca auto / operador M4 / admin web) → GPS off. (2) **Portal web** (Fase 10, fiel a `docs/exiros-reference-image/webapp/`): shell+sidebar + W0 login + W1 Mapa (KPIs/filtros/capas) + W2 Viajes (tabla/filtros/export Excel) + W3 detalle (datos/cierre/foto/ruta) + W4 Destinos (CRUD+mapa) + W5 Usuarios (CRUD+3 roles+super admin protegido). (3) **Backend** completo: auth JWT + tripToken, 3 roles + `AdminRolesGuard`, reportes Excel 13 columnas, defensa en capas. **Fase 1+2 ✔ confirmadas por Rogelio; el resto = código 100%, pendiente ✔ humano.**
- **QUÉ SE HIZO ÚLTIMA SESIÓN (2026-06-23, commits clave):** `12b6d64` 10.1 shell · `b40dea2` 10.2 Mapa · `5ffd7d6` 10.3 Viajes · `33ebc8f` 10.4 detalle · `fff6243` 10.5 Destinos (Fase 5) · `b5be4c8` 10.6 Usuarios (Fase 6.2). Antes (2026-06-22): `29c82c2` 6.1 JWT · `97b7fd2` 7.1 Excel · `65d6ffc` 7.2 export web. Detalle por bloque en bitácora `PLAN.md`. **No pusheado: `git status` = ahead 8 de origin/main (push lo decide Rogelio).**
- **CÓMO LEVANTAR (orden):** (1) `docker compose -f infra/docker-compose.yml up -d`. (2) `cd backend && npx prisma migrate deploy && npx prisma db seed && npm run build && node dist/main.js` (:3000). **Login web:** `admin@exiros.com` / `admin1234` (lo crea el seed como SUPER_ADMIN; idempotente). (3) `cd web && npm run dev` (:5173). (4) emulador `~/Library/Android/sdk/emulator/emulator -avd Pixel_3a_API_34_extension_level_7_arm64-v8a -no-snapshot-save`; `cd android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew assembleDebug && ~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk`. Ver BD: `cd backend && npx prisma studio`. ⚠️ **Tras tocar el backend, RECONSTRUIR+REINICIAR `node dist/main.js`** (el endpoint nuevo da 404 si corres el dist viejo — pasó con /close). Header móvil `x-app-key: dev-app-key-cambia-en-prod`; `10.0.2.2` = host desde emulador. Mover camión en pruebas: `adb emu geo fix <lng> <lat>` (el Extended Controls "Set Location" está roto en este emulador ARM). Pruebas: web refresca 30s (`web/.env.local`) y app sube 30s (debug).
- **⚠️ FOOTGUN DE PRUEBAS (RN-11):** `pm clear` / "Olvidar viaje (debug)" borran el viaje **local** pero NO el del backend → deviceId con EN_RUTA colgado bloquea crear otro (409). **Reset:** `docker exec exiros-postgres psql -U exiros -d exiros -c "update \"Trip\" set status='CONCLUIDO' where status='EN_RUTA';"`. Tras `pm clear`, esperar a que carguen los destinos antes de "Iniciar viaje".
- **HUECOS CERRADOS:** **H4** (`/api/web/*` ya con Guard JWT; cierre admin registra `closedById`) y **H5** (web alineada al diseño, Fase 10) — RESUELTOS. **RESTANTES:** **H6** `/health` → Fase 9. Diferidos por decisión de Rogelio: estados-mapa derivados (Detenido/Sin actualización/Cerca de destino) + capa Clusters. Menores: constant-time en `AppKeyGuard`; ingesta no exactamente-once entre reintentos; cierres admin/operador con `window.prompt` (MVP); `fallbackToDestructiveMigration` en Room; export de Viajes sin filtro Destino (listado trae nombre, no id).
- **▶️ SIGUIENTE PASO:** **Fase 9 (deploy+demo)** es lo que falta del MVP (túnel/Railway + simulador de ruta + README de demo). Antes, conviene tu validación (abajo).
- **⚠️ PARA ROGELIO (lo que TÚ debes resolver/validar — el agente no puede):**
  1. **VALIDAR** los bloques `[x] (pendiente confirmar)`: levanta el sistema, entra al portal (admin@exiros.com/admin1234), recorre Mapa/Viajes/detalle/Destinos/Usuarios, exporta el Excel. Marca `✔ Confirmado` lo que apruebes.
  2. **Decisiones diferidas** (pospuestas por ti, reabrir si las quieres en el MVP): (a) estados-mapa derivados **Detenido/Sin actualización/Cerca de destino** (faltan umbrales); (b) capa **Clusters** del mapa.
  3. **App Android NO re-probada esta sesión**: el refactor del backend (módulo destinos) no cambia el contrato móvil, pero no reinstalé/probé el APK. Conviene un smoke móvil antes de la demo.
  4. **Datos de prueba en la BD dev** que creé al verificar: destino "Patio Vendedor Saltillo" y usuario "María Pérez" — bórralos si molestan.
  5. Menor: el **export de Viajes** aún no aplica el filtro Destino (el listado trae el nombre, no el id). Se cierra cuando el listado exponga `destinationId`.
- **Decisiones cerradas esta tanda:** 3 roles fieles (Super admin protegido, ≥1, no baja/no cambio rol — backend bloquea); export vive en **Viajes** no en Mapa; estados-mapa derivados POSPUESTOS. ⚠️ batería/hibernación NO verificables sin teléfono. ⚠️ H4/H5 cerrados.
- **AVISO al abrir sesión nueva:** este checkpoint + `PLAN.md` bastan; NO re-explorar el repo. `git status` limpio antes de tomar bloque. Los ✔ de Fase 3+4 siguen "pendiente confirmar humano" hasta que Rogelio los valide.

## Historial de sesiones (resumen; detalle por bloque en la bitácora de `PLAN.md`)
- **2026-06-23 (sesión Fase 10 — portal web al diseño):** corrección de Rogelio (export va en Viajes, no en Mapa; replicar capturas exactas). Shell+sidebar+routing (10.1) + Mapa (10.2) + Viajes tabla/filtros/export (10.3) + detalle BE+FE (10.4) + Destinos CRUD BE+modal-mapa (10.5/Fase 5) + Usuarios CRUD+roles+super admin (10.6/Fase 6.2/6.3). Enum SUPER_ADMIN migrado. Assets reales (logo+foto oficina). e2e 14→47. Cada pantalla verificada con Playwright. → checkpoint vigente arriba.
- **2026-06-22 (sesión Fase 6.1 + Fase 7):** auth JWT del staff (6.1, cierra H4) + reporte Excel 13 columnas (7.1) + botón/filtros export en la web (7.2) + login/sesión del portal (6.3 parcial, enabler). Verificado: backend unit 21 + e2e 32, smoke curl, y navegador real (Playwright) login→portal→export. → checkpoint vigente arriba.
- **2026-06-22 (sesión Fase 3+4):** Fase 3 completa (rastreo por lotes GZIP + cierre auto por geocerca) + Fase 4 completa (cierres operador/admin, M4/M5, stop GPS, forzar cierre web) + alineación al spec + Fase 1 y 2 confirmadas por Rogelio. → checkpoint vigente arriba.
- **2026-06-22 (sesión larga previa):** Fase 1+2 completa (Android 1.4/2.3/1.5) + M2 al diseño + 8.1 seguridad + 8.2 tests (12 unit + 14 e2e).
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
- **Cierre/geocerca (2026-06-19, IMPLEMENTADO en Fase 4):** lote completo se guarda para ruta; cierre automático evalúa sólo los 2 puntos válidos más recientes por `recordedAt` y elegibles por `accuracyMeters` (50 m). Si cualquiera está dentro → backend cierra (AUTO_GEOFENCE). Manual fuerza con observaciones (operador MANUAL_OPERATOR / admin MANUAL_ADMIN). Cierre móvil offline se encola con `closeRequestId/requestedAt` (idempotente vía `SyncWorker`); transición de cierre atómica (`updateMany WHERE EN_RUTA`), segundo actor recibe `TRIP_ALREADY_CONCLUDED`. Al concluir, la app detiene el GPS (M5).
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

## Notas acumuladas (gotchas no-obvios, agrupados)
- **Backend dev:** tras tocar el backend, **reconstruir + reiniciar `node dist/main.js`** (un endpoint nuevo da 404 si corre el dist viejo — pasó con `/close`). **Auth web:** login `POST /api/web/auth/login` → `{accessToken,user}`; pasar `Authorization: Bearer <jwt>` a todo `/api/web/*`. Admin de dev = `admin@exiros.com / admin1234` (sembrar con `npx prisma db seed`; idempotente). **Gotcha build:** un `.ts` fuera de `src/` (ej. `prisma/seed.ts`) hace que `nest build` emita en `dist/src/main.js` y rompa `node dist/main.js` → mantener `prisma` en el `exclude` de `tsconfig.build.json` (el seed corre por ts-node, no necesita compilarse). `setupApp()` en `main.ts` = config endurecida compartida con e2e; `bootstrap()` sólo si `require.main===module`. No validar "dentro de geocerca" como filtro de ingesta (toda la ruta está fuera del destino); sí lat/lng rango + timestamp no futuro + bbox MX.
- **e2e (`npm run test:e2e`):** exige Postgres arriba; siembra/limpia su propio destino. **Flake posible** si el worker del emulador sincroniza contra el MISMO Postgres durante el test (contención) — no es bug, reintentar.
- **Emulador:** mover camión = `adb emu geo fix <lng> <lat>` (**lng primero**); el Extended Controls "Set Location" está **roto** en este AVD ARM. Boot: `emulator -avd Pixel_3a_API_34_extension_level_7_arm64-v8a -no-snapshot-save`. `10.0.2.2` = host desde el emulador; `usesCleartextTraffic=true` para HTTP dev. **Sin teléfono físico:** batería e hibernación (ActivityRecognition reporta STILL fijo) NO verificables → nunca reportarlas cumplidas.
- **⚠️ Footgun RN-11 en pruebas:** `pm clear` / "Olvidar viaje (debug)" borran el viaje local pero NO el del backend → deviceId con EN_RUTA colgado bloquea crear otro (409). Reset: `update "Trip" set status='CONCLUIDO' where status='EN_RUTA'`. Tras `pm clear`, esperar a que carguen los destinos antes de "Iniciar viaje".
- **Android build/runtime:** SIEMPRE `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew ...` (sin gradle/Studio en PATH). FGS de ubicación (Android 14): `startForeground()` con `FOREGROUND_SERVICE_TYPE_LOCATION` en los primeros segundos ANTES de cualquier `await` (si no, crash) → notif genérica y luego actualízala. Lint `MissingPermission` exige `@SuppressLint` aunque envuelvas en `runCatching`. KDoc con `/*` (ej. ruta `/api/mobile/*`) rompe el compilador Kotlin.
- **Room:** `fallbackToDestructiveMigration` (caché local; se recrea en upgrade de esquema, el viaje vive también en backend). String-template `${X}` no vale en `@Query` → literal.
- **Prisma:** fijado a **6.x** (v7 rompe: `url=env()` fuera del schema + driver adapter obligatorio). Enums = un valor por línea. Índice parcial RN-11 (`WHERE status='EN_RUTA'`) vive como SQL crudo en la migración (Prisma no soporta `WHERE`). Nombres: `AAAA_MM_DD_NNN_desc` (`migrate dev` genera timestamp pegado → renombrar carpeta + `UPDATE "_prisma_migrations".migration_name` antes de commitear).
- **Arquitectura:** AOP NO existe en Nest (capa transversal = Guards+Interceptors+Pipes+Filters globales). ORM ≠ motor: Prisma soporta PG y MySQL (PG por DX/hosting, no escala) → un cliente MySQL (Workbench) NO conecta a Postgres; usar pgAdmin/DBeaver o **Prisma Studio** (`npx prisma studio`).
- **Meta:** sin memoria persistente entre sesiones → `PLAN.md` + `CONTEXT-AI.md` SON la memoria (leerlos al inicio; METODOLOGIA se auto-carga vía CLAUDE.md global).
- **Ideas Post-MVP (PLAN §5.4):** I-01 filtro "operador a pie" (mini-geocerca + ActivityRecognition); I-02 "actualizar ubicación" on-demand desde web (requiere push FCM/WS) — alternativa MVP = flag `pendingRefresh`.
