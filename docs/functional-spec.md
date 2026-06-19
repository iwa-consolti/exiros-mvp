# Functional Spec — Exiros On-Route Tracker (MVP)

> Bloque 0.2 del backlog. Fuente de verdad funcional. Deriva del doc de alcance (`2026 Exiros alcance MVP On-Route Tracker.md`) y del `PLAN.md`.
> De aquí salen la API Spec (0.3) y la Database Spec (0.4). Si una regla cambia, se cambia **aquí primero**.

---

## 1. Propósito y alcance

Definir **qué hace** el sistema (comportamiento observable), no **cómo** lo hace. Cubre: registro de viaje, rastreo, cierre (automático y manual), monitoreo web, destinos/geocercas, usuarios y reportes.

**Fuera de alcance funcional (MVP):** notificaciones push, roles finos, iOS, dashboards, ruteo/ETA, reabrir viajes cerrados.

---

## 2. Actores

| Actor | Canal | Autenticación |
| :-- | :-- | :-- |
| **Operador / fletero** | App Android | Ninguna (acceso libre) |
| **Monitorista** | Portal web | Login (JWT) |
| **Administrador** | Portal web | Login (JWT) — superset de monitorista |
| **Sistema** | Backend | Procesos automáticos (geocerca) |
| **Auditor** (implícito) | Portal web | Consume el reporte Excel |

---

## 3. Casos de uso

| ID | Caso de uso | Actor | Prioridad |
| :-- | :-- | :-- | :-- |
| CU-01 | Registrar e iniciar viaje | Operador | Obligatorio |
| CU-02 | Adjuntar foto de carga | Operador | Obligatorio |
| CU-03 | Rastreo en segundo plano (captura + envío por lotes) | Operador/Sistema | Obligatorio |
| CU-04 | Cierre automático por geocerca | Sistema | Obligatorio |
| CU-05 | Cierre manual por operador (con observaciones) | Operador | Obligatorio |
| CU-06 | Cierre manual por administrador (con observaciones) | Monitorista/Admin | Obligatorio |
| CU-07 | Monitorear viajes activos en mapa | Monitorista | Obligatorio |
| CU-08 | Administrar destinos/geocercas (CRUD) | Admin | Obligatorio |
| CU-09 | Administrar usuarios monitoristas (alta/baja) | Admin | Obligatorio |
| CU-10 | Login al portal | Monitorista/Admin | Obligatorio |
| CU-11 | Exportar reporte de viajes (.xlsx, 13 columnas) | Auditor/Monitorista | Obligatorio |

### Detalle de los casos críticos

**CU-01 — Registrar e iniciar viaje**
1. El operador abre la app → ve directo el formulario (sin login).
2. Llena los 7 campos (§6) y adjunta foto (CU-02).
3. Al validar OK y tocar "Iniciar viaje", se crea el viaje con estado **En ruta** y timestamp de inicio.
4. Arranca el rastreo (CU-03).
- *Errores:* validación de campos (§6); **sin red no se puede iniciar** (S-04): el inicio requiere conexión para registrar el origen y subir la foto.

**CU-03 — Rastreo en segundo plano**
1. La app captura coordenada pasiva cada 2–3 min (Fused Location) y la guarda local.
2. Aplica **distance filter** (ignora si no se movió ≥300–500 m) y **hibernación** (si actividad = STILL, apaga GPS).
3. Cada 15–20 min envía el lote acumulado comprimido (GZIP) al backend.
- *Errores:* envío falla → reintento, el lote no se pierde (cola local).

**CU-04 — Cierre automático por geocerca**
1. El backend recibe un lote y, por cada punto, calcula distancia (haversine) al centro del destino del viaje.
2. Si algún punto cae **dentro del radio**, marca el viaje **Concluido**, tipo de cierre = *Automático por geocerca*, registra fin = timestamp del punto que entró.
3. En el siguiente sync, la app recibe la orden de **detener GPS**.
- *Borde:* puntos que lleguen tras el cierre → se descartan (S-05).

---

## 4. Máquina de estados del viaje

Estados según doc §6 (columna 11): **solo dos**, `En ruta` y `Concluido`. `Concluido` es terminal (no se reabre en MVP).

```
        [crear viaje, formulario válido]
                    │
                    ▼
              ┌───────────┐
              │  EN RUTA  │◄──── (rastreo activo, recibe lotes)
              └─────┬─────┘
                    │
   ┌────────────────┼─────────────────────┐
   │                │                      │
   ▼                ▼                      ▼
[punto dentro    [operador toca       [admin fuerza
 de geocerca]     "Finalizar" +        cierre +
                  observación]         observación]
   │                │                      │
   └────────────────┴──────────┬───────────┘
                               ▼
                        ┌────────────┐
                        │ CONCLUIDO  │ (terminal)
                        └────────────┘
```

