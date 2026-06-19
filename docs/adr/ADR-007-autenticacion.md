# ADR-007 — Autenticación

- **Estado:** ✅ Aceptado (2026-06-18, Rogelio)
- **Decide:** cómo se autentican los **dos clientes**: portal web (con login) y app móvil (sin login).

## Contexto
- **Web** = monitoristas/admin de Exiros → login usuario/contraseña, sesiones de consola.
- **Móvil** = operador externo → **sin login** (requisito duro de adopción), pero la **ingesta no puede ser abierta**: cualquiera podría inyectar viajes/coordenadas falsas (H5, spoofing, datos basura).
- Los seniors pidieron además **rechazar coordenadas de un viaje ya terminado o de otro dispositivo** (invariante S-05).

## Decisión
**JWT para web + `tripToken` para móvil, separados por Guards de NestJS (una sola API).**
- **Web:** **JWT** (access token). Rutas **`/api/web/*`** protegidas por **Guard JWT**.
- **Móvil:** **`tripToken`** — credencial *bearer* ligada a **UN viaje + un dispositivo**, emitida en `POST /trips`, enviada en `Authorization` en cada lote, **invalidada al cerrar el viaje**. Rutas **`/api/mobile/*`** protegidas por **Guard tripToken**.
- Separación por **Guards/Interceptors de NestJS**, NO por AOP estilo Spring.

## Alternativas consideradas
- **Usuario/contraseña en móvil:** rompe la adopción (requisito explícito: sin login). Descartado.
- **Ingesta 100% abierta:** spoofing y datos basura. Descartado.
- **API key global de la app:** si se filtra, compromete *toda* la ingesta; `tripToken` **acota el blast radius a un solo viaje** y se autoinvalida. Descartado a favor de tripToken.
- **OAuth / sesiones server-side en web:** sobra para una consola interna. JWT basta.

## Consecuencias
**Positivas:** ingesta protegida sin pedir login al operador; `tripToken` resuelve H5 **y** la invariante S-05 (no aceptar coords de viaje terminado/otro device) **con el mismo mecanismo**.
**Negativas:** hay que emitir, almacenar y validar el token; el secreto JWT debe vivir **fuera del repo** (`.env`).

## ⚠️ Defensa en capas del endpoint público de ingesta (CRÍTICO)
La ingesta móvil es **pública y sin login** → es la **mayor superficie de ataque** del sistema. El `tripToken` es la primera barrera, NO la única. La seguridad transversal se implementa con las **primitivas nativas de NestJS** (Guards/Interceptors/Pipes/Filters compuestos sobre `/api/mobile/*`), que cumplen el rol que en Spring haría AOP — **NestJS no usa AOP**, no buscarlo.

Capas obligatorias sobre `/api/mobile/*`:
1. **Transporte:** solo **HTTPS/TLS** (lo dan túnel y deploy de ADR-009).
2. **AuthN — Guard `tripToken`:** rechaza sin token / token inválido / **viaje ya cerrado** / token de **otro dispositivo** (invariante S-05).
3. **Rate-limit — Interceptor (`@nestjs/throttler`) por tripToken:** un viaje legítimo emite ~1 lote cada 15–20 min; cortar floods. Apoyarse en `lastLocationAt`.
4. **Validación — `ValidationPipe` + DTO `whitelist`/`forbidNonWhitelisted`:** lat/lng en rango, **timestamp no futuro**, **bbox MX** de cordura, tope de puntos por lote, rechazar campos desconocidos. (NO rechazar coords "fuera de geocerca": la ruta vive fuera de ella.)
5. **Tamaño — límite de body + tope al descomprimir GZIP:** evitar payloads gigantes / zip-bombs (DoS).
6. **Errores — Exception Filter global:** sin fuga de info interna.
7. **Observabilidad:** loguear rechazos (token inválido, payload sobredimensionado, coords fuera de rango) para detectar abuso.

### Endurecimiento adicional — capas MVP (decidido 2026-06-18)
8. **`tripToken` hasheado en reposo:** guardar `SHA-256(token)` en BD (como una contraseña), comparar hashes. Si se filtra la BD, los tokens no sirven. Costo ~nulo.
9. **Idempotencia por lote (`batchId` UUID):** el server ignora lotes duplicados → frena **replays** y duplicados por reintentos de red. Encaja con la cola `syncState` de Android.
10. **Chequeo de "teletransporte":** entre puntos consecutivos, velocidad implícita imposible (>~150 km/h) = sospechoso. Anti-spoofing + calidad de dato. **Marcar/cuarentena, no rechazar en duro** (por jitter de GPS en paradas).
11. **`helmet` + CORS cerrado:** headers de seguridad; `/api/mobile/*` **sin CORS** (app nativa), `/api/web/*` restringido al origen del portal.
12. **Rate-limit de borde vía Cloudflare:** el túnel `cloudflared` (ADR-009) ya pasa por Cloudflare → rate-limit por IP y mitigación DDoS **sin código**. Activar y aprovechar.

### Upgrade path post-MVP (anotado, NO construir ahora)
- **Firma HMAC del payload / rotación de token por lote** — robustez extra sobre el tripToken.
- **Device attestation (Play Integrity API)** — probar que el cliente es la app real, no un script. Defensa fuerte anti-spoofing, complejidad alta.
- **WAF con reglas custom / detección de anomalías** — sobreingeniería para el MVP.

## Riesgos y reversibilidad
- Token en tránsito → exige **HTTPS** (el túnel y el deploy de ADR-009 ya dan TLS).
- **Reversibilidad alta:** añadir refresh tokens, rotación, HMAC de payload o device-attestation es post-MVP y no cambia el modelo de dos guards.
