# MEJORAS — Auditoría de calidad por capas

> Auditoría seccionada del repo Exiros contra: **arquitectura en capas, SOLID, DRY, KISS,
> Separation of Concerns (SoC) y Fail Fast** + hallazgos de **seguridad/robustez**.
> Es un documento de **diagnóstico + plan**: no toca código por sí mismo.
> Severidad: 🔴 alta · 🟡 media · 🟢 baja. Estado: `[ ]` pendiente · `[x]` hecho.

> ⚠️ **Ventana (de `CONTEXT-AI.md`):** congelación de `main` **jue 25 jun**, presentación
> **vie 26 jun**. `main` se audita con rúbrica. **Antes del freeze solo es realista la Fase 1**
> (cambios iso-funcionales, bajo riesgo). Fase 2 y 3 = deuda post-MVP. **Nada debe romper la demo.**

Secciones: **[0) Limpieza pre-producción](#0-limpieza-pre-producción--pre-pruebas-transversal)** ·
**[1) WebApp](#1-webapp)** ✅ código + fidelidad UI · **[2) Backend](#2-backend)** ⏳ pendiente ·
**[3) Android](#3-android)** ✅ fidelidad UI.

---

## 0) Limpieza pre-producción / pre-pruebas (transversal)

> Objetivo: dejar el repo **pulido y listo para pruebas de funcionamiento** — sin datos basura,
> sin secretos placeholder, sin atajos de debug. Marca cada ítem antes de entregar/probar.

### Datos y seed
- [ ] 🔴 **`backend/prisma/seed-demo.ts` es DESTRUCTIVO** y está **sin trackear** (git status).
      Borra `Location` + `Trip` + `Destination` + **todos los usuarios no-admin** y recrea datos de
      demo (folios `100294`/`100310`/`100277`/`100201`/`100150`/`100099`, monitores `*.exiros.com`).
      → **Nunca correr contra producción.** Decidir: (a) mantenerlo solo en dev y **documentar que es
      destructivo y solo demo** en su cabecera, o (b) sacarlo del árbol de entrega. **No** debe quedar
      enganchado al `prisma db seed` oficial.
- [ ] 🔴 **Contraseñas placeholder de dev:** seed oficial crea `admin@exiros.com / admin1234`;
      `seed-demo` usa `monitor1234`. → En el entorno real, **cambiar la contraseña del admin** tras
      el primer arranque (o sembrar con una env-var, no hardcodeada).
- [ ] 🟡 **BD de pruebas/prod arranca limpia:** solo `npx prisma db seed` (admin), **sin** `seed-demo`.
      Verificar que no queden sembrados de sesiones previas (`DEMO-ENRUTA`/`DEMO-DETEN`, "María Pérez",
      "Transporte del Norte SA de CV", destinos de prueba).
- [ ] 🟢 Fotos demo apuntan a `uploads/demo/carga_<folio>.jpg` (no existen en disco) → con BD limpia
      deja de importar; solo relevante si se conserva `seed-demo`.

### Secretos y configuración
- [ ] 🔴 **`x-app-key: dev-app-key-cambia-en-prod`** (ingesta móvil): es un placeholder. Definir clave
      real por env en backend y app; ya existe guard que **falla el release Android** con placeholders.
- [ ] 🟡 **Web `.env`:** hoy **no existe `.env.local`** (usa default de prod: polling 15 min). Antes de
      entregar, verificar que **no se cree/quede** un `.env.local` con `VITE_POLL_MS` corto (30 s de
      prueba) ni `VITE_API_URL` apuntando a `localhost`/túnel dev. `infra/.env.example` es la plantilla.
- [ ] 🟡 Confirmar que **ningún `.env` real** (no `.example`) esté trackeado en git.

### Atajos de debug (app móvil — confirmar en sección 3)
- [ ] 🟡 **"Olvidar viaje (debug)"** y **cadencia de subida 30 s** son solo de build debug. Verificar que
      el build **release** no los exponga (cadencia a la fuente 2 min/300 m, sin botón debug).

---

## 1) WebApp

**Stack:** React 19 + TypeScript + Vite + react-router 7 + react-leaflet. ~16 archivos en `web/src`.
**Veredicto:** funciona y está **bien escrita**; los problemas son de **estructura y duplicación**,
no de corrección funcional.

### 1.A — Diagnóstico

#### Arquitectura en capas / SoC / SRP
- **`api.ts` es un "God module"** (~300 líneas, 3+ responsabilidades): modelos/DTOs del dominio
  (`Trip`, `TripDetail`, `StaffUser`, `Destination`, `Role`…) + sesión en `localStorage`
  (`getToken`/`setSession`/`clearSession`) + cliente HTTP base (`ensureOk`, `authHeaders`,
  `ApiError`) + servicios de 5 recursos (auth, trips, users, destinations, reports). Cualquier
  cambio toca el mismo archivo.
- **No hay frontera UI ↔ datos:** cada página llama `fetch*` directo y mezcla fetching + estado +
  filtrado + formato + render (ej. `ViajesPage.tsx`, `MapaPage.tsx`).

#### DRY (duplicación real)
- **Patrón "load + try/catch + 401→logout" duplicado 4 veces:** `useTrips.ts`,
  `pages/ViajeDetallePage.tsx`, `pages/DestinosPage.tsx`, `pages/UsuariosPage.tsx`.
- **`ROLE_LABEL` duplicado** literal: `Layout.tsx:7` y `pages/UsuariosPage.tsx:16`.
- **Formato de fecha duplicado:** `formatDate` (`ViajesPage.tsx:214`) y `fmt`
  (`ViajeDetallePage.tsx:212`), idénticos salvo `year`. Además `fmtDuration` y `formatAgo`
  son utilidades embebidas en componentes.
- **Modal/overlay con `stopPropagation` repetido 5 veces** (`DestinoModal`, modal de cierre en
  `ViajeDetallePage`, confirm de baja en `DestinosPage` y `UsuariosPage`, `UsuarioPanel`); el
  diálogo "confirmar baja" es casi copia-pega entre Destinos y Usuarios.
- **Lógica baja/restaurar (`setActive` + recarga)** duplicada entre Destinos y Usuarios.
- **Coordenada default Monterrey `[25.6866, -100.3161]` hardcodeada 3 veces:**
  `DestinoModal.tsx:43`, `TripsMap.tsx:44`, `RouteMap.tsx:11`.
- **`matches()` de filtrado** con la misma forma en `ViajesPage` y `MapaPage`.

#### KISS (bien en general; menores)
- Código simple y legible. `tripState.ts` es un buen ejemplo de lógica aislada.
- `MapaPage` concentra mucho cálculo (`states`, `counts`, `filtered`, `visible`, `visibleTotal`)
  → candidato a hook `useMapTrips`.
- Inconsistencia de estilo: `setUserActive(u.id, true).then(load)` (promise-chain) vs `async/await`
  en el resto (`UsuariosPage.tsx:143`).

#### Fail Fast / robustez
- 🔴 **`getStoredUser()` hace `JSON.parse` sin try/catch** (`api.ts:112`). Un `localStorage`
  corrupto **crashea el arranque** (lo invoca `AuthProvider` en el estado inicial) → pantalla
  blanca, no fail-fast controlado.
- 🟡 **Sin React Error Boundary global:** un error de render en cualquier página tumba toda la app.
- 🟡 **401→logout disperso** en 4 lugares en vez de centralizado en el cliente HTTP.
- 🟢 `closeTripAdmin(id!, …)` usa non-null assertion sin revalidar (`ViajeDetallePage.tsx:64`).

#### Artefactos de debug / pulido pre-producción (web)
- ✅ **Limpia de ruido:** sin `console.log`/`console.debug`, sin `debugger`, sin `TODO`/`FIXME` en
  `web/src` (verificado por grep). Buen estado de partida.
- 🟡 **4 supresiones `// eslint-disable-next-line react-hooks/set-state-in-effect`**
  (`useTrips.ts:45`, `DestinosPage.tsx:37`, `UsuariosPage.tsx:49`, `ViajeDetallePage.tsx:51`).
  No son debug, pero **silencian** el patrón "cargar en `useEffect` y hacer `setState`". Al unificar
  con el hook `useResource` (Fase 2) el lint deja de quejarse y se eliminan las supresiones. Mientras
  tanto, dejarlas documentadas; no añadir más.
- 🟢 `// eslint-disable-next-line react-refresh/only-export-components` en `auth-context.tsx:25`:
  justificada (export de hook + provider en el mismo archivo). Aceptable; opcional separar el hook.
- 🟡 **`alert()` (×3)** para errores (`ViajesPage.tsx:55`, `DestinosPage.tsx:46`, `UsuariosPage.tsx:72`):
  no es UX de producción → reemplazar por la UI de error existente (ver Fase 3).

#### Seguridad / defensa en profundidad
- 🔴 **`/usuarios` y `/destinos` sin guard de rol en la web.** `App.tsx` las registra sin
  protección; el sidebar solo las **oculta** (`Layout.tsx:60-71`). Un `MONITOR` que escribe la URL
  monta el componente y ve una página que falla en cada llamada. **El backend SÍ protege**
  (`AdminRolesGuard`, ADR-007 + cierre admin-only #9) → no es fuga de datos, es UX/robustez.
  Falta `<RequireAdmin>`.
- 🟡 **Errores con `alert()`** en vez de UI de error consistente: `ViajesPage` (export),
  `DestinosPage` (setActive).
- 🟢 **Token en `localStorage`** (expuesto a XSS). Riesgo ya consciente (anti-XSS con `textContent`
  en `TripsMap.tsx:164`). Decisión de arquitectura del MVP (ADR-007): se documenta, no se cambia.

### 1.B — Plan de remediación

#### Fase 1 — Quick wins · ✅ HECHA 2026-06-25 (iso-funcional; commits `7bfe250` + DRY)
- [x] 🔴 **Blindar `getStoredUser()`**: try/catch en `JSON.parse`; ante error `clearSession()` y
      devolver `null`. (`api.ts`) — `7bfe250`.
- [x] 🔴 **`<RequireAdmin>`**: guard que redirige a `/mapa` si `user.role !== 'ADMIN'`; envuelve
      `/destinos` y `/usuarios` en `App.tsx`. — `7bfe250`.
- [x] 🟡 **`web/src/constants.ts`**: `DEFAULT_CENTER` (Monterrey, 3 copias) + `ROLE_LABEL` único
      (reusado en `Layout` y `UsuariosPage`).
- [x] 🟡 **`web/src/format.ts`**: unificados `formatDateTime` (antes `formatDate`/`fmt`, param
      `fullYear`), `formatDuration`, `formatAgo`; copias eliminadas.
- [x] 🟢 Unificado estilo async (quitado `.then(load)` en `UsuariosPage`).

#### Fase 2 — Separación de capas · ⏳ POST-freeze / deuda
- [ ] 🔴 **Partir `api.ts`** en `web/src/api/`: `types.ts`, `http.ts` (cliente base + helper
      `request`), `session.ts`, y servicios `auth.ts`/`trips.ts`/`users.ts`/`destinations.ts`/
      `reports.ts`. Re-exportar desde `api/index.ts` para no romper imports de golpe.
- [ ] 🔴 **Hook `useResource`** que encapsule `load + estado + error + 401→logout`. Migrar
      `DestinosPage`, `UsuariosPage`, `ViajeDetallePage`; alinear `useTrips`.
- [ ] 🟡 **Centralizar 401→logout** en `http.ts` (callback/evento de sesión expirada).

#### Fase 3 — Componentes reutilizables + robustez · ⏳ POST-freeze / deuda
- [ ] 🟡 **`<Modal>` y `<ConfirmDialog>`** reutilizables; refactorizar los 5 modales.
- [ ] 🟡 **`<ErrorBoundary>` global** envolviendo el shell.
- [ ] 🟢 Sustituir `alert()` por la UI de error existente.
- [ ] 🟢 (Opcional) Extraer `useMapTrips` de `MapaPage`.

#### Fuera de alcance (decisión consciente)
- Migrar token fuera de `localStorage` (cookie httpOnly): cambio de arquitectura cliente+backend,
  post-MVP.

### 1.D — Fidelidad UI vs. referencia (web)

Comparación pantalla por pantalla contra `docs/exiros-reference-image/webapp/` y el doc UX-UI §4.
**Veredicto general: muy fiel** — sidebar, header, tablas, paneles y modales replican el diseño con
precisión. Solo hay 1 hueco de funcionalidad y varios detalles menores/decisiones de producto.

| Pantalla | Estado | Nota |
|---|---|---|
| **W0 · Login** | ✅ | "¿Olvidaste tu contraseña?" + modal implementados. |
| **W1 · Mapa** | 🟢 | Fiel; 3 estados (no 5) por decisión; falta columna "Sin avance". |
| **W2 · Viajes** | 🟢 | Muy fiel; rango de fecha en 2 inputs (no 1 selector). |
| **W3 · Detalle** | 🟢 | Muy fiel. |
| **W4 · Destinos** | 🟢 | Muy fiel. |
| **W4 · Nuevo destino** | 🟢 | Fiel; el pin no se arrastra (solo clic). |
| **W5 · Usuarios** | 🟢 | Fiel; 2 roles (no "Super admin") por decisión. |
| **W5 · Nuevo usuario / Baja** | 🟢 | Muy fieles. |

#### Hallazgos
- ✅ **W0: "¿Olvidaste tu contraseña?" implementado** (`Login.tsx` + `Login.css`). Enlace discreto a
  la derecha bajo el campo de contraseña + **modal "Restablecer contraseña"** ("Contacta con tu
  administrador…", botón "Entendido", icono `KeyRound`). Gate verde (lint puro + build).
- 🟢 **W4: el pin de la geocerca no se arrastra** (`DestinoModal.tsx`). El diseño dice "clic **o
  arrastrando el pin**"; la implementación solo capta clic (`ClickToSet`), el `CircleMarker` no es
  draggable. El texto guía ya dice solo "Haz clic". Mejora opcional: pin arrastrable o ajustar copy.
- 🟢 **W1: la tabla "Viajes visibles" no tiene columna "Sin avance"** (tiempo detenido) que sí está
  en la referencia. Ligado a la reducción de estados. Opcional.
- 🟢 **W2: rango de fecha** con dos `<input type=date>` separados vs. el selector de rango único del
  diseño; y sin badge "Retrasado". Funcionalmente equivalente. Opcional.

#### Divergencias **intencionales** (NO corregir — decisiones de producto, ver `CONTEXT-AI.md`)
- **Mapa con 3 estados** (En ruta / Detenido / Concluido), no los 5 del Figma (Sin actualización /
  Cerca de destino / Contingencia descartados). Decisión de Rogelio 2026-06-23.
- **2 roles** (Administrador / Monitorista), sin "Super administrador". Eliminado conscientemente
  (I-03) por exceder la fuente de alcance MVP; de ahí que no exista el "candado" de protección.

### 1.C — Verificación (al ejecutar cada ítem)
1. **Gate:** `cd web && npm run lint && npm run build` (lint puro, sin `--fix`) en verde.
2. **Humo manual** (`npm run dev`): login→`/mapa`; `/viajes` (filtros, paginación, export Excel,
   detalle); detalle (ruta + forzar cierre como ADMIN). Fase 1 añade: como **MONITOR** ir a
   `/usuarios` → redirige; corromper `exiros_user` en localStorage y recargar → no crashea, va a Login.
3. Fase 2/3 son **iso-funcionales**: el humo debe pasar idéntico antes/después.

---

## 2) Backend
⏳ **Pendiente de auditar** (siguiente sección). NestJS + Prisma. Nota previa: el refactor a
feature-folders (`backend/src/web/`) y el hardening de seguridad ya se hicieron (ver `CONTEXT-AI.md`).

## 3) Android — Fidelidad UI vs. referencia

Comparación pantalla por pantalla de la implementación Compose (`MainActivity.kt`,
`EnRutaScreen.kt`, `CloseScreens.kt`, `ui/ExirosTheme.kt`) contra
`docs/exiros-reference-image/android/` y el doc UX-UI §3.
**Base:** la paleta (`ExirosTheme`) replica fielmente §2.1; M2 y M3 son **muy fieles**. Los
desajustes están en M1 (ausente), M4 (patrón) y M5 (contenido).

| Pantalla | Estado | Veredicto |
|---|---|---|
| **M1 · Permisos** | ✅ | Pantalla `PermisosScreen` creada y antepuesta a M2. |
| **M2 · Formulario** | 🟢 Fiel | Wordmark, 7 campos en orden, PhotoBox verde, dropdown, botón azul. |
| **M3 · Viaje activo** | 🟢 Fiel | Píldora, tarjeta de datos, modo ahorro, botón outline. |
| **M4 · Finalizar** | 🟡 Diverge | No es bottom sheet + textos distintos (pendiente). |
| **M5 · Concluido** | ✅ | Tarjeta-resumen (tipo + observaciones + duración), check azul, botón "+". |

### Hallazgos
- ✅ **M1 (Permisos) implementada** (`PermisosScreen.kt` nuevo + `MainActivity.kt`). Pantalla
  dedicada (icono target + título "Permisos para rastrear el viaje" + 4 permisos con justificación
  + "Permitir y continuar" / "Ahora no"), antepuesta en `RootScreen` cuando faltan permisos y no se
  omitió (`permisosSkipped`). "Permitir y continuar" lanza el diálogo real; "Ahora no" pasa a M2.
  - 🟡 Nota técnica (sin cambio): no se solicita `ACCESS_BACKGROUND_LOCATION` (solo FINE/COARSE +
    POST_NOTIFICATIONS + ACTIVITY_RECOGNITION). Es **defendible** porque el rastreo va sobre un
    Foreground Service tipo `location`; la pantalla solo explica el permiso "en segundo plano".
- ✅ **M5 (Concluido) completa** (`CloseScreens.kt`). Tarjeta-resumen con **Tipo de cierre +
  Observaciones + Duración**; check **azul** sobre círculo azul claro, subtítulo según el tipo de
  cierre e icono `+` en el botón. Se añadió `closedAt` a `ActiveTripEntity` (Room v3→v4) para
  derivar la duración (`closedAt − createdAt`); las observaciones salen de `closeObservations`.
  Compila (`gradlew compileDebugKotlin` → BUILD SUCCESSFUL).
- 🟡 **M4 (Finalizar) no es bottom sheet** (`CloseScreens.kt:44-83` + `MainActivity.kt:175`). El
  diseño es una **hoja inferior** sobre M3 (la referencia muestra M3 atenuado detrás); la
  implementación es **pantalla completa** que reemplaza M3. Además difieren textos: botón
  "Confirmar finalización" (ref. **"Confirmar cierre"**), subtítulo y el placeholder/`*` de
  Observaciones. → Migrar a `ModalBottomSheet` y alinear copys.
- 🟢 **M2/M3 fieles**; solo afinar copys si se quiere exactitud literal.

### Artefactos de debug (pre-producción) — Android
- 🟢 **`BuildConfig.DEV_AIDS`** precarga datos demo en M2 (`48213`/"Transporte del Norte"/`100294`/
  `ABC-12-34` + foto `sample_truck` + autoselección de destino, `MainActivity.kt:266-307`) y añade
  botones **"Sincronizar ahora (debug)"** y **"Olvidar viaje — solo local (debug)"** en M3
  (`EnRutaScreen.kt:191-206`). **Bien resuelto:** `app/build.gradle.kts:42` fija **`DEV_AIDS=false`
  en release**; en debug es opt-in (`-PEXIROS_DEV_AIDS=true`, default `false`). → Solo asegurar que
  la **demo/entrega corra el build release** (o debug sin el flag); nada que limpiar en código.

---

## Resumen ejecutivo (WebApp)
Web funcional y bien escrita, con **deuda estructural**: `api.ts` concentra 3 capas, el patrón de
carga se repite 4 veces, y faltan 3 redes de seguridad (guard de rol por ruta, `getStoredUser`
defensivo, Error Boundary). Dado el freeze inminente, lo de mayor retorno hoy son los **2 ítems 🔴
de Fase 1**; el resto queda como deuda registrada.