### Tabla de transiciones

| Desde | Evento | Hacia | Tipo de cierre | Requiere observación | Efecto colateral |
| :-- | :-- | :-- | :-- | :-- | :-- |
| (none) | Crear viaje válido | En ruta | — | No | Inicia rastreo; timestamp inicio |
| En ruta | Punto dentro de geocerca | Concluido | Automático por geocerca | No | Orden detener GPS; fin = ts del punto |
| En ruta | Operador finaliza | Concluido | Manual por Operador | **Sí** | Orden detener GPS; fin = ts del cierre |
| En ruta | Admin fuerza cierre | Concluido | Manual por Administrador | **Sí** | Orden detener GPS; fin = ts del cierre |
| Concluido | (cualquiera) | — | — | — | Rechazado (terminal) |

**Invariantes:**
- Un viaje **Concluido** ignora lotes/ubicaciones posteriores.
- `Tipo de cierre` y `Fecha/Hora de Fin` se llenan **exactamente una vez**, en la transición a Concluido.
- `Observaciones` obligatorio **solo** si el cierre fue manual (operador o admin).

> **📌 Sugerencia para MVP v2.0 (NO implementar ahora):** agregar un estado intermedio **`En incidencia`** (o `Detenido`), no terminal, alcanzable desde `En ruta` y que regresa a `En ruta` o pasa a `Concluido`. Resuelve directamente el dolor de S-06: hoy un camión legítimamente parado (avería, ruta en reparación, cambio de órdenes) se ve **idéntico** a uno perdido — ambos quedan "En ruta". Con `En incidencia` el monitorista distingue "detenido con motivo conocido" de "lo perdí". Lo activaría el operador (botón) o el monitorista, con observación. Queda en backlog v2.0 por tiempo; para el MVP bastan 2 estados.

---

## 5. Reglas de negocio

- **RN-01** App de acceso libre: ninguna pantalla de login en Android.
- **RN-02** Los 7 campos del formulario son obligatorios excepto Placa Trasera (opcional).
- **RN-03** Geocerca = círculo (centro lat/lng + radio en metros). Detección por **haversine**, sin PostGIS.
- **RN-04** El cierre automático requiere un punto **dentro del radio dentro de un lote recibido** (no se infiere en tránsito) → mitiga falsos positivos al pasar cerca.
- **RN-05** `Duración Total` = `fin − inicio`, formato `HH:MM`, calculada por el sistema.
- **RN-06** `Estatus` ∈ {En ruta, Concluido}. `Tipo de cierre` ∈ {Automático por geocerca, Manual por Operador, Manual por Administrador}.
- **RN-07** El reporte Excel tiene **exactamente 13 columnas** (doc §6), en ese orden.
- **RN-08** Solo Admin gestiona destinos y usuarios; Monitorista puede monitorear y forzar cierre.
- **RN-09** El `Destino` del formulario se elige de un catálogo administrado en web (no texto libre).
- **RN-10** Ingesta protegida con token de dispositivo (pendiente H5) — la app no autentica usuario pero sí identifica origen.
- **RN-11** **Un solo viaje activo por dispositivo** (S-01): no se puede iniciar un viaje nuevo mientras exista uno En ruta en ese dispositivo.
- **RN-12** El **intervalo de envío de lotes es configurable** (S-07): default 15–20 min. El límite no es técnico (podría ser 1 min) sino **cuidar batería y datos móviles**. Si la optimización de energía lo permite, puede reducirse. Tratar como parámetro, no como constante.
- **RN-13** **Interacción mínima en la app móvil.** Todo el catálogo (destinos/geocercas) se crea y administra **solo desde el portal web** (Admin). La app móvil **no crea ni edita** datos de catálogo: únicamente **consume** las opciones existentes en el dropdown. Toda pantalla/acción que no sea estrictamente necesaria para iniciar/cerrar un viaje queda fuera de la app.
- **RN-14** **Catálogo de destinos vacío:** si no hay destinos activos, el operador **no puede iniciar viaje** (destino obligatorio, RN-09). La app muestra un **estado vacío** ("No hay destinos disponibles, contacta al administrador") y **bloquea** el inicio; no se rompe. Implica que el Admin debe crear ≥1 destino antes de operar.

---

## 6. Validaciones campo a campo (formulario de inicio)

