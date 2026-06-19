# UI/UX Spec — Exiros On-Route Tracker (MVP)

> **Bloque 0.6.** Brief de diseño con **límites duros**. Su propósito doble: (1) saber qué pantallas construir y qué estados maneja cada una; (2) servir de **documento de restricciones** para una IA de diseño (Claude Design) para que **no exceda el alcance**.
> Deriva de la Functional Spec (campos, validaciones, estados), la API Spec (qué datos hay) y PLAN §5 (alcance) / §5.3 (lo NO recomendado).

---

## 0. Cómo usar este doc con una IA de diseño
Pásale a la IA, junto a este archivo: `functional-spec.md` (campos y validaciones exactas) y este §1 (restricciones). Instrúyela: **"diseña SOLO las pantallas listadas en §3 y §4, respetando las restricciones de §1; no agregues pantallas, funciones ni estilos fuera de esta lista."**

### ⚠️ Son DOS apps de plataformas distintas — diseñar por separado
El portal **web** (W0–W5) y la app **Android** (M1–M5) son **proyectos distintos con lenguajes de diseño distintos**: web = UI de escritorio en navegador (React, tablas, sidebar, mapa grande); móvil = **Android nativo Material Design** (táctil, botones grandes, sin sidebar). Espejan la separación física del monorepo (`/web` vs `/android`, ADR-001).
- **Hacer DOS sesiones/proyectos de diseño separados**, una por app. No mezclarlas en un mismo lienzo (la IA tiende a contaminar: sidebar de escritorio en el móvil, o web con forma de teléfono).
- **Comparten** solo: identidad de marca, conceptos de dominio y el contrato de la API. **NO comparten componentes de UI** (una tabla web ≠ un formulario móvil).
- Prompt sugerido móvil: *"Diseña una app Android nativa (Material Design), solo pantallas M1–M5."* · Web: *"Diseña una webapp de escritorio, solo pantallas W0–W5."*

---

## 1. Principios y RESTRICCIONES DURAS

**Principios**
- **Español** en toda la interfaz.
- **App móvil = interacción mínima** (RN-13): el operador registra y se olvida. Menos toques, mejor.
- **Sobrio y funcional**, no decorativo. Es una herramienta de trabajo, no una app de consumo.
- Estados explícitos en cada pantalla: **carga / vacío / error** (ver §5).

**Restricciones de la app móvil (operador, en un camión)**
- **Sin login. Sin menús. Sin navegación compleja.** Abre directo en el formulario.
- **Botones grandes**, alto contraste (se usa bajo el sol), texto legible. Pensar en uso con prisa.
- Máximo de pantallas: las de §3. Ni una más.

**🚫 NO diseñar (fuera de alcance — PLAN §5.2 / §5.3):**
- Login, registro o perfil en la **app móvil**.
- Notificaciones push / centro de notificaciones.
- Modo oscuro, temas, personalización visual.
- Dashboards de analítica, gráficas, KPIs, mapas de calor.
- Pantallas de configuración avanzada, ajustes de cuenta, roles finos.
- Onboarding, tutoriales, splash animados.
- Chat, mensajería, comentarios.
- Cualquier pantalla de iOS (solo Android).
- **Foto en el cierre de viaje** (el cierre es solo texto; la única foto es la de carga al inicio).

**Identidad visual mínima** (no sobre-especificar): paleta sobria (un color primario + neutros), tipografía legible estándar, esquinas suaves, sin ilustraciones custom. El mapa es **Leaflet + OpenStreetMap** (ADR-003).

---

## 2. Inventario de pantallas

| App móvil (Android, operador) | Portal web (monitorista/admin) |
| :-- | :-- |
| M1. Permisos | W0. Login |
| M2. Formulario de inicio de viaje | W1. Mapa de tránsito (inicio) |
| M3. Viaje en curso | W2. Lista de viajes + export |
| M4. Finalizar viaje (cierre operador) | W3. Detalle de viaje |
| M5. Viaje concluido | W4. CRUD destinos/geocercas |
| | W5. Gestión de usuarios (solo Admin) |

---

## 3. App móvil (Android) — operador

### M1 — Permisos
- Pide en runtime: ubicación precisa, **ubicación en 2º plano**, notificaciones (A13+), actividad. Texto breve explicando *por qué* (cuidar batería rastreando solo lo necesario).
- *Estado error:* permiso denegado → mensaje claro de cómo habilitarlo; no se puede rastrear sin él.

