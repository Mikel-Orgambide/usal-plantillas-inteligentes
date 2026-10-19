# Etapa 5 - Pantallas mínimas

- Fecha de implementación: 2026-10-18
- Estado: implementada; **verificación en dispositivo pendiente** (requiere nuevo development build)
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

## Pendiente para cerrar la etapa

Nuevo development build (módulos nativos: expo-router, react-native-svg, expo-font, keep-awake, screens, safe-area, gesture-handler, reanimated) instalado por cable. Recorrido en el Pixel con datos simulados: Inicio vacío → Nueva sesión → Preparación → Grabación (escenario `disconnect` para ver interrumpida) → Finalizar → Detalle → Historial → Comparación de dos sesiones compatibles y de dos incompatibles no aplica aún (todas simuladas; verificar el caso compatible) → Ajustes → cierre brusco y diálogo de recuperación.
