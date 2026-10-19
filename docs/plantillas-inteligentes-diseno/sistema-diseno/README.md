Sistema de diseño de **Plantillas Inteligentes**, la app Android que acompaña un par de plantillas con seis sensores de fuerza (talón, antepié medial y antepié lateral de cada pie) conectadas por Bluetooth. Modo oscuro principal; variante clara opcional. Idioma de interfaz: español rioplatense, tono sobrio.

## Principios

1. **Foco.** Cada pantalla responde a una sola pregunta y tiene una sola acción principal (`Button` variante `primary`, una vez por pantalla). Lo que no ayude a responderla, se saca.
2. **La simplicidad es la máxima sofisticación.** Una familia tipográfica, un acento, un color de alerta, mucho aire (`space-6` entre secciones).
3. **Funciona sin manual.** Palabras comunes: «Iniciar», «Finalizar», «Historial», «Comparar con…». Nada de jerga técnica en botones ni títulos; la jerga queda en `caption`.
4. **Los números son la interfaz.** Todo valor va en `num-xl`, `num-lg` o `num-md` con dígitos tabulares (`font-variant-numeric: tabular-nums`); la etiqueta y la unidad, pequeñas y en `text-secondary`.
5. **Detalle obsesivo.** Todo en la retícula de 4px; estados vacío, cargando y error diseñados; animación solo cuando informa (el pulso de 160 ms de un valor que se actualiza).
6. **Honestidad.** Lo simulado dice «Simulada» (`Chip`); lo que no llegó dice «Sin datos»; un valor anterior a una desconexión se muestra **desactualizado** en `stale`, nunca se congela como actual ni desaparece.

## Voz y contenido

- Botones y títulos en infinitivo o sustantivo («Iniciar», «Finalizar», «Historial», «Ajustes»). En texto corrido, voseo rioplatense sobrio: «Elegí dos sesiones para comparar».
- Oración en caso de frase (mayúscula inicial, resto en minúscula): «Nueva sesión», «Sesión recuperada como incompleta».
- Sin signos de exclamación, sin emoji, sin «¡Bien hecho!». Sin «mejor/peor», «fatiga», «diagnóstico», «lesión».
- Vocabulario permitido para los datos: carga, apoyo, distribución, simetría (solo cuando se pueda justificar), evolución.
- Unidad visible siempre: «cuentas» (conversor analógico, 0–4095). Reservar el ancho de la unidad para «N» o «kg» cuando exista calibración; nunca mostrar kilos ni newtons sin calibración.
- Formato de números: miles con espacio fino («2 418»); duración «mm:ss» hasta una hora y «h:mm:ss» después; fechas «dom 18 oct · 20:35».
- Estados vacíos dicen qué hacer, en una línea: «Todavía no hay sesiones. Conectá las plantillas y tocá Nueva sesión.»

## Color

Tema `dark` primero (fallback); `light` opcional. Grises fríos en tres niveles, nunca más: `bg` → `surface` → `surface-elevated`. Sin sombras; la jerarquía se da por el escalón de luminosidad y por `line` en 1px (`hairline`). Encima, un solo color: violeta.

