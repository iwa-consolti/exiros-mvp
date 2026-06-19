\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

# 

# **DISEÑO DE SOLUCIÓN MVP**  **EXIROS ON-ROUTE TRACKER**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## 

## **1\. Objetivo del Proyecto**

Desarrollar una Versión Mínima Viable (MVP) de una solución tecnológica independiente centrada exclusivamente en el **rastreo y monitoreo en ruta** del transporte de chatarra vía camión. El objetivo primordial es ofrecer visibilidad completa desde el patio de origen (vendedor) hasta el patio de destino (comprador), implementando una estrategia estricta de administración de energía que garantice un funcionamiento continuo en los dispositivos propios de los operadores, sin comprometer la batería ni generar fricción en la adopción operativa.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## **2\. Descripción de la Solución**

La plataforma **Exiros On-Route Tracker** se diseñó bajo un enfoque de arquitectura desacoplada e independiente. Para simplificar y agilizar el proceso de aprobación por parte del departamento de sistemas de EXIROS, la solución **no realizará conexiones ni integraciones** con ninguna infraestructura interna de la compañía. ~~Todo el ecosistema se desplegará de forma aislada en servidores de **Amazon Web Services (AWS)** administrados inicialmente por iWA.~~

La solución está conformada por dos componentes clave:

* **Aplicación Móvil (Android):** Herramienta para los operadores, configurada en idioma español.  
* **Portal Web Administrativo:** Consola centralizada para los monitoristas y personal autorizado de Exiros.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## 

## **3\. Componente Móvil: [Aplicación Android](https://blotch-drift-89965361.figma.site/mobile) (Operadores)**

### **3.1 Mecanismo de Acceso**

Con la finalidad de eliminar barreras operativas y agilizar el despliegue en campo, la aplicación contará con un **acceso libre**. No se requerirá la creación ni el mantenimiento de usuarios o contraseñas para los fleteros externos; la aplicación iniciará directamente en el formulario de registro de viaje.

### **3.2 Formulario de Inicio de Viaje y Validaciones**

Antes de arrancar la unidad, el operador deberá completar obligatoriamente los siguientes campos en la aplicación:

| Campo en la App | Tipo de Entrada | Regla de Validación / Restricción Técnica |
| :---- | :---- | :---- |
| **Núm. de Proveedor** | Numérico | Obligatorio. Validación estricta de caracteres puramente numéricos. |
| **Nombre de Proveedor** | Texto Libre | Obligatorio. Alfanumérico para identificación del vendedor. |
| **Folio (Remito) Viaje** | Numérico | Obligatorio. Validación estricta de caracteres puramente numéricos. |
| **Placa Delantera** | Alfanumérico | Obligatorio. Validación flexible para admitir formatos estatales y federales de México. |
| **Placa Trasera** | Alfanumérico | Opcional. Validación alfanumérica flexible. |
| **Foto de la Carga** | Multimedia | Obligatorio. Captura obligatoria y directa desde la cámara del dispositivo o carga desde la galería del teléfono. |
| **Destino** | Selector (*Dropdown*) | Obligatorio. Menú desplegable de selección simple para elegir fácilmente uno de los **destinos** registrados. |

### 

### **3.3 Estrategia de Administración de Energía y Datos**

Para asegurar la supervivencia de la batería del teléfono durante trayectos largos se implementan las siguientes directrices de hardware:

### **3.3.1. El secreto está en el "Batching" (Envío por lotes)**

El verdadero asesino de la batería no es el chip GPS, sino el módem de datos del teléfono celular. Cada vez que la app intenta conectarse a la red para enviar una coordenada, la antena se "despierta", consume un pico alto de energía y tarda unos segundos en volver a dormir.

* **Captura local:** La app obtiene la coordenada GPS de forma pasiva cada 2 o 3 minutos y la guarda en una base de datos local ligera (como SQLite o Room).  
* **Envío agrupado:** Cada 15 o 20 minutos (o cuando el camión haya recorrido cierta distancia), la app enciende la antena de datos una sola vez, envía el bloque con las 10 ubicaciones acumuladas en un solo paquete comprimido y se vuelve a dormir. Esto reduce el uso de la antena en un **90%**.

  ### **3.3.2. Filtro por Distancia y Reconocimiento de Actividad (*Activity Recognition*)**

  Un camión parado en el tráfico o estacionado en una gasolinera no debería consumir recursos del teléfono.  
