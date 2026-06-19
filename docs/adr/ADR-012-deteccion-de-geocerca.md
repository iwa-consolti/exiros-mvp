# ADR-012 — Detección de geocerca

- **Estado:** ✅ Aceptado (pendiente confirmar) (2026-06-17)
- **Decide:** cómo se determina que un punto llegó al destino (cierre automático).
- **Origen:** los seniors pidieron evaluar **tipos de dato espaciales** (Spatial Data Types / PostGIS).

## Contexto
La geocerca de destino es un **círculo**: centro (lat/lng) + radio en metros. Detectar la llegada = "¿el punto está dentro del radio?". Hay pocos destinos (XX) y volumen bajo. El stack usa **Prisma** (type-safe).

## Decisión
**Calcular la distancia con haversine en el Service (TypeScript), con pruebas unitarias.** Sin PostGIS para el MVP.
`dentro = haversine(punto, centro) <= radio`. La detección corre en el service de ingesta al recibir cada lote (un punto dentro del radio → cierre automático, RN-04).

## Alternativas consideradas — Spatial Data Types / PostGIS
Tipos geográficos (`POINT`, `POLYGON`, `GEOGRAPHY`) con índices espaciales (GiST) y funciones `ST_DWithin`/`ST_Contains`.
- **A favor:** índices espaciales rapidísimos con **miles** de geocercas; soporta **polígonos** (no solo círculos); distancia geodésica exacta.
- **En contra (para este MVP):** es una **extensión** que hay que habilitar (no todos los hosts gestionados la traen); **no encaja con Prisma** → obliga a SQL crudo (`$queryRaw`), perdiendo la type-safety que motivó elegir Prisma; curva extra; **overkill** para círculos y volumen bajo. Los propios seniors notan que "no se necesitan grandes operaciones".

## Cuándo reconsiderar (upgrade path)
Migrar a PostGIS si: las geocercas pasan a ser **polígonos**, hay que evaluar **miles** de geocercas por punto, o aparecen consultas espaciales complejas. Como elegimos **PostgreSQL** (ADR-005), ese salto es posible **sin cambiar de motor**.

## Consecuencias
**Positivas:** lógica visible, auditable y testeable; cero infra extra; conserva type-safety de Prisma.
**Negativas:** una geometría de círculo hecha "a mano" (aceptable: es trivial y está cubierta por tests).

## Riesgos
Haversine mal implementado (radio terrestre/unidades) → mitigación: **pruebas unitarias** con casos conocidos (punto en el centro, justo en el borde del radio, fuera).
