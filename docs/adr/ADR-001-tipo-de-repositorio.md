# ADR-001 — Tipo de repositorio

- **Estado:** ✅ Aceptado (2026-06-17, Rogelio)
- **Decide:** cómo se organiza el código de los 3 componentes (backend, web, android).

## Contexto
Dev solo + IA, 9 días, auditoría de código en `main` (César/Emanuel) y el equipo ganador continúa el proyecto. Necesitamos una organización que (a) dé a la IA el contexto completo, (b) sea fácil de auditar, (c) no acople los *builds* entre componentes.

## Decisión
**Monorepo único "split-ready".**
```
/exiros-on-route-tracker
  /backend  /web  /android  /docs  /infra  /scripts
```
Con límites de carpeta limpios y el **OpenAPI como contrato** entre back y front/android. **No se agenda** la separación en 3 repos: se hará solo si aparece un disparador real.

**Disparadores que justificarían separar (revisar entonces, no antes):** propiedad/equipos distintos por componente, ciclos de release independientes, escalado independiente, o entregar `/android` a otro proveedor.

## Alternativas consideradas
- **Polyrepo (3 repos: back, web, android).** Separación más limpia por tecnología y CI propio. Rechazada *por ahora*: para un dev solo + IA triplica overhead (3 clones, cambios cruzados = 3 commits, la IA pierde contexto) y obliga al auditor a correlacionar 3 repos. Sin disparador presente, no paga su costo.

## Consecuencias
**Positivas:** contexto único para la IA; commits atómicos que cruzan el stack; el auditor ve un *vertical slice* completo en un PR; el APK (Gradle) y el deploy del backend siguen siendo *builds* independientes pese a vivir juntos.
**Negativas:** conviven dos toolchains (npm + gradle) en un repo; repo más grande.

## Riesgos
Mínimos para dev solo (conflictos de merge casi nulos). El desacople real lo da el contrato OpenAPI, no el límite de repo → separar después es barato si se mantiene la higiene.
