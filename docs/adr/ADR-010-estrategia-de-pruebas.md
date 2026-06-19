# ADR-010 — Estrategia de pruebas

- **Estado:** ✅ Aceptado (2026-06-18, Rogelio)
- **Decide:** qué se prueba y con qué, en 8 días y como dev solo.

## Contexto
El concurso **audita el código** (la calidad pesa), pero **E2E y pruebas de carga NO son requeridos**. Dev solo + ventana corta → testear **lo que paga**: la lógica de negocio, no la UI ni el framework.

## Decisión
**Jest unitario en services + e2e de API con Supertest en endpoints críticos.**
- **Unit (Jest):** lógica de negocio — **geocerca/haversine**, máquina de estados del viaje, validaciones de campos.
- **e2e de API (Supertest):** endpoints críticos — `POST /trips`, ingesta de lote `POST /trips/:id/locations` (GZIP + tripToken), cierre automático/manual.
- **Manual:** flujo móvil en **emulador** (sin teléfono físico, ver ADR-004 / H6); flujo web navegado a mano y **visto renderizado**.

## Alternativas consideradas
- **TDD estricto:** demasiado lento para vibe-coding con IA en 8 días.
- **Sin tests:** reprueba la auditoría y rompe la regla "la verdad se ejecuta".
- **E2E de UI (Cypress/Playwright) y pruebas de carga:** explícitamente **no requeridos** → fuera de alcance.

## Consecuencias
**Positivas:** cobertura donde de verdad importa, auditable; tests como red de regresión de la lógica crítica.
**Negativas:** la UI se valida **a mano**, no automatizada → riesgo de regresión visual.

## Riesgos y reversibilidad
- Regresiones de UI no atrapadas → mitigado por validación visual manual en cada slice.
- Reversible: añadir Playwright post-MVP si el proyecto continúa.
