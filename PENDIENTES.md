# PENDIENTES — Exiros (revisar 1 × 1)

> Última actualización: **2026-06-25**. Estado del repo: MVP completo, todos los gates verdes,
> seguridad endurecida. Lo que falta es **despliegue + validación humana**.
> Marca `[x]` lo que vayas cerrando. Detalle técnico en `CONTEXT-AI.md`.

---

## 🔴 BLOQUEANTES para la entrega (sin esto no hay demo en vivo)

### A. Infraestructura AWS (la estás montando tú)
- [ ] **EC2** (free tier) con Node + el backend clonado.
- [ ] **RDS PostgreSQL** creado; copiar su cadena a `DATABASE_URL`.
- [ ] **cloudflared** corriendo en el EC2 → obtener la **URL HTTPS pública**.
- [ ] `backend/.env` en el EC2 con los valores de `infra/secrets.local.env`
      (JWT_SECRET, TRIP_TOKEN_SECRET, APP_KEY ya generados) + `DATABASE_URL` del RDS.
- [ ] **`TRUST_PROXY_IP=true`** en ese `.env` (o el rate-limit no sirve tras cloudflared).
- [ ] **`WEB_ORIGIN`** = dominio del portal (CORS en prod).
- [ ] En el EC2: `npx prisma migrate deploy` + `npx prisma db seed` (crea el admin).
- [ ] ⚠️ **Crear 1–2 DESTINOS en el portal de prod.** El seed oficial (`seed.ts`) **solo crea el
      admin, NO destinos** → sin destinos la app NO puede crear viajes (dropdown vacío). Entra al
      portal (W4 Destinos) y crea al menos uno antes de la demo.

### A-bis. Despliegue del portal web (si lo subes)
- [ ] **Compilar la web con `VITE_API_URL`** apuntando a la URL del EC2/cloudflared, o el portal
      desplegado pega a `http://localhost:3000` y falla:
      `VITE_API_URL=https://tu-url npm run build` (ver `web/.env.example`).
- [ ] Verificar que **no** se cuele `web/.env.local` (polling de 30s) en el build de prod.

### B. Compilar el APK final (yo lo hago cuando me des la URL)
- [ ] Pásame la **URL HTTPS** del túnel → compilo `assembleRelease` con esa URL + el APP_KEY.
      (La firma ya está lista; el APK saldrá firmado e instalable.)
- [ ] Instalar el APK en el **teléfono físico** y probar con GPS real.

### C. Validación humana (solo tú puedes marcar `✔ Confirmado`)
- [ ] Recorrer el portal: Mapa (3 estados) · Viajes · Detalle · Destinos · Usuarios.
- [ ] **Exportar el Excel** y revisar las 13 columnas.
- [ ] Smoke en vivo de los 2 cierres no probados así: **operador (M4)** y **admin (forzar cierre)**.
      (El cierre por **geocerca** ya está verificado e2e.)
- [ ] Correr la demo e2e (`./scripts/route-sim.sh`) de principio a fin sin romperse.

---

## 🟡 RECOMENDADOS para la rúbrica (bajo riesgo, suman puntos)

- [ ] **Cambiar la contraseña del admin** tras el primer arranque en prod (hoy `admin1234`).
- [ ] **Respaldar** `android/app/exiros-release.keystore` + `android/keystore.properties`
      (NO están en git; si los pierdes no podrás firmar updates con la misma identidad).
- [ ] Limpiar la BD de datos de prueba antes de presentar (la del EC2 arranca limpia con solo
      `prisma db seed`; en dev local quedan sembrados de demo).

---

## 🟢 OPCIONALES / deuda registrada (NO bloquean la demo)

- [ ] **M4 "Finalizar viaje"** como *bottom sheet* (hoy pantalla completa) + texto "Confirmar
      cierre" — fidelidad de diseño Android.
- [ ] WebApp Fase 2/3 (partir `api.ts`, hook `useResource`, `<Modal>`/`ErrorBoundary`) — deuda
      post-MVP, NO tocar antes de la entrega.
- [ ] Export de Excel sin tope de filas (memoria) — irrelevante a escala MVP.
- [ ] **KPI batería <10%/jornada**: NO medible sin teléfono físico → deuda honesta declarada
      (ADR-004). Si consigues el teléfono, mídelo en una jornada real.

---

## ✅ YA HECHO esta sesión (2026-06-25) — para que no lo repreguntes

- Firma release del APK (keystore) · Quick wins web (getStoredUser, RequireAdmin, DRY).
- Auditoría backend completa + `/health` + AppKeyGuard en tiempo constante.
- **Hardening de seguridad del endpoint público**: foto segura por MIME, rate-limit por IP real
  tras proxy, login throttle 10/min.
- `.env.example` documentado (backend + web) · `/health` documentado en openapi.
- Diagnóstico del "viaje se cierra solo" (era el emulador sobre la geocerca, no un bug).
