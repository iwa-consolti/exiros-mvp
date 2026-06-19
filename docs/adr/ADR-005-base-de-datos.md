# ADR-005 — Base de datos

- **Estado:** ✅ Aceptado (2026-06-17, Rogelio)
- **Decide:** motor de base de datos del backend.

## Contexto
Datos **relacionales** (`Trip` 1—N `Location`, `Trip` N—1 `Destination`, `User`); el reporte de 13 columnas sale de **joins**. Volumen bajo (lotes de ~10 puntos cada 15–20 min por camión) pero con **escritura de ingesta y lectura web concurrentes**. Requisitos: solución **independiente/aislada** y **código auditable** (concurso). Los seniors pidieron además considerar **tipos de dato espaciales** (ver ADR-012).

## Decisión
**PostgreSQL.**

Razones (incluye criterio de Rogelio):
1. **Independiente y propio** (no BaaS de terceros).
2. **Escala fuerte** si el proyecto crece (el ganador continúa).
3. **Rápido de implementar** con IA + Prisma (soporte de 1.ª clase).
4. **Estricto y con tipos ricos** (JSONB, arrays, UUID) → atrapa bugs, bueno para auditoría.
5. Deja **abierta la puerta a PostGIS** si en el futuro las geocercas dejan de ser círculos (sin obligarnos a usarlo hoy).

## Alternativas consideradas
- **MySQL/MariaDB:** empate técnico real; rechazada solo por la ventaja marginal de Postgres en estrictez/tipos/Prisma. Habría sido igual de defendible.
- **SQLite:** concurrencia de escritura débil (1 escritor) → no apto para ingesta+web concurrentes en producción.
- **MongoDB:** los datos son relacionales y el reporte vive de joins; el modelo documento no calza.
- **Supabase (BaaS):** rápido, pero añade dependencia de un tercero y reduce el código propio auditable (mismo motivo por el que se descartó BaaS en backend).

## Consecuencias
**Positivas:** ajuste perfecto al modelo; soporte Prisma; robustez; auditable; sin atadura.
**Negativas:** requiere un servidor (Docker local / managed en demo) vs la simpleza de SQLite.

## Riesgos y reversibilidad
Riesgo bajo. **Lock-in mínimo:** Prisma abstrae el cliente; cambiar de motor sería revisar el schema + generar nuevas migraciones, no reescribir la app. La duda de "¿y si mejor otro?" queda cubierta por esta reversibilidad.
