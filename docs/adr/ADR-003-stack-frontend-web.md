# ADR-003 — Stack del frontend web

- **Estado:** ✅ Aceptado (2026-06-17, Rogelio)
- **Decide:** tecnología del portal web administrativo y su mapa.

## Contexto
El portal es una **consola interna** para monitoristas/admin, **tras login**. No necesita SEO ni renderizado en servidor (SSR). Requiere un **mapa** de unidades en ruta y debe ser rápido de construir por dev solo + IA, y fácil de continuar.

## Decisión
**SPA en React + Vite + TypeScript.** Mapa con **Leaflet + OpenStreetMap** (gratis, sin API key ni billing).
- **React:** ecosistema #1, la IA lo genera con alta fiabilidad, `react-leaflet` listo, fácil de continuar.
- **Vite:** dev server instantáneo (HMR), config mínima.

## Alternativas consideradas
- **Next.js.** Rechazada: aporta SSR/routing de servidor que aquí **no se necesitan** (consola tras login, sin SEO) y añade una capa de servidor Node.
- **Angular.** Más ceremonia y más lento de iterar con IA en 9 días.
- **Vue / Svelte.** Válidos, pero menor ecosistema y menor fluidez de generación con IA.
- **Create React App.** Obsoleto/lento.
- **Google Maps.** Rechazado como proveedor de mapa: requiere tarjeta/API key con billing. Leaflet+OSM es $0.

## Consecuencias
**Positivas:** desarrollo rápido (HMR), generación con IA muy fiable, `react-leaflet` cubre el mapa, costo $0.
**Negativas:** una SPA depende del API para todo (aceptable aquí); los tiles de OSM tienen límites de uso (suficiente para demo).

## Riesgos
Límite de tiles OSM en la demo → mitigación: cachear o usar un proveedor de tiles alterno si llegara a fallar.
