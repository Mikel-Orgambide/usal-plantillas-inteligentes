# Brief de diseño — aplicación Plantillas Inteligentes

Destinatario: Claude Design. Entregable: sistema de diseño + siete vistas en formato teléfono, exportadas como ZIP para su implementación en React Native.

## 1. Qué es el producto

Aplicación Android que acompaña un par de plantillas instrumentadas con seis sensores de fuerza (talón, antepié medial y antepié lateral de cada pie) conectadas a un microcontrolador ESP32 por Bluetooth. La app registra **sesiones** de actividad (caminata, running, fuerza), muestra en vivo la carga en las seis posiciones, guarda todo localmente, calcula indicadores descriptivos por posición y permite revisar el **historial** y **comparar** dos sesiones compatibles.

Referencia de experiencia: **WHOOP**. Interesa su recorrido (resumen de hoy → detalle de la sesión → historial → evolución en el tiempo), su estética oscura con números grandes y tarjetas limpias, y su sensación de "dato serio". No interesa copiar sus puntuaciones (Strain, Recovery, Sleep) ni sus anillos de porcentaje: nuestros datos son otros.

Dispositivo objetivo: Google Pixel 10 Pro XL (pantalla alta, 20:9), Android. Idioma: español rioplatense, tono sobrio. **Modo oscuro principal**; variante clara opcional.

## 2. Principios de diseño (la lógica de Steve Jobs aplicada)

1. **Foco**: cada pantalla responde a una sola pregunta y tiene una sola acción principal. Todo lo que no ayude a responderla se saca.
2. **La simplicidad es la máxima sofisticación**: pocas tipografías, pocos colores, mucho aire. La complejidad vive en la lógica, no en la interfaz.
3. **Funciona sin manual**: el usuario entiende qué hacer sin instrucciones; los nombres son palabras comunes ("Iniciar", "Finalizar", "Historial"), no jerga técnica.
4. **Los números son la interfaz**: tipografía grande con dígitos tabulares; el valor importa más que el adorno.
5. **Detalle obsesivo**: alineaciones exactas, estados vacíos y de error diseñados, animaciones solo cuando informan (por ejemplo, el pulso de un valor que se actualiza).
6. **Honestidad**: lo simulado se identifica como simulado; lo no disponible dice "sin datos", nunca se rellena.

## 3. Restricciones que vienen de la tesis (no negociables)

- Representación de los pies: **dos siluetas de pie con tres puntos cada una** (talón, medial, lateral). **No** mapa de calor continuo, no interpolación entre puntos. Si se usa intensidad de color, siempre acompañada del valor numérico.
- Los valores son cuentas del conversor analógico (0–4095 por ahora), **no kilos ni newtons**. Mostrar la unidad. Cuando exista calibración aparecerán unidades físicas; prever el espacio.
- **No inventar un puntaje único**. Los indicadores son descriptivos por posición: media, máximo, dispersión, cantidad de lecturas válidas, duración de la sesión, porcentaje de datos recibidos.
- Nada de diagnóstico ni "detección de fatiga". Vocabulario: carga, apoyo, distribución, simetría (cuando se pueda justificar), evolución.
- Valores anteriores a una desconexión se muestran **desactualizados** (atenuados), no desaparecen ni se congelan como si fueran actuales. Los huecos de datos se ven como huecos en el gráfico, no se unen con una línea.
- Procedencia visible: cada sesión indica si fue **simulada** o **física**, y con qué dispositivo y configuración.

## 4. Pantallas

### 4.1 Inicio ("Hoy")
Estado del dispositivo (desconectado / buscando / conectado, nombre), fuente activa (plantillas o simulador), última sesión en una tarjeta resumen (fecha, actividad, duración, registros), acceso directo a "Nueva sesión" e "Historial". Estado vacío: sin sesiones aún.

### 4.2 Preparación de sesión
Elegir actividad (caminata / running / fuerza / otra), contexto opcional (texto corto: calzado, superficie, notas), dispositivo y configuración detectados con las **seis posiciones reconocidas** (lista con tilde por posición; si falta una, se ve). Acción principal: "Iniciar".

### 4.3 Grabación (en vivo) — la pantalla más importante
Duración en grande, estado (grabando / interrumpida / finalizando), las dos siluetas con los seis valores actualizándose, un gráfico de línea corto (últimos segundos) por pie o por posición seleccionable, contadores discretos de calidad (registros recibidos, huecos). Banner no intrusivo cuando se interrumpe la conexión. Acción principal: "Finalizar" (con confirmación breve).

