# ADR-006 — ORM / acceso a datos

- **Estado:** ✅ Aceptado (2026-06-17, Rogelio)
- **Decide:** la capa de acceso a datos (ORM) del backend.
- **Nota:** decisión **independiente del motor** (Prisma soporta Postgres y MySQL por igual; el motor sigue intercambiable).

## Contexto
Backend NestJS sobre un modelo relacional. Necesitamos: **inserción de lotes** de ubicaciones (ingesta), **type-safety** (menos bugs, mejor defensa en auditoría), migraciones versionadas y alta velocidad de desarrollo con IA. Escala pequeña (~200 usuarios, bajo volumen) → el rendimiento del ORM no es un factor limitante.

## Decisión
**Prisma.**
- Cliente **type-safe** generado del schema → autocompletado y errores en compilación.
- **Migraciones** versionadas y sólidas.
- `createMany` para insertar lotes de ubicaciones eficientemente.
- **Schema declarativo legible** → fácil de auditar.
- **Máxima fluidez con IA** (genera Prisma con muy pocos errores).

## Alternativas consideradas
- **TypeORM:** decoradores en entidades (modelo mental **JPA/Hibernate**, familiar desde Java) e integración nativa con NestJS. Rechazada: type-safety menor y migraciones históricamente frágiles; la familiaridad no es criterio (la curva no pesa por decisión del dev).
- **Drizzle:** moderno, ligero, type-safe, SQL-like. Rechazada: más manual, ecosistema más joven y menor fluidez con IA para 9 días.
- **MikroORM / Kysely / Sequelize:** descartadas (MikroORM más complejo; Kysely es query builder, no ORM completo; Sequelize es JS-first con TS débil).

## Consecuencias
**Positivas:** menos bugs por type-safety; migraciones reproducibles; ingesta de lotes eficiente; código auditable; desarrollo rápido con IA.
**Negativas:** consultas avanzadas/espaciales requieren `$queryRaw` — **no las necesitamos** (la geocerca es haversine en el service, ADR-012).

## Riesgos
Bajos. El motor permanece intercambiable (cambiar `provider` + regenerar migraciones), lo que mantiene reversible la decisión de ADR-005.