- Fondo de pantalla en `bg`; tarjetas y filas en `surface`; hojas, diálogos y banners en `surface-elevated`.
- Texto y números en `text-primary`; etiquetas, unidades y metadatos en `text-secondary`. Ambos cumplen 4.5:1 sobre los tres niveles en los dos temas.
- `accent` es el único color de marca: un violeta (#b48cff en oscuro, #5b3fb8 en claro) tomado del «Viola Aletheia» de Bugatti, aclarado para leerse sobre el fondo. Se usa como relleno una sola vez por pantalla (el botón principal, con `on-accent`) y como tinta en: punto «Conectado», chip seleccionado sobre `accent-soft`, línea activa del gráfico, anillos y puntos de la silueta, anillo de foco. Plano siempre: sin gradientes, sin brillos, sin violeta en superficies.
- `alert` es el único tono cálido del sistema: un ámbar apagado, complementario del violeta, para desconexión, sesión incompleta y posición faltante. Siempre acompañado de texto o icono; nunca comunica solo por color. Texto sobre relleno alert va en `on-alert`.
- `stale` es gris acero opaco, sin tinte: atenúa valores desactualizados. Solo sobre números de 20px o más; un texto pequeño atenuado lleva la palabra «desactualizado» al lado.
- `accent-soft` y `alert-soft` son fondos tenues detrás de texto del mismo color (chips, banner). Nada más se tiñe.
- Un frío saturado (accent) y un cálido apagado (alert) sobre una escala gris: cada uno significa una sola cosa. Sin verdes, sin segundo acento, sin puntajes circulares, sin anillos de porcentaje, sin mapas de calor ni gradientes.

## Tipografía

Una sola familia: **Manrope** (sans geométrica, OFL), pesos 400, 500 y 600. Seis tamaños: 56, 28, 20, 16, 14 y 12 px.

- Números: `num-xl` (duración en Grabación), `num-lg` (tarjeta de valor y silueta), `num-md` (tablas y diferencias). Siempre `font-variant-numeric: tabular-nums` para que las columnas no bailen al actualizarse.
- Texto: `title` (28, un título por pantalla), `heading` (20), `body` (16) y `body-medium` (16/500 en botones), `label` (14/500), `caption` (12).
- Los números se escriben en el mismo tamaño que su título de nivel (28 y 20) pero en 600; se distinguen por el peso y los dígitos tabulares, no por otra fuente.

## Espaciado, radios y medidas

- Retícula de 4px: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32 · `space-12` 48. Margen lateral de pantalla `space-4`; entre secciones `space-6`.
- Radios: `radius-sm` 6 (chips), `radius-md` 12 (tarjetas, botones, banners), `radius-lg` 20 (hojas y diálogos), `radius-pill` solo para puntos e indicadores circulares.
- Controles de 48px (`control-height`); filas de 64px (`row-height`). Objetivo táctil mínimo 48×48.
- Pantalla objetivo Pixel 10 Pro XL (20:9): el botón principal se fija al pie con `space-8` de aire arriba; el contenido desplaza por debajo.

## Iconografía

Trazo fino: retícula de 24px, trazo de 1.5px (`icon-stroke`), extremos y uniones redondeados, sin relleno. Un icono nunca va solo si transmite estado: lo acompaña una palabra («Conectado», «Buscando»). Los SVG de `assets/Icons/` están dibujados con tinta `#9aa3ae` (text-secondary oscuro) para la muestra; en la app usar el componente `Icon`, que hereda `color`. Nombres: `bluetooth`, `bluetooth-off`, `play`, `stop`, `history`, `compare`, `settings`, `check`, `alert`, `chevron-right`, `chevron-down`, `plus`, `search`, `foot`.

## Componentes

En `components/bundle.js` como `window.Plantillas`; esperan React 18. Diseñados en píxeles de teléfono (ancho útil 380px); en React Native se traducen uno a uno con los mismos tokens.

- `Button`: `primary` (accent, una vez por pantalla), `secondary` (borde line), `danger` (alert, solo en la confirmación de «Finalizar»). 48px de alto, `body-medium`.
- `Card`: contenedor en `surface`, `radius-md`, padding `space-4`, sin sombra ni borde. Título opcional en `heading`.
- `Chip`: `label`, `radius-sm`. Variantes `neutral` (filtros), `selected` (accent sobre accent-soft), `alert` («Incompleta», «Falta L_LATERAL»), `sim` («Simulada», neutral con icono).
- `ListRow`: 64px, título `body`, subtítulo `caption`, valor a la derecha en `num-md`, chevron fino. Separadas por `line`.
- `Header`: título `title`, línea de contexto en `caption` (dispositivo · fuente), acción opcional a la derecha.
- `StatusBanner`: no intrusivo, `surface-elevated` o `alert-soft`, icono + `label`, acción opcional. Para «Conexión interrumpida · valores desactualizados» y «Sesión recuperada como incompleta».
- `FootMap`: dos siluetas con **tres puntos** cada una (talón, medial, lateral) y el valor numérico junto a cada punto. Intensidad del punto = valor/4095 en opacidad de accent, nunca sin el número. Estado `stale` atenúa todo; `null` muestra «—» y «sin datos». Sin interpolación ni mapa de calor.
- `ValueCard`: etiqueta `label`, valor `num-lg` tabular, unidad `caption` a la derecha del número, línea de apoyo opcional (media, máx., dispersión). Estados: vivo, `stale` (atenuado + «desactualizado»), `empty` («Sin datos»).
- `LineChart`: una línea por serie, ejes en `line`, **huecos visibles** (un `null` corta la línea y deja un tramo punteado en `chart-gap` sobre el eje). Ventana reciente en Grabación; sesión completa en Detalle. Sin área rellena, sin suavizado.
- `Icon`: los 14 iconos de trazo fino, `currentColor`.
