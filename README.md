# Exiros — On-Route Tracker (MVP)

Solución **independiente** de rastreo en ruta de camiones de chatarra (patio vendedor → patio comprador):

- **App Android** de acceso libre (sin login) para operadores.
- **Portal web** con login (JWT) para monitoristas Exiros.
- **Backend/API único** (NestJS) que recibe la telemetría y cierra el viaje.

Núcleo del producto: **rastreo en segundo plano con < 10 % de batería por jornada** y **cierre automático del viaje por geocerca**.

> **Estado:** Fase 0 (diseño y specs) **completa**. Repositorio de **documentación**; el código (`/backend`, `/web`, `/android`) se genera a partir de estas specs empezando por el **Bloque 1.1 (scaffolding)**.

---

## 🗺️ Mapa de la documentación

Leer en este orden al iniciar cualquier sesión:

| # | Documento | Qué contiene |
| :-- | :-- | :-- |
| 1 | [`CONTEXT-AI.md`](CONTEXT-AI.md) | **Contexto vivo entre sesiones.** Stack congelado, reglas duras, decisiones cerradas y "▶️ retomar aquí". Leer SIEMPRE primero. |
| 2 | [`PLAN.md`](PLAN.md) | Plan maestro, backlog de bloques (Fases 1–9) y bitácora. |
| 3 | [`2026 Exiros alcance MVP On-Route Tracker.md`](2026%20Exiros%20alcance%20MVP%20On-Route%20Tracker.md) | Alcance / requisitos del cliente (fuente de verdad del negocio). |
| 4 | [`IWA-Exiros - Estrategia Ágil-170626-174841.md`](IWA-Exiros%20-%20Estrategia%20%C3%81gil-170626-174841.md) | Reglas de la competencia interna iWA. |

### Especificaciones (`/docs`)

| Doc | Contenido |
| :-- | :-- |
| [`docs/functional-spec.md`](docs/functional-spec.md) | Máquina de estados (En ruta → Concluido), reglas funcionales S-01…S-07. |
| [`docs/api-spec.md`](docs/api-spec.md) | Contratos `/api/web/*` (JWT) y `/api/mobile/*` (tripToken), ingesta GZIP idempotente. |
| [`docs/database-spec.md`](docs/database-spec.md) | 4 entidades (User, Destination, Trip, Location) + borrador `schema.prisma`. |
| [`docs/uiux-spec.md`](docs/uiux-spec.md) | Brief de UI/UX: 5 pantallas móvil (M1–M5) + 6 web (W0–W5). |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (decisiones de arquitectura) — ver abajo. |

---

## 🧱 Stack congelado

| Capa | Tecnología | ADR |
| :-- | :-- | :-- |
| Backend | NestJS (TypeScript), monolito modular | 002 |
| ORM | Prisma | 006 |
| Base de datos | PostgreSQL | 005 |
| Web | React + Vite + TS · mapa Leaflet + OpenStreetMap | 003 |
| Android | Kotlin nativo (FusedLocation + ActivityRecognition + Foreground Service + Room + WorkManager) | 004 |
| Auth | JWT (web) + **tripToken** bearer por viaje/dispositivo (móvil) | 007 |
| Geocerca | Círculo (centro+radio) + haversine en el service (sin PostGIS) | 012 |
| Infra | Docker solo para Postgres local · deploy túnel + Railway (pend.) | 008 / 009 |
| Tests | Jest unit + Supertest e2e | 010 |

> Repositorio **monorepo** split-ready (ADR-001). Cambiar el stack exige actualizar el ADR correspondiente.

---

## 📐 Estructura objetivo del repo

```
/exiros-mvp
  /backend   # NestJS + Prisma       (pendiente: Bloque 1.1)
  /web       # React + Vite          (pendiente)
  /android   # Kotlin                (pendiente)
  /docs      # specs + /adr          ✅
  /infra     # docker-compose, .env.example
  /scripts   # seed destinos, simulador de ruta
  PLAN.md  CONTEXT-AI.md  README.md  ✅
```

---

## ⚠️ Reglas duras (resumen — detalle en `CONTEXT-AI.md`)

- App Android **sin login** → `/api/mobile/*` es la mayor superficie de ataque: **defensa en capas** (HTTPS + Guard tripToken + rate-limit + ValidationPipe estricto + tope de body + Exception Filter + log de rechazos). Ver **ADR-007**.
- **No** lógica de negocio en controllers. **No** endpoints sin validación. **No** subir secretos (`.env` fuera del repo; `.env.example` sí).
- No cambiar arquitectura sin actualizar el ADR; no cambiar la API sin actualizar la API Spec.
- Reporte Excel: **exactamente 13 columnas** del doc de alcance §6.
- KPI "< 10 % batería" = objetivo de diseño **no verificable en emulador**; nunca reportarlo como cumplido sin teléfono físico.

---

## ▶️ Cómo retomar en la próxima sesión

1. Leer `CONTEXT-AI.md` y `PLAN.md` (no re-explorar el repo si esos bastan).
2. Siguiente paso de código: **Bloque 1.1 — scaffolding del monorepo** (`git`, carpetas de código, `docker-compose` de Postgres).
3. Ejecutar bloques con la metodología: `/bloque <id>` (ej. `/bloque 1.1`).

> Metodología de trabajo: `~/.agents/METODOLOGIA.md` (protocolo maestro, se auto-carga vía el `CLAUDE.md` global).
