# ADR-002 — Arquitectura y framework del backend

- **Estado:** ✅ Aceptado (2026-06-17, Rogelio)
- **Decide:** arquitectura interna del backend y el framework que la implementa.

## Contexto
Un backend único sirve a la web y a la app Android. Debe ser **auditable** (rúbrica de código), **testeable** (vamos con TDD donde aplique), **seguro** y **rápido de construir** por un dev solo + IA en 9 días. El dev viene de Java pero pidió explícitamente **la mejor opción técnica, no la de confort** (la curva de aprendizaje no es criterio).

## Decisión
**Monolito modular por features con capas internas, sobre NestJS (TypeScript).**
- Módulos: `trips`, `locations` (ingesta), `destinations` (geocercas), `users/auth`, `reports`.
- Capas por módulo: Controller (HTTP) → Service (negocio) → Repository (datos) → DTO/Mapper.

**Por qué NestJS:** trae de fábrica estructura modular, inyección de dependencias, validación (`class-validator`), generación de OpenAPI y testing (Jest) → código ordenado y auditable **sin montar andamiaje propio**. Además unifica backend y frontend en TypeScript: menos cambio de contexto para dev e IA, y posibilidad de **compartir tipos/DTOs**. El OpenAPI se genera del propio código → el contrato no se desincroniza.

## Alternativas consideradas
- **Spring Boot (Java).** Igual de estructurado y auditable, y conocido por el dev. Rechazada: más verboso, scaffolding más pesado para 9 días, **suma un 3er lenguaje** al proyecto (Java + TS + Kotlin) y no comparte tipos con el front.
- **Express / Fastify (Node).** Mínimos y rápidos, pero la estructura se arma a mano → riesgo de desorden bajo presión y peor defensa en auditoría.
- **Microservicios.** Sobreingeniería para dev solo / dominio acotado / 9 días: añade infra y ceremonia sin pagar valor.

## Consecuencias
**Positivas:** código auditable y testeable; integración limpia vía OpenAPI; seguridad integrada (guards JWT, validación); solo 2 lenguajes en el proyecto.
**Negativas:** curva inicial de NestJS (aceptada explícitamente por el dev).

## Riesgos
Desconocimiento inicial del framework → se mitiga con la **bala trazadora temprana** (esqueleto end-to-end antes de engordar) y validación de código generado por IA.
