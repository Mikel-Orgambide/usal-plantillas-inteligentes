# Plantillas Inteligentes — diseño de interfaz (entrega completa)

Paquete fuente del diseño hecho en Claude Design para la app Android (Pixel 10 Pro XL, 20:9, 412×915 dp, modo oscuro). Contiene las siete vistas de la sección 4 del brief, sus estados (sección 6), el sistema de diseño con tokens y componentes, y el brief original.

## Contenido

```
brief-interfaz.md                 Brief de diseño original
pantallas/
  canvas.json                     Índice del lienzo: nombre, posición y tamaño de cada artboard
  Main.dc.html                    1 · Grabación en vivo — grabando (la pantalla más importante)
  Grabacion-interrumpida.dc.html  1 · Grabación — conexión interrumpida (valores stale, hueco visible)
  Grabacion-finalizar.dc.html     1 · Grabación — confirmación de «Finalizar»
  Inicio.dc.html                  2 · Inicio («Hoy») — conectado
  Inicio-vacio.dc.html            2 · Inicio — sin sesiones aún
  Inicio-cargando.dc.html         2 · Inicio — cargando
  Inicio-desconectado.dc.html     2 · Inicio — desconectado
  Preparacion.dc.html             3 · Preparación — seis posiciones reconocidas
  Preparacion-falta.dc.html       3 · Preparación — falta L_LATERAL
  Detalle.dc.html                 4 · Detalle de sesión (artboard alto: la pantalla desplegada)
  Historial.dc.html               5 · Historial — dos sesiones elegidas para comparar
  Historial-vacio.dc.html         5 · Historial — vacío
  Historial-cargando.dc.html      5 · Historial — cargando
  Historial-error.dc.html         5 · Historial — error de lectura
  Comparacion.dc.html             6 · Comparación — sesiones compatibles
  Comparacion-incompatible.dc.html 6 · Comparación — no compatibles (explica por qué)
  Bluetooth.dc.html               7 · Conexión / emparejamiento Bluetooth
  Ajustes.dc.html                 7 · Ajustes
  Recuperada.dc.html              7 · Diálogo «Sesión recuperada como incompleta»
sistema-diseno/
  README.md                       Principios, voz, color, tipografía, espaciado, componentes
  tokens.json                     Tokens: color (dark/light), tipografía, espaciado, radios, medidas
  components/bundle.css           Estilos de los componentes (variables CSS = tokens)
  components/bundle.js            Componentes React 18 (window.Plantillas)
  components/index.d.ts           Props de cada componente (referencia para React Native)
  fonts/                          Manrope 400/500/600 (OFL) + licencia
  docs/<Componente>.md            Reglas de uso de cada componente
```

## Cómo leer una pantalla

Cada `.dc.html` es una página autocontenida. Lo que importa para implementar está dentro de `<x-dc>`:

- La estructura y los estilos inline (flex/grid, paddings, colores hex del tema oscuro) son el layout exacto en dp.
- Cada `<x-import component-from-global-scope="Plantillas.X" …>` es un componente del sistema con sus props (`variant`, `stale`, `series`, etc.). En React Native se traduce a un componente propio con el mismo nombre y las mismas props (ver `sistema-diseno/components/index.d.ts` y `docs/`).
- Los datos de ejemplo (valores 0–4095, series del gráfico, huecos como `null`) están en `renderVals()` al final de cada archivo.

Para ver las pantallas renderizadas, abrí el lienzo en Claude (botón **Compartir** del artefacto) o exportá HTML/PDF/PNG desde su menú de **Exportación**.

## Restricciones de la tesis que el diseño respeta

- Dos siluetas con tres puntos cada una (`FootMap`); nunca mapa de calor ni interpolación; el color acompaña al número.
- Valores en **cuentas ADC (0–4095)**, con la unidad visible; espacio reservado para N/kg con calibración.
- Sin puntaje único; indicadores descriptivos por posición: media, máximo, σ, válidas, registros, % recibido, duración.
- Sin lenguaje de diagnóstico; vocabulario: carga, apoyo, distribución, evolución.
- Tras una desconexión los valores quedan **atenuados** (`stale` + «desactualizado»); los huecos se ven como huecos (`null` corta la línea y deja un tramo punteado sobre el eje).
- Procedencia visible en cada sesión: «Física» o chip «Simulada», con dispositivo y configuración.
- Una sola acción principal por pantalla (`Button variant="primary"`).