### 4.4 Detalle de sesión
Encabezado: actividad, fecha, duración, procedencia (simulada/física), dispositivo y configuración. Resumen de calidad: registros, huecos, lecturas fallidas, capturas (si hubo reinicios). Indicadores por posición (seis tarjetas o una tabla 2×3: media, máximo, dispersión, válidas). Gráfico de la sesión completa por posición, con huecos visibles. Lista de eventos (desconexiones, reinicios) plegable. Acción secundaria: "Comparar con…".

### 4.5 Historial
Lista de sesiones ordenada por fecha, con filtros simples (actividad, procedencia). Cada fila: fecha, actividad, duración, registros, estado (completa / incompleta con motivo). Estado vacío cuidado. Selección de dos sesiones para comparar.

### 4.6 Comparación
Dos sesiones lado a lado (o superpuestas) **solo si son compatibles** (misma configuración, misma unidad, misma procedencia). Si no lo son, la pantalla explica por qué y qué sí se puede comparar. Diferencias numéricas por posición, sin etiquetas de "mejor/peor". Gráficos alineados por tiempo de sesión.

### 4.7 Transversales
Conexión/emparejamiento Bluetooth (buscar, elegir dispositivo, permisos), ajustes mínimos (dispositivo, unidades cuando existan, modo simulador para demostraciones), y un diálogo de "sesión recuperada como incompleta" al abrir la app tras un cierre inesperado.

## 5. Datos reales para diseñar con realismo

- Seis canales: `L_HEEL`, `L_MEDIAL`, `L_LATERAL`, `R_HEEL`, `R_MEDIAL`, `R_LATERAL`; valores enteros 0–4095; estado por lectura `ok` / `read_error`.
- Sesión: actividad, contexto, procedencia, estado (preparada, grabando, interrumpida, finalizando, completa, incompleta), inicio, fin, duración; capturas (reinicios); eventos (conectado, desconectado, reconectado, hueco de secuencia, fuera de orden, reinicio de captura, sesión iniciada/finalizada/recuperada).
- Indicadores por canal: media, máximo, desviación estándar, recibidas, válidas, inválidas; "no disponible" cuando no hay lecturas válidas.
- Frecuencia de registros: decenas por segundo; los gráficos en vivo muestran una ventana reciente.

## 6. Entregable

- Sistema de diseño: paleta (fondo oscuro, superficies, texto, un acento, un color de alerta, un color de "desactualizado"), tipografía (familia, escala, pesos), radios, espaciados, iconografía, y componentes: botón principal/secundario, tarjeta, chip, fila de lista, encabezado, banner de estado, silueta de pie con tres puntos, tarjeta de valor numérico, gráfico de línea con huecos.
- Las siete vistas en modo oscuro (clara si da el tiempo), a tamaño de teléfono.
- Estados: vacío, cargando, error/desconexión en Inicio, Grabación e Historial.
- Exportar como ZIP.

## 7. Enmienda 2026-10-27 — dirección visual «B» (Figma)

Sobre las propuestas trabajadas en Figma (https://www.figma.com/design/0Hb0wBxywX9LlM0NOzJbNo, página «Pantallas», sección «Editables (app 0.11.0)») el autor eligió la dirección **B**, que habilita exactamente dos usos de degradado, ambos decorativos:

1. Un **halo** radial de `accent` (12 % → 0 %) detrás de la cabecera de las pestañas Hoy e Historial.
2. Un degradado vertical sutil en tarjetas, de `surface-elevated` (arriba) a `surface` (abajo), con borde `line` al 60 %.

Sigue prohibido el degradado sobre texto, botones e iconos, y como portador de significado. `accent-deep` (#6a44c4) es el segundo tono de los anillos de reparto.

Decisiones de la misma fecha: la pestaña «Más» pasa a llamarse **Ajustes** (sin reestructurar su contenido); Historial se agrupa por día en tarjetas con un resumen arriba; en Hoy se retira el texto explicativo largo del anillo (pasa a la hoja de desglose); tocar la pestaña «Hoy» estando en Hoy vuelve al día de hoy. Guía para leer estos diseños desde otro chat: `docs/diseno/figma.md`.
