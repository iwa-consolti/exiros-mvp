# ADR-004 — Stack de la app Android

- **Estado:** ✅ Aceptado (2026-06-18, Rogelio)
- **Decide:** tecnología de la app Android del operador. Aquí vive el **riesgo #1** del proyecto: rastreo en **segundo plano** fiable y eficiente.

## Contexto
El núcleo del producto es **rastreo en 2º plano con <10% batería/jornada** + **cierre automático por geocerca**. Restricciones que gobiernan: **código auditable** (concurso, el ganador continúa), **$0**, español, **sin login** en la app. El doc de batería del cliente describe a mano *batching + distance filter + activity recognition + fused location + hibernación* — exactamente las APIs nativas de Android.

**Restricción de hardware (H6):** **no hay teléfono físico disponible** hoy. El desarrollo y la demo serán sobre **emulador**; las pruebas reales de batería y de "battery killers" de OEM se posponen a cuando se consiga un dispositivo.

## Decisión
**Kotlin nativo**, sobre las APIs de Android:
- **`FusedLocationProviderClient`** (Google Play Services Location) — ubicación eficiente (fusiona GPS+WiFi+celular).
- **`ActivityRecognition`** — detectar movimiento/quietud para hibernar el rastreo.
- **Foreground Service** + notificación persistente — sobrevivir en 2º plano.
- **Room** — cola local de ubicaciones con `syncState` (PENDING/SENT/FAILED).
- **WorkManager** — envío por **lotes GZIP** cada 15–20 min, con reintentos.

**Plan B documentado** (red de seguridad, NO el plan): si en la **bala trazadora (Slice 0)** el servicio en 2º plano no resulta viable y no avanzo en ~1 día, salto a un plugin cross-platform (`background_geolocation`) en **build debug** (gratis) solo para no perder la demo. El contrato con el backend no cambia, así que el salto es contenido.

## Alternativas consideradas
- **Java nativo:** mismas APIs, pero lenguaje más verboso/antiguo; Google prioriza Kotlin y la IA genera Kotlin más limpio. Sin ventaja → descartado.
- **Flutter/RN + `background_geolocation` (Transistorsoft):** resuelve la energía de fábrica, pero (1) gran parte del núcleo **no sería código propio** → peor en auditoría; (2) la **licencia pesa en release** (el ganador continúa), aunque en debug sea $0. Degradado a **Plan B**.
- **Plugins gratis de Flutter/RN** (`geolocator`, `flutter_background_service`): poco fiables justo en 2º plano = **empeoran el riesgo #1**; obligarían a reimplementar la energía encima del plugin. Descartado.
- **Capacitor / Ionic / Expo (web envuelta):** GPS en 2º plano es su punto débil. Descartado para el núcleo.

## Consecuencias
**Positivas:** control total de la estrategia de energía (lo que se quiere *medir*); código 100% propio y auditable; $0; encaja exactamente con el doc del cliente.
**Negativas:** mayor volumen de código y curva de **foreground services + permisos Android 13/14**; Rogelio **no conoce Kotlin** → mitigado por: la IA escribe y explica, Rogelio **lee y valida** (regla dura "no aceptar código que no entiendas"); Kotlin es legible (cercano a TypeScript/Swift).

## Riesgos y reversibilidad
- **Riesgo #1 (2º plano / OEM):** se ataca **temprano** con la bala trazadora; Plan B como escape.
- **Sin teléfono físico (H6) — deuda de validación explícita:** el emulador permite ver UI, probar el flujo de **permisos** y **reproducir rutas GPS simuladas** → la demo del **cierre por geocerca es viable**. PERO el emulador **NO mide batería real** ni reproduce los battery-killers de OEM → la métrica **"<10% batería/jornada" queda como objetivo de diseño, NO verificado**, hasta probar en dispositivo real. No se reporta como "cumplido".
- **Reversibilidad:** el contrato con el backend (`POST /trips`, `POST /trips/:id/locations` GZIP + `tripToken`) es **agnóstico del cliente** → un eventual salto a Plan B no toca el backend.