| Campo | Tipo | Obligatorio | Regla | Mensaje de error (es) |
| :-- | :-- | :-- | :-- | :-- |
| Núm. de Proveedor | Numérico | Sí | Solo dígitos `^[0-9]+$` | "Solo números." |
| Nombre de Proveedor | Texto | Sí | No vacío, alfanumérico libre, trim | "Captura el nombre del proveedor." |
| Folio (Remito) Viaje | Numérico | Sí | Solo dígitos `^[0-9]+$` | "El folio debe ser numérico." |
| Placa Delantera | Alfanumérico | Sí | Flexible MX (ver abajo) | "Placa no válida." |
| Placa Trasera | Alfanumérico | No | Misma regla si se captura | "Placa no válida." |
| Foto de la Carga | Imagen | Sí | Cámara o galería; 1 archivo; jpg/png | "Adjunta la foto de la carga." |
| Destino | Selector | Sí | Debe ser un id del catálogo | "Selecciona un destino." |

**Regex placa MX (S-02, resuelto):** `^(?=.*[A-Z])(?=.*\d)[A-Z0-9- ]{5,10}$` aplicado tras normalizar (`toUpperCase`, recortar espacios extremos). Exige **al menos una letra y al menos un dígito** (toda placa MX los tiene), permite guion y espacio, longitud 5–10. Es más estricto que solo-alfanumérico pero "falla rápido" sin bloquear formatos estatales/federales válidos.

---

## 7. Errores esperados y manejo

| Escenario | Comportamiento esperado |
| :-- | :-- |
| Campo inválido en formulario | Bloquear envío, marcar campo, mensaje en español |
| Sin red al iniciar viaje | No se permite iniciar (S-04). Mensaje: "Necesitas conexión para iniciar el viaje." |
| Sin red al enviar lote | Reintento con backoff; el lote queda en cola local, no se pierde |
| Lote llega a viaje ya Concluido | 200/conflicto controlado; ubicaciones descartadas |
| Cierre manual sin observación | Rechazar; exigir observación |
| Token de dispositivo ausente/inválido en ingesta | Rechazar (401/403) |
| Login web fallido | Mensaje genérico, sin filtrar si existe el usuario |
| Destino sin geocerca configurada | No permite cierre automático; visible para el admin |
| Catálogo de destinos vacío (RN-14) | App muestra estado vacío y bloquea inicio; mensaje "No hay destinos disponibles, contacta al administrador" |

**Formato de error de API (de PLAN §8):** `{ error, message, details }`.

---

## 8. Criterios de aceptación (mapeo al doc §7)

- [ ] App abre directo en el formulario, sin login (RN-01).
- [ ] Los 7 campos validan según §6; placa flexible no bloquea formatos MX válidos.
- [ ] Foto obligatoria desde cámara o galería.
- [ ] Rastreo recolecta en segundo plano y transmite por lotes cada 15–20 min (GZIP).
- [ ] Hibernación: con actividad STILL se pausa el GPS.
- [ ] Cierre automático al entrar a la geocerca + orden de detener GPS.
- [ ] Cierre manual (operador y admin) exige observaciones.
- [ ] Mapa web renderiza unidades en ruta, refresco 15–20 min.
- [ ] CRUD de destinos/geocercas (centro+radio).
- [ ] Alta/baja de monitoristas; rutas web protegidas.
- [ ] Export .xlsx con exactamente las 13 columnas (RN-07).

---

## 9. Supuestos — estado de resolución

**Resueltos (Rogelio, 2026-06-17):**

| ID | Decisión final | Reflejado en |
| :-- | :-- | :-- |
| S-01 | ✅ **Un solo viaje activo por dispositivo.** | RN-11 |
| S-02 | ✅ Regex `^(?=.*[A-Z])(?=.*\d)[A-Z0-9- ]{5,10}$` (más estricto, falla rápido). | §6 |
| S-04 | ✅ **Iniciar requiere red** para registrar origen + subir foto. | §3 CU-01, §7 |
| S-05 | ✅ Ubicaciones que llegan tras el cierre se **descartan** silenciosamente (la app deja de rastrear al recibir la orden de stop). | §3 CU-04, §4 invariantes |
| S-06 | ✅ Viaje "perdido" lo **gestiona el monitorista** (puede salirse por avería, cambio de órdenes, ruta en reparación). Sin auto-expiración en MVP. | §4 nota v2.0 |
| S-07 | ✅ Refresco default **15–20 min**, configurable; el límite es batería+datos, no técnico. | RN-12 |
| S-03 | ✅ Foto **obligatoria y bloqueante** para iniciar (se sube con el inicio, coherente con S-04), capturable desde **cámara o galería**. | §6, §3 CU-02 |

> Todos los supuestos de esta spec están resueltos. Quedan abiertos solo los huecos externos H2/H5/H6 del PLAN (dependen de Julio/seniors).
