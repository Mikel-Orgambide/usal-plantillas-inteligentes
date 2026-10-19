# Etapa 5 - Pantallas mínimas

- Fecha de implementación: 2026-10-18
- Fecha de cierre: 2026-10-18
- Tag: v0.5-etapa5
- Diseño de referencia: `docs/plantillas-inteligentes-diseno/` (Claude Design, entregado por el autor)

## Qué se implementó

- Sistema de diseño en React Native (ADR 0005): tokens, tipografía Manrope, diez componentes.
- Rutas (Expo Router): Inicio (`/`), Preparación (`/preparacion`), Grabación (`/grabacion`), Historial (`/historial`), Detalle (`/sesion/[id]`), Comparación (`/comparar?a&b`), Bluetooth (`/bluetooth`), Ajustes (`/ajustes`). Diálogo «Sesión recuperada como incompleta» en la raíz.
- Estados: Inicio (conectado, vacío, cargando, error de lectura, sesión en curso), Grabación (grabando, interrumpida con banner y valores desactualizados, confirmación de Finalizar, finalizada con motivo si es incompleta), Historial (lista con filtros, vacío, cargando, error, selección de dos), Detalle (cargando, inexistente, incompleta), Comparación (compatibles / no compatibles con requisitos explicados).
- Grabación: duración por reloj monotónico, siluetas con seis valores, gráfico de los últimos 10 s por posición (izquierdo/derecho) con huecos visibles, contadores de calidad, `keep-awake` opcional.
- Detalle: calidad (registros vs. esperados por secuencia, huecos, lecturas fallidas, capturas), gráfico de la sesión completa por posición reducido en SQL con huecos, eventos con tiempo relativo.
- Comparación: política de compatibilidad (configuración, unidad, procedencia), calidad de recepción y gráficos alineados por tiempo de sesión cuando son compatibles.
- Ajustes: pantalla encendida, escenario del simulador; Bluetooth como marcador hasta la etapa 8.
- Repositorio: `getChannelSeries` (reducción por tramos con `null` en huecos) y `getCaptureQuality`, con prueba.

## Verificación en Node

`npm run typecheck` sin errores; `npm test` 64 pruebas; `npx expo export --platform android` genera el bundle (1452 módulos). `expo-doctor` desde la VM no alcanza la API de Expo; verificar desde Windows.

## Verificación en dispositivo (2026-10-18)

Google Pixel 10 Pro XL, development build 2c4c674f (expo-router, react-native-svg, expo-font, keep-awake, screens, safe-area, gesture-handler, reanimated), `expo-doctor` 21/21 desde Windows. Recorrido completo con el simulador: Preparación → Grabación (duración, siluetas, gráfico de 10 s; al finalizar el gráfico muestra el hueco punteado donde dejan de llegar datos) → confirmación → Detalle (sesión «Caminata», 20 s, 309 registros = 100 % de los esperados, 0 huecos, 0 lecturas fallidas, 1 captura, gráfico de la sesión completa por posición con las dos series) → Historial y Comparación. El autor reporta funcionamiento correcto sin errores. Tasa observada 15–17 reg/s para un período nominal de 40 ms: es la tasa real del temporizador del teléfono y se muestra como tal.

Condición de cierre cumplida: las tareas previstas se completan con datos simulados, incluidos estados vacíos y de error.

## Ajuste de navegación (2026-10-18)

Agregados tras la verificación: barra inferior (Hoy · Historial · Ajustes), flecha de volver en las pantallas de flujo, salida de Grabación sin cortar la sesión y limpieza de la línea de metadatos (ADR 0005, ajuste posterior). Sin módulos nativos nuevos.

## Limitaciones

- Indicadores por posición (etapa 6) y diferencias numéricas en Comparación (etapa 7) todavía no se muestran; la interfaz lo indica.
- Bluetooth es un marcador hasta la etapa 8.
- Pulido visual (ícono, splash, transiciones, esqueletos, variante clara) previsto para la etapa 10.
- Duplicados de módulos nativos resueltos con `overrides` (gesture-handler, reanimated, worklets, react).
