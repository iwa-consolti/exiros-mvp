# Exiros — On-Route Tracker (MVP)

Solución **independiente** de rastreo en ruta de camiones de chatarra (patio vendedor → patio comprador):

- **App Android** de acceso libre (sin login) para operadores.
- **Portal web** con login (JWT) para monitoristas Exiros.
- **Backend/API único** (NestJS) que recibe la telemetría y cierra el viaje.

Núcleo del producto: **rastreo en segundo plano con < 10 % de batería por jornada** y **cierre automático del viaje por geocerca**.

> **Estado:** MVP funcional de extremo a extremo. Móvil (crear viaje → rastrear en 2.º plano → cerrar) + portal web (Mapa, Viajes, detalle, Destinos, Usuarios, export Excel) + backend (auth JWT + tripToken, cierre por geocerca, reportes). Falta verificación humana de algunos bloques y el KPI de batería (no medible en emulador).

---

## ▶️ Cómo levantar (local)

Requisitos: Docker, Node 20+, JDK 21, Android SDK con un emulador (AVD).

```bash
# 1) Base de datos (Postgres en Docker)
docker compose -f infra/docker-compose.yml up -d

# 2) Backend (migraciones + seed admin + build + arrancar en :3000)
cd backend
npx prisma migrate deploy && npx prisma db seed && npm run build
node dist/main.js          # deja esta terminal corriendo

# 3) Portal web (:5173)
cd web && npm run dev      # otra terminal

# 4) App Android (emulador)
~/Library/Android/sdk/emulator/emulator -avd <tu-AVD> -no-snapshot-save   # otra terminal
cd android && JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew assembleDebug
~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- **Portal:** http://localhost:5173 → login `admin@exiros.com` / `admin1234` (lo crea el seed; idempotente).
- **Ver la BD:** `cd backend && npx prisma studio`.
- ⚠️ Si el portal da 500 o el login falla, casi siempre el contenedor de Postgres se cayó (la máquina durmió). Revisa `docker ps` y re-corre el paso 1, luego reinicia `node dist/main.js`.
- ⚠️ Tras tocar el backend, **reconstruir + reiniciar** `node dist/main.js` (un endpoint nuevo da 404 si corre el `dist` viejo).
- El **emulador** alcanza el backend en `http://10.0.2.2:3000`. Para un **teléfono físico** o red externa, abre un túnel: `./scripts/tunnel.sh` (ver abajo).

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