* **Distance Filter:** Configuraremos la app para que ignore el factor tiempo si no hay movimiento. Si el camión no se ha movido al menos **300 o 500 metros** desde el último punto, la app no registra nada.  
* **Uso del Acelerómetro:** Implementaremos las APIs nativas de detección de actividad (*Google Activity Recognition* en Android y *CoreMotion* en iOS). Si el sistema operativo detecta que el estado del chofer es "STILL" (detenido), la aplicación apaga por completo el rastreo GPS y entra en modo de suspensión hasta que el acelerómetro detecte que el camión vuelve a moverse.

  ### **3.3.3. Proveedores de Ubicación Fusionada (*Fused Location*)**

  Nunca se debe consultar el GPS de forma directa y nativa a nivel de hardware.  
* Utilizaremos los motores fusionados de los sistemas operativos (*Fused Location Provider API* de Google y *CoreLocation* de Apple).  
* Estos servicios de IA nativos balancean de forma automática e inteligente el uso del GPS satelital, la triangulación de antenas celulares y los routers Wi-Fi cercanos. Si el camión va en carretera abierta, usa satélites; si entra a una zona urbana (como la zona portuaria de Veracruz), se apoya en antenas de telefonía, reduciendo drásticamente el esfuerzo del hardware.

  ### **3.3.4. Compresión Extrema del *Payload* (Datos)**

  Para que el consumo de datos mensuales por camión sea insignificante:

* **Adiós a los JSON pesados en ruta:** En lugar de enviar un formato de texto largo como `{"latitud": 19.173, "longitud": -96.134, "timestamp": "2026-06-04..."}`, el paquete transmitido se reduce a una cadena de texto limpia o un array de puros números separados por comas.  
* **Compresión GZIP:** El servidor backend recibirá los lotes de datos con compresión nativa, haciendo que cada transmisión de viaje pese apenas unos cuantos *Kilobytes*.

		

          ⚠️ Resultado: Consumo del 100% de batería en 3 horas y alto gasto de datos móviles.

    ✨ Resultado: Menos del 10% de consumo de batería por jornada y consumo de datos mínimo.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## 

## **4\. Componente Web: [Portal de Administración](https://blotch-drift-89965361.figma.site/)**

Consola en la nube dedicada a la supervisión logística de Exiros.

### **4.1 Módulos de la Plataforma Web**

* **Mapa de Tránsito Activo:** Visualización geográfica en tiempo real de las unidades que se encuentran en ruta. El mapa actualizará las posiciones en pantalla en intervalos de 15 a 20 minutos, conforme se reciban los paquetes de datos de los dispositivos móviles.  
* **Administración de Geocercas:** Panel de configuración cartográfica para gestionar el catálogo de los XX **destinos** iniciales y delimitar sus perímetros virtuales de llegada.  
* **Administración de Usuarios:** Módulo básico para la gestión de accesos, altas y bajas de los monitoristas y administradores de la consola de Exiros.  
* **Reportes:** Sección dedicada a la consulta y descarga de históricos de viajes.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## 

## **5\. Ciclo de Vida y Criterios de Cierre del Viaje**

El MVP automatiza el flujo operativo y provee alternativas seguras para la gestión de contingencias en carretera:

### **Flujo Operativo Ideal (Cierre Automático)**

El operador inicia el viaje en la aplicación móvil y conduce hacia la planta o patio seleccionado. Al cruzar el perímetro virtual de la **Geocerca de Destino**, el backend procesa la localización, da el viaje por **Concluido en automático** y detiene de inmediato el consumo de GPS en el celular del chofer, sin requerir ninguna interacción humana.

### **Flujo de Contingencia (Cierre Manual)**

Diseñado para registrar excepciones (ej. averías mecánicas antes de llegar a la geocerca, descargas de emergencia fuera del perímetro o fallas en la red celular):

* **Cierre por el Operador:** Se habilita un botón de contingencia en la app móvil para "Finalizar Viaje". Al presionarlo, el sistema le exigirá obligatoriamente capturar el motivo en una sección de **Observaciones**.  
* **Cierre por el Administrador:** El monitorista de Exiros podrá forzar el cierre de cualquier viaje activo desde el portal web, registrando de igual manera las **Observaciones** que justifiquen la acción.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## 

## **6\. Estructura del Reporte de Viajes (Exportable a Excel)**

El portal web permitirá la descarga de archivos en formato .xlsx con un registro detallado de cada trayecto, ideal para auditorías de pago de fletes:

