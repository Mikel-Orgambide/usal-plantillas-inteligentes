# ADR 0005 - Interfaz: sistema de diseño, navegación y gráficos

- Fecha: 2026-10-18
- Estado: aceptada

## Contexto

El autor entregó el diseño completo hecho en Claude Design (`docs/plantillas-inteligentes-diseno/`): tokens de color para dos temas, tipografía Manrope, diez componentes documentados y 19 pantallas/estados. La etapa 5 debe implementar las pantallas mínimas de la guía con datos simulados, incluidos los estados vacíos y de error.

## Decisión

- El diseño entregado es la **fuente de verdad visual**. Los tokens se transcriben a `apps/mobile/src/presentation/theme/tokens.ts`; los componentes se implementan uno a uno con los mismos nombres y props (`Button`, `Card`, `Chip`, `ListRow`, `Header`, `StatusBanner`, `ValueCard`, `FootMap`, `LineChart`, `Icon`).
- Navegación con **Expo Router** (rutas en `src/app/`), que es la recomendación del SDK y permite enlaces profundos a sesiones.
- `FootMap`, `LineChart` e `Icon` se dibujan con **react-native-svg**, replicando los trazados del diseño (silueta, puntos, iconos de trazo 1.5).
- Tipografía **Manrope** (OFL) vía `@expo-google-fonts/manrope` y `expo-font`; dígitos tabulares en todos los números.
- Tema oscuro fijo (`userInterfaceStyle: dark`); la paleta clara queda transcrita para una variante futura.
- La sesión activa vive en un almacén fuera de React (`application/sessionStore.ts`) para sobrevivir a la navegación; los ajustes se guardan con `expo-sqlite/kv-store`.
- `expo-keep-awake` para «pantalla encendida al grabar».
- Versiones de módulos nativos fijadas con `overrides` en la raíz para evitar duplicados (gesture-handler, reanimated, worklets).

## Diferencias deliberadas respecto del diseño

- El gráfico en vivo no ofrece «Por pie» (suma de tres sensores): sumar cuentas de sensores distintos sería una variable procesada sin justificación. Se grafica una posición (talón, medial o lateral) con el pie izquierdo y el derecho como dos series.
- Las tarjetas de «carga media por posición» y las diferencias numéricas en Comparación esperan a las métricas (etapas 6 y 7); la pantalla lo indica en vez de mostrar valores inventados.
- La pantalla de Bluetooth es un marcador honesto hasta la etapa 8: la única fuente es el simulador, y las sesiones se marcan «Simulada».
- El selector de escenario del simulador (verificación) vive en Ajustes → Demostración, no en Grabación.

## Ajuste posterior (2026-10-18, misma fecha)

Tras la primera verificación en dispositivo, el autor señaló que sin barra de navegación ni «volver» la app resultaba difícil de recorrer. El brief no había pedido la estructura de navegación, por lo que el diseño no la incluía. Se agregó:

- **Barra inferior** con tres destinos permanentes **Historial · Hoy (centro) · Plantillas**, en `surface` con hairline superior, acento para el activo, iconos del sistema, y respeto del área de gestos de Android (inset inferior). Ajustes no va en la barra: se abre desde el icono superior derecho de Hoy y de Plantillas, porque el estado del dispositivo se consulta constantemente y los ajustes rara vez.
- **Encabezado con flecha de volver** en las pantallas de flujo (Preparación, Detalle, Comparar, Bluetooth). En Grabación, la flecha vuelve a Hoy sin cortar la sesión; Hoy ofrece «Volver a la sesión en curso».
- Una sola línea de metadatos por pantalla (chip de procedencia + dispositivo · configuración · unidad) y el mismo ritmo de secciones (24 arriba, 12 abajo).
- Se retiraron los botones «Historial», «Volver» y «Listo» que duplicaban la barra.

Queda pendiente reflejar la barra y el encabezado con volver en el archivo de Claude Design cuando se itere el diseño.

## Consecuencias

Agregar módulos nativos exige un nuevo development build. La pantalla provisional de verificación de las etapas 2–4 se retiró; su función la cumplen Grabación + Ajustes.
