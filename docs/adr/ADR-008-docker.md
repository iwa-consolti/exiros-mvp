# ADR-008 — Docker

- **Estado:** ✅ Aceptado (2026-06-18, Rogelio)
- **Decide:** alcance del uso de Docker en el proyecto.

## Contexto
El proyecto marca **despliegue cloud y CD como NO requeridos** → infra al mínimo demostrable. Lo que sí se necesita: levantar **PostgreSQL local** de forma reproducible y un arranque fácil para el **auditor que clone el repo**.

## Decisión
**`docker-compose.yml` solo como conveniencia local**, con **PostgreSQL** (y opcionalmente el backend). No es obligatorio para correr la app (se puede usar un Postgres ya instalado).
- Variables en **`.env`** (no versionado) + **`.env.example`** (versionado).
- Vive en `/infra`. Un solo `docker compose up` levanta la DB.

## Alternativas consideradas
- **Dockerizar todo + multi-stage para producción:** sobra, no hay entorno de producción formal (el deploy de demo lo cubre ADR-009).
- **Postgres instalado a mano sin compose:** frágil y mal documentado para quien clone el repo en la auditoría.

## Consecuencias
**Positivas:** arranque en un comando, reproducible, suma puntos en auditoría.
**Negativas:** dependencia de Docker en la máquina de desarrollo.

## Riesgos y reversibilidad
Riesgos operativos menores: **puertos ocupados** y **persistencia de volúmenes** → se documentan en el README. Reversible: añadir un servicio al compose más adelante es trivial.
