# ADR 0010 - Informe de sesión para revisión profesional

- Fecha: 2026-11-03
- Estado: aceptada

## Contexto

El cierre del 27/10/2026 incorporó al profesional como posible lector e intérprete de los resultados y pidió, como salida acotada, un informe de sesión y de comparación para revisión. Presentar valores de apoyo sin contexto deja su significado a una interpretación insuficiente; el informe debe reunir identificación seudonimizada, montaje y canales, origen de la señal, condiciones, calidad, indicadores, gráficos, comparabilidad y limitaciones.

## Decisión

**Qué es.** Un documento PDF generado en el teléfono a partir del paquete de sesión (el mismo JSON del respaldo, etapa 10), con ocho secciones fijas: identificación, montaje y canales, origen y transporte, calidad del registro, indicadores, gráficos, comparabilidad, limitaciones y lectura. Variante de comparación A/B con diferencias por posición. Se comparte con el selector del sistema (correo, mensajería, archivos).

**Qué no es.** No es un diagnóstico ni una recomendación clínica; describe mediciones en cuentas ADC y su calidad, y lo dice en el encabezado, en la sección 8 y en cada tabla donde corresponde. No incluye correo ni datos de contacto: la persona figura con seudónimo. No convierte a fuerza ni presión. Las posiciones no instrumentadas se listan como «no disponible» y las métricas bilaterales como «n/d · requiere ambos pies». Señal simulada se declara como tal: «no acredita medición plantar».

**Cómo.** `packages/report` (`buildSessionReportHtml`, `buildComparisonReportHtml`): función pura que produce HTML autocontenido (estilos y SVG inline, A4, márgenes de 18 mm, marca clara en el encabezado, pie con proyecto y fecha de generación), probada con un paquete físico de tres canales y uno simulado de seis. La app (`infrastructure/report`) lo convierte con `expo-print` y lo comparte con `expo-sharing`. Acciones: «Exportar informe (PDF)» en el detalle de una sesión cerrada y en Comparación cuando las sesiones son compatibles.

## Consecuencias

- `expo-print` es un módulo nativo: requiere nueva build (preview 0.12.0, junto con el ícono de la marca).
- El informe hereda las limitaciones del prototipo y las declara; cualquier ampliación (calibración, más posiciones, dos módulos) se refleja primero en el contrato y después en el informe.
- Pendiente: validar en el teléfono la paginación de los gráficos y el reparto de páginas en sesiones largas; revisar el contenido con el profesional entrevistado y ajustar las secciones según sus observaciones.