1. **ID de Viaje** *(Consecutivo automático del sistema)*  
2. **Número de Proveedor** *(Capturado por el chofer)*  
3. **Nombre de Proveedor** *(Capturado por el chofer)*  
4. **Folio de Viaje / Remito** *(Capturado por el chofer)*  
5. **Placa Delantera** *(Capturada por el chofer)*  
6. **Placa Trasera** *(Capturada por el chofer)*  
7. **Destino** *(Seleccionado del catálogo de opciones)*  
8. **Fecha / Hora de Inicio** *(Estampa de tiempo automática al activar la app)*  
9. **Fecha / Hora de Fin** *(Estampa de tiempo automática al activarse la geocerca o el cierre manual)*  
10. **Duración Total del Viaje** *(Cálculo automático en formato HH:MM)*  
11. **Estatus del Viaje** *(Valores: En ruta / Concluido)*  
12. **Tipo de Cierre** *(Valores: Automático por geocerca / Manual por Operador / Manual por Administrador)*  
13. **Observaciones** *(Texto obligatorio únicamente si el Tipo de Cierre fue Manual)*  
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
    

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

## 

## **7\. Criterios de aceptación**

## **7.1 Checklist: Componente Móvil (App Android \- Español)** 

### **🔑 Acceso y Usabilidad**

* **Acceso Libre:** La aplicación debe abrir directamente en el formulario de inicio de viaje, omitiendo por completo cualquier pantalla de *login*, usuario o contraseña.

  ### **📝 Formulario de Inicio de Viaje**

* **Número de Proveedor:** El campo debe ser obligatorio y restringir la entrada únicamente a caracteres numéricos.  
* **Nombre de Proveedor:** El campo debe ser obligatorio y permitir texto alfanumérico libre.  
* **Folio (Remito) de Viaje:** El campo debe ser obligatorio y validar estrictamente un formato numérico.  
* **Placa Delantera:** El campo debe ser obligatorio y contar con una validación alfanumérica flexible que acepte formatos estatales y federales de México sin bloquear al usuario.  
* **Placa Trasera:** El campo debe ser opcional y mantener la misma validación alfanumérica flexible.  
* **Foto de la Carga:** El campo debe ser obligatorio, permitiendo tanto la captura directa desde la cámara como la carga de archivos desde la galería del teléfono.  
* **Selección de Destino:** Se debe desplegar un selector simple para elegir el destino del viaje.

  ### **🔋 Gestión de Energía y Transmisión Inteligente**

* **Transmisión por Lotes (*Batching*):** La app debe recolectar las coordenadas GPS de forma pasiva en segundo plano y transmitir el paquete comprimido de ubicaciones únicamente en intervalos de cada 15 o 20 minutos.  
* **Hibernación por Inactividad:** Al detectar que la unidad está detenida mediante el acelerómetro del teléfono, la app debe pausar el rastreo GPS para salvaguardar la batería.

  ### **🚨 Contingencias en Campo**

* **Cierre Manual de Emergencia:** Debe existir un botón visible para "Finalizar Viaje" antes de tiempo.  
* **Validación de Excepciones:** Al presionar el cierre manual, la app debe obligar al operador a registrar el motivo en un campo de texto de **Observaciones** antes de procesar el cierre.

  ## 

  ## **7.2 Checklist: Portal Web Administrativo 🖥️** 

  ### **🗺️ Monitoreo y Geocercas**

* **Mapa de Tránsito Activo:** La consola debe renderizar geográficamente las unidades en ruta, actualizando sus posiciones en pantalla cada 15 o 20 minutos conforme lleguen los paquetes de datos.  
* **Administración de Geocercas:** El portal debe permitir gestionar el catálogo de destinos y configurar o editar los perímetros virtuales (radios) de llegada para cada uno.

  ### **⚙️ Automatización y Cierres de Viaje**

* **Cierre por Geocerca:** El backend debe procesar de forma automática la finalización del viaje y ordenar la detención del GPS en el celular en cuanto la coordenada del lote ingrese al perímetro virtual del destino.  
* **Cierre Manual por Administrador:** El monitorista web debe contar con la facultad de forzar el cierre de cualquier viaje activo, condicionando la acción al llenado obligatorio de un campo de **Observaciones**.  
* **Gestión de Usuarios:** Se deben poder dar de alta, baja y administrar los accesos de los usuarios monitoristas de la consola.

  ### **📊 Módulo de Reportes (Excel)**

* **Exportación Limpia:** La plataforma debe permitir la descarga de históricos de viajes directamente en formato .xlsx.  
* **Columnas Obligatorias:** El archivo generado debe contener exactamente los siguientes 13 campos: ID de Viaje, Número de Proveedor, Nombre de Proveedor, Folio de Viaje/Remito, Placa Delantera, Placa Trasera y Destino; además de las métricas automáticas de Fecha/Hora de Inicio, Fecha/Hora de Fin, Duración Total (HH:MM), Estatus (En ruta/Concluido), Tipo de Cierre y la columna de Observaciones.  
  