### M2 — Formulario de inicio de viaje *(pantalla principal, abre directo)*
- **7 campos en este orden** (Functional §6): Núm. de Proveedor (numérico) · Nombre de Proveedor (texto) · Folio/Remito (numérico) · Placa Delantera (alfanumérico) · Placa Trasera (opcional) · **Foto de la Carga** (botón cámara/galería, obligatoria) · **Destino** (dropdown del catálogo).
- Botón primario grande: **"Iniciar viaje"** (deshabilitado hasta validar).
- Validación inline en español (mensajes de Functional §6).
- *Estado vacío (RN-14):* si no hay destinos → mensaje "No hay destinos disponibles, contacta al administrador" y botón deshabilitado.
- *Estado sin red (S-04):* "Necesitas conexión para iniciar el viaje."
- *Estado carga:* spinner al enviar (sube foto + crea viaje).

### M3 — Viaje en curso ("En ruta")
- Confirma que el viaje está activo y rastreando. Info mínima: destino, hora de inicio, **estado de sincronización** (último envío / pendientes).
- Botón secundario: **"Finalizar viaje"** (→ M4).
- *Estado sin red:* indicador "Sin conexión — los datos se enviarán al reconectar" (la cola local no se pierde).

### M4 — Finalizar viaje (cierre por operador)
- Campo **Observaciones** (texto, **obligatorio**, motivo). Sin foto.
- Botones: "Confirmar cierre" (deshabilitado sin observación) / "Cancelar".
- Al confirmar → detiene rastreo, va a M5.

### M5 — Viaje concluido
- Mensaje de confirmación (cerrado por: geocerca automática / cierre manual).
- Botón "Iniciar nuevo viaje" → vuelve a M2.
- *Nota:* el cierre automático por geocerca también lleva aquí cuando la app recibe `stopTracking` en el siguiente sync.

---

## 4. Portal web — monitorista / admin

**Layout:** barra lateral con: **Mapa · Viajes · Destinos · Usuarios** (Usuarios solo visible para Admin) · cerrar sesión. Header con nombre/rol del usuario.

### W0 — Login
- Email + contraseña + "Entrar". *Error:* mensaje genérico (no filtra si el email existe).

### W1 — Mapa de tránsito *(inicio tras login)*
- Mapa **Leaflet** con marcadores de camiones **En ruta** (último punto). Refresco cada **15–20 min** (indicar "última actualización: hh:mm").
- Click en marcador → resumen + enlace a W3.
- *Vacío:* "No hay viajes activos." *Error:* fallo de carga con reintento.

### W2 — Lista de viajes + export
- Tabla con filtros: **estado, rango de fechas, destino**. Columnas clave (subconjunto de las 13). Paginación.
- Botón **"Exportar a Excel"** (.xlsx, 13 columnas exactas).
- *Vacío:* "Sin viajes para los filtros." 

### W3 — Detalle de viaje
- Todos los campos del viaje + **foto de carga** + **ruta dibujada en el mapa** (polilínea de puntos) + observaciones.
- Si **En ruta**: botón **"Forzar cierre"** → modal con **Observaciones obligatorias** (CU-06).
- *Estado:* viaje Concluido muestra tipo de cierre, fin y duración (HH:MM).

### W4 — CRUD destinos / geocercas (solo Admin escribe)
- Lista de destinos (activos/inactivos). Botón "Nuevo destino".
- Formulario: **nombre**, **centro** (seleccionar punto en mapa Leaflet), **radio en metros** (visualizar el círculo en el mapa). Editar / dar de baja.
- *Vacío:* "Aún no hay destinos. Crea el primero."

### W5 — Gestión de usuarios (solo Admin)
- Lista de monitoristas/admins. Botón "Nuevo usuario" (email, nombre, rol, contraseña inicial). Dar de **baja** (soft delete).
- Monitorista NO ve esta sección.

---

## 5. Estados transversales (todas las pantallas)

| Estado | Regla de diseño |
| :-- | :-- |
| **Carga** | Spinner/skeleton; nunca pantalla en blanco sin feedback. |
| **Vacío** | Mensaje claro + acción sugerida (no solo "sin datos"). |
| **Error** | Mensaje en español + botón reintentar; formato `{ message }` de la API. |
| **Sin red (móvil)** | Indicador persistente; los datos no se pierden (cola local). |
| **Validación (formularios)** | Inline, por campo, en español; bloquea el envío. |

---

## 6. Notas
- **Accesibilidad mínima:** contraste suficiente, áreas táctiles ≥48dp en móvil, labels en inputs.
- **Referencia Figma** del doc fuente: usar como inspiración de *contenido*, no copiar estilo si añade complejidad.
- Esta spec NO define el código de los componentes; define **qué** pantallas/estados existen y **qué NO** se diseña.
