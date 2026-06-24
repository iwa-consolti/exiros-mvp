# Exiros — On-Route Tracker (MVP)

Solución **independiente** de rastreo en ruta de camiones de chatarra (patio vendedor → patio comprador):

- **App Android** de acceso libre (sin login) para operadores.
- **Portal web** con login (JWT) para monitoristas Exiros.
- **Backend/API único** (NestJS) que recibe la telemetría y cierra el viaje.

Núcleo del producto: **rastreo en segundo plano con < 10 % de batería por jornada** y **cierre automático del viaje por geocerca**.

> **Estado:** MVP funcional de extremo a extremo. Móvil (crear viaje → rastrear en 2.º plano → cerrar) + portal web (Mapa, Viajes, detalle, Destinos, Usuarios, export Excel) + backend (auth JWT + tripToken, cierre por geocerca, reportes). Falta verificación humana de algunos bloques y el KPI de batería (no medible en emulador).

---

## ▶️ Cómo levantar (local, cualquier SO)

**Requisitos:** Docker + Docker Compose · Node 20+ y npm · (para móvil) JDK 21 + Android SDK con un emulador (AVD) o teléfono físico.
Los comandos asumen una shell `bash`/`zsh` (en Windows usa **WSL** o **Git Bash**).

### 0) Clonar e instalar dependencias

```bash
git clone https://github.com/RogerPerva/exiros-mvp.git && cd exiros-mvp
( cd backend && npm install )
( cd web && npm install )
```

### 1) Base de datos (Postgres en Docker)

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 2) Backend — API en `:3000`

```bash
cd backend
cp .env.example .env          # ⚠️ define los secretos; el backend NO arranca si falta alguno
npx prisma migrate deploy     # aplica el esquema
npx prisma db seed            # crea el admin (idempotente)
npm run build && node dist/main.js     # deja esta terminal corriendo
#   alternativa en desarrollo (hot-reload, sin build): npm run start:dev
```

- Variables obligatorias (en `.env`): `DATABASE_URL`, `JWT_SECRET`, `TRIP_TOKEN_SECRET`, `APP_KEY` — si falta alguna, el arranque falla con un mensaje claro (fail-fast).
- **Ver la BD:** `npx prisma studio`.

### 3) Portal web — `:5173`

```bash
cd web
npm run dev                   # abre http://localhost:5173
```

- Login: **`admin@exiros.com` / `admin1234`** (lo crea el seed).
- Si el backend NO está en `http://localhost:3000`, crea `web/.env.local` con `VITE_API_URL=https://tu-backend` (y opcional `VITE_POLL_MS=30000` para refrescar rápido en pruebas).

### 4) App móvil — Android (emulador o teléfono)

Necesita `ANDROID_HOME` y JDK 21. Exporta las rutas del SDK si no las tienes en el `PATH`:

```bash
# macOS: $HOME/Library/Android/sdk   ·   Linux: $HOME/Android/Sdk   ·   Windows: %LOCALAPPDATA%/Android/Sdk
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

emulator -list-avds                          # ver AVDs; crea uno desde Android Studio si no hay
emulator -avd <tu-AVD> -no-snapshot-save &   # arranca el emulador

cd android
# JAVA_HOME apuntando al JDK 21 — macOS: $(/usr/libexec/java_home -v 21) · Linux/Win: ruta del JDK 21
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- El **emulador** alcanza el backend del host en `http://10.0.2.2:3000` (ya configurado en el build *debug*).
- **Teléfono físico / red externa:** abre un túnel con `./scripts/tunnel.sh` (ver abajo) y reconstruye apuntando a esa URL.
- **Build de producción (`release`):** la URL y la clave reales son obligatorias o el build **falla** (guard anti-placeholder):
  ```bash
  ./gradlew assembleRelease -PEXIROS_API_URL=https://api.tu-dominio.com -PEXIROS_APP_KEY=<clave-prod>
  ```

> ⚠️ Si el portal da 500 o el login falla, casi siempre el contenedor de Postgres se cayó (la máquina durmió): revisa `docker ps` y re-corre el paso 1, luego reinicia el backend.
> ⚠️ Tras tocar el backend, **reconstruir + reiniciar** `node dist/main.js` (un endpoint nuevo da 404 si corre el `dist` viejo); en `start:dev` recarga solo.

---

## 🎬 Guion de demo (cierre automático por geocerca)

Con el sistema arriba y un destino activo (p. ej. *Patio Comprador Monterrey*, centro `25.6866,-100.3161`, radio 300 m, creado desde el portal → Destinos):

