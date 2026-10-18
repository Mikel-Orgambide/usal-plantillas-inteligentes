# Prompts para Claude Design

Orden: 1) crear el sistema de diseño, 2) crear el diseño de pantallas usando ese sistema, 3) exportar ZIP. En ambos pasos adjuntar `brief-interfaz.md`.

## Paso 1 — Sistema de diseño ("Con Claude → describilo")

> Creá un sistema de diseño para una aplicación Android de rendimiento deportivo basada en plantillas con sensores, siguiendo el archivo adjunto (brief-interfaz.md), especialmente las secciones 2, 3 y 6. Estética de referencia: WHOOP (modo oscuro, fondo casi negro, superficies apenas más claras, números grandes con dígitos tabulares, tarjetas limpias, un solo color de acento). Principios: foco, simplicidad, sin manual, los números son la interfaz. Definí paleta (fondo, superficie, superficie elevada, texto primario/secundario, acento, alerta, "desactualizado"), tipografía (una familia sans geométrica, escala de 6 tamaños, pesos regular/medio/semibold), radios, espaciados en múltiplos de 4, iconografía de trazo fino, y los componentes listados en la sección 6 del brief, incluida la silueta de pie con tres puntos y la tarjeta de valor numérico con unidad. Sin puntajes circulares ni mapas de calor. Idioma de la interfaz: español rioplatense.

## Paso 2 — Diseño de pantallas ("Diseño" → formato teléfono → "Empezar con un prompt")

> Usá el sistema de diseño "Plantillas Inteligentes" y el archivo adjunto (brief-interfaz.md). Diseñá en formato teléfono (Pixel 10 Pro XL, 20:9) las siete vistas de la sección 4, en este orden y con los estados pedidos en la sección 6: primero Grabación en vivo (la más importante), después Inicio, Preparación, Detalle de sesión, Historial, Comparación y las transversales (conexión Bluetooth, ajustes, diálogo de sesión recuperada). Respetá estrictamente las restricciones de la sección 3: dos siluetas con tres puntos, valores 0–4095 con unidad, sin puntaje único, sin lenguaje de diagnóstico, desconexión mostrada como valores atenuados y huecos visibles, procedencia simulada/física visible. Usá datos realistas de la sección 5. Cada pantalla con una sola acción principal.

## Paso 3 — Iteración y exportación

- Revisar primero Grabación en vivo; pedir ajustes ahí hasta que esté bien. Las demás heredan.
- Pedir explícitamente los estados vacío, cargando y error de Inicio, Grabación e Historial si no aparecieron.
- Exportar como ZIP y adjuntarlo en el chat de desarrollo (etapa 5).
