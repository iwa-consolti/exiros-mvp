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
4. `Exiros/2026 Exiros alcance MVP On-Route Tracker.md` — alcance/requisitos del cliente (fuente).
5. `Exiros/IWA-Exiros - Estrategia Ágil-*.md` — reglas de la competencia interna.

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
- **Un bloque = un commit limpio** mínimo (granularidad para la auditoría).

---

## Decisiones cerradas (no reabrir sin motivo)
- **ADRs Aceptadas (TODAS — Bloque 0.5 completo):** 001 monorepo split-ready · 002 monolito modular + NestJS · 003 React+Vite+Leaflet · **004 Kotlin nativo (+ Plan B plugin debug)** · 005 PostgreSQL · 006 Prisma · **007 JWT web + tripToken móvil** · **008 Docker solo PG local** · **009 deploy túnel+Railway (pend. confirmar Julio)** · **010 Jest unit + Supertest e2e (manuales en emulador)** · 012 geocerca haversine.
- **ADR-011 eliminada** (uso de IA = metodología, no entregable del proyecto).
- **Functional Spec (Bloque 0.2):** máquina de estados de 2 estados (En ruta → Concluido); S-01..S-07 resueltos (S-03 foto bloqueante cámara/galería).
- **Database Spec (Bloque 0.4):** 4 entidades (User, Destination, Trip, Location) en `docs/database-spec.md` + borrador `schema.prisma`. `providerNumber`/`folio` = String; coords = Float; Duración NO se almacena (se deriva); soft-delete User/Destination, Trip inmutable; RN-11 = índice único parcial `deviceId WHERE status=EN_RUTA`; no se guarda identidad del chofer (solo `deviceId`).
- **API Spec (Bloque 0.3):** `docs/api-spec.md`. `/api/web/*` (JWT) + `/api/mobile/*`. Bootstrap móvil (leer destinos + crear viaje) ocurre **antes** del tripToken → protegido con `X-App-Key` estática (debilidad documentada) + rate-limit; tripToken protege ingesta. Ingesta = GZIP + `batchId` (idempotencia) + respuesta `stopTracking`. App conoce el cierre por la respuesta de la ingesta, no por endpoint aparte (RN-13). Roles: ADMIN superset de MONITOR (matriz §2.2). Dos espacios, un solo Service (regla anti-duplicación §2.1).
- **UI/UX Spec (Bloque 0.6):** `docs/uiux-spec.md`, brief con límites duros + lista "🚫 NO diseñar" para alimentar a Claude Design. 5 pantallas móvil (M1–M5) + 6 web (W0–W5). **Cierre por operador = solo texto, NO foto** (confirmado en doc fuente líneas 119/195). Para diseñar, pasar a la IA: `uiux-spec.md` + `functional-spec.md`. Web y móvil = sesiones de diseño separadas (distinta plataforma; no comparten componentes).
- **FASE 0 COMPLETA (2026-06-18):** 4 specs (Functional/API/DB/UI-UX) + 12 ADRs + backlog de implementación (Fases 1–9 en PLAN §21). Rogelio diseña UX/UI en paralelo. **Siguiente del lado código: Bloque 1.1 (scaffolding monorepo + git init + docker-compose Postgres).** Avanzar backend/bala trazadora (independiente del diseño).
- **▶️ RETOMAR AQUÍ (próxima sesión, tras leer PLAN + este archivo):** Fase 0 cerrada; toca **Bloque 1.1 (scaffolding)**. Repo aún SIN `git init` y SIN carpetas de código (solo `/docs`, `/infra/eval`). Entorno OK (Node 22, Docker 27, Java 21, Nest vía npx). **Acción:** confirmar con Rogelio la opción de arranque (A=todo 1.1 con docker-compose Postgres [recomendado] · B=sin Docker · C=directo a NestJS) y ejecutar. NO re-explorar el repo: PLAN §21 + estas notas bastan.
- **ADR-004 Android = Kotlin nativo** (Flutter/RN descartado: núcleo no sería código propio + licencia release; Java descartado: Kotlin > Java; plugins gratis descartados: poco fiables en 2º plano).
- **H7** refresco 15–20 min (configurable; límite batería+datos). **H10** volumen bajo (~200 usuarios, usuario nunca toca la BD → índices simples).
- **H2 RESUELTO:** catálogo de destinos lo crea el Admin desde el CRUD web (datos de **runtime, no build-time**) → no bloquea código; datos reales solo para demo creíble. **RN-13** interacción mínima en app (solo consume opciones, no crea nada). **RN-14** catálogo vacío → app bloquea inicio con estado vacío.

## Pendientes externos (NO bloquean código — esperan a terceros; seguimos con default)
| # | Tema | Default asumido | Resolver |
| :-- | :-- | :-- | :-- |
| D2 / ADR-009 | Deploy gratis vs solo túnel | Túnel en dev + Railway/Render en demo | Confirmar con Julio que deploy gratis no choca con "cloud no requerido" |
| H11 | iOS fuera de alcance | Sí, fuera | Confirmar con Julio |
| H6 | Teléfono físico para batería/OEM | Emulador (batería NO verificable) | Conseguir dispositivo "más adelante" |

> **Todas las ADRs están cerradas.** Lo que sigue NO es diseño de decisiones, es **specs que alimentan código**: 0.4 (DB→Prisma), 0.3 (API→contratos), luego scaffolding + bala trazadora.

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
- 2026-06-18: **Sin teléfono físico → emulador.** El emulador SÍ: UI, flujo de permisos, **ruta GPS simulada (GPX)** → demo de cierre por geocerca viable (cubre también H3). El emulador NO: batería real ni battery-killers OEM (es Android puro). → KPI "<10% batería" = objetivo de diseño NO verificado hasta dispositivo real; nunca reportarlo como cumplido sin teléfono.