1. **App (emulador):** llena el formulario → elige el destino → **Iniciar viaje**. (Acepta permisos de ubicación.)
2. **Portal → Viajes/Mapa:** el viaje aparece **En ruta**.
3. **Reproduce la ruta** (otra terminal): mueve el GPS del emulador hacia la geocerca.
   ```bash
   ./scripts/route-sim.sh --to 25.6866,-100.3161 --radius 300
   ```
4. Al entrar al radio, el backend cierra el viaje solo (`AUTO_GEOFENCE`):
   - **Portal → Viajes:** pasa a **Concluido**.
   - **App:** pantalla **Viaje concluido — "Cierre automático por geocerca"**.
5. **Exporta** el reporte desde **Portal → Viajes → Exportar a Excel** (13 columnas).

> **Reset entre corridas:** si un viaje queda colgado en *En ruta*, ciérralo en la BD:
> `docker exec exiros-postgres psql -U exiros -d exiros -c "update \"Trip\" set status='CONCLUIDO' where status='EN_RUTA';"`
> Antes de cada corrida, mueve el GPS fuera de la geocerca para que no cierre al instante: `adb emu geo fix -100.3300 25.7005`.

**Túnel para teléfono físico / red externa** (sin nube, sin cuenta):

```bash
brew install cloudflared        # una vez
./scripts/tunnel.sh             # imprime https://<...>.trycloudflare.com hacia :3000
```

---

## 🧪 Gates de calidad (verde antes de cada commit)

```bash
# Backend (e2e exige Postgres arriba)
cd backend && npm run lint && npm run build && npm test && npm run test:e2e
# Web
cd web && npm run lint && npm run build
# Android
cd android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew lintDebug assembleDebug
```

> `npm run lint` (backend) es una **verificación pura** (no auto-corrige): si falla, aplica los arreglos con `npm run lint:fix`.

---

## 🧱 Stack congelado

| Capa | Tecnología | ADR |
| :-- | :-- | :-- |
| Backend | NestJS (TypeScript), monolito modular | 002 |
| ORM / BD | Prisma 6.x · PostgreSQL | 006 / 005 |
| Web | React + Vite + TS · mapa Leaflet + OpenStreetMap · iconos lucide-react | 003 |
| Android | Kotlin nativo (FusedLocation + ActivityRecognition + Foreground Service + Room + WorkManager) | 004 |
| Auth | JWT (web) + **tripToken** bearer por viaje/dispositivo (móvil) | 007 |
| Geocerca | Círculo (centro+radio) + haversine en el service (sin PostGIS) | 012 |
| Infra | Docker solo para Postgres local · túnel cloudflared para teléfono | 008 / 009 |
| Tests | Jest unit + Supertest e2e | 010 |

> Repositorio **monorepo** split-ready (ADR-001). Cambiar el stack exige actualizar el ADR correspondiente.

---

## 📂 Estructura del repo

```
/exiros-mvp
  /backend   # NestJS + Prisma
  /web       # React + Vite
  /android   # Kotlin + Compose
  /docs      # specs + /adr + /fuente + /exiros-reference-image
  /infra     # docker-compose
  /openapi   # contrato openapi.yaml
  /scripts   # tunnel.sh (túnel) · route-sim.sh (simulador de ruta para demo)
  PLAN.md  CONTEXT-AI.md  README.md
```

---

## 📚 Documentación

Leer en este orden al iniciar sesión: **`CONTEXT-AI.md`** (contexto vivo, stack, decisiones, "▶️ retomar aquí") → **`PLAN.md`** (plan maestro + bitácora). Specs en `/docs` (`technical-spec`, `functional-spec`, `api-spec`, `database-spec`, `uiux-spec`, `adr/`) y el contrato `openapi/openapi.yaml`. Fuente de negocio en `docs/fuente/`.

## ⚠️ Reglas duras (resumen — detalle en `CONTEXT-AI.md`)

- App Android **sin login** → `/api/mobile/*` es la mayor superficie de ataque: **defensa en capas** (helmet + Guard tripToken + rate-limit + ValidationPipe estricto + tope de body + Exception Filter). Ver **ADR-007**.
- **No** lógica de negocio en controllers. **No** endpoints sin validación. **No** subir secretos (`.env` fuera del repo; `.env.example` sí).
- Reporte Excel: **exactamente 13 columnas** del doc de alcance §6.
- KPI "< 10 % batería" = objetivo de diseño **no verificable en emulador**; nunca reportarlo como cumplido sin teléfono físico.

> Metodología de trabajo: `~/.agents/METODOLOGIA.md` (protocolo maestro, se auto-carga vía el `CLAUDE.md` global).
