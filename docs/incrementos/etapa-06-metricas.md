# Etapa 6 - Métricas descriptivas por canal

- Fecha de implementación: 2026-10-18
- Tag: v0.6-etapa6
- Especificación: `docs/especificacion/05` (métricas y fixtures A–D)

## Qué se implementó

- Paquete `@plantillas/metrics`:
  - `describeValues(lecturas)`: media muestral, máximo y desviación estándar poblacional sobre las lecturas con `status = ok`; `n_received`, `n_valid`, `n_invalid`. Cero lecturas válidas ⇒ descriptores `null` con `unavailable_reason` («sin lecturas» / «sin lecturas válidas»); nunca cero. El cero es una lectura válida.
  - `describeFromAggregates`: misma estadística a partir de conteos, suma, suma de cuadrados y máximo (varianza = E[x²] − E[x]², recortada a 0), para calcular en SQL sin cargar todas las muestras.
  - `computeCaptureMetrics(repo, captureId)`: calcula las seis posiciones de una captura desde los agregados, las guarda en `result` con `metric_version = desc-1.0` y, si ya existen con esa versión, las devuelve sin recalcular. Una ventana = una captura; las capturas de una sesión no se combinan (un reinicio interrumpe el tiempo).
- Almacenamiento: migración 2 crea `result` (captura, canal, versión, unidad, cantidades, media, máximo, desvío, `calibration_id` reservado para la etapa 9, `computed_at`; UNIQUE por captura+canal+versión; CHECK de coherencia entre cantidades y entre `n_valid = 0` y descriptores nulos). `getChannelAggregates`, `saveResults` (upsert por versión), `getResults`.
- Aplicación: `ensureSessionMetrics(sessionId)` se ejecuta al finalizar una sesión (tras el cierre; si falla no afecta la sesión) y al abrir el detalle de una sesión cerrada (cubre las sesiones guardadas antes de esta etapa). Pantalla Detalle, sección «Carga por posición»: siluetas con la media por posición y seis tarjetas (media en cuentas; debajo máximo, σ y válidas/recibidas); «Sin datos» con el motivo cuando una posición no tiene lecturas válidas; selector de captura cuando la sesión tiene más de una.
- Sin módulos nativos nuevos: no requiere una build nueva.

## Pruebas

`npm test`: 75 pruebas (10 nuevas). Fixtures de la guía: A [100, 200, 300] → media 200, máximo 300, σ 81,649658; B con una `read_error` → n_received 4, n_valid 3, n_invalid 1, misma estadística; C [0, 100, 200] → media 100, máximo 200; D sin válidas → no disponible. Equivalencia agregados ↔ cálculo directo con valores extremos (0 y 4095). Integración: 60 registros del simulador con escenario `read_error` guardados en SQLite, métricas calculadas en SQL coinciden con el cálculo directo canal por canal; reutilización de resultados guardados; captura vacía; la tabla rechaza cantidades incoherentes y descriptores con `n_valid = 0`. Migración 1 → 2 sobre una base con datos conserva los registros.

## Limitaciones declaradas

- Media muestral, no ponderada por tiempo: con intervalos irregulares (p. ej. la tasa real del temporizador) representa el promedio de las lecturas recibidas, no de la señal continua.
- Descriptores de cuentas ADC; no son fuerza ni presión, y no hay comparación numérica entre sesiones (etapa 7) ni calibración (etapa 9).
- Sin ventanas temporales dentro de una captura (evolución intra-sesión): queda para una iteración posterior sobre la misma tabla `result` (campo de ventana).

## Verificación en dispositivo (2026-10-18)

Pixel 10 Pro XL, build 2c4c674f (sin build nueva). Sesión «Caminata» simulada de 16 s, 232 registros (100 % de los esperados), 0 huecos, 0 lecturas fallidas, 1 captura. «Carga por posición» muestra siluetas y seis tarjetas: medias 823/825 (talón), 892/819 (medial), 935/900 (lateral) cuentas; máximos 3 073–3 123; σ 969–1 004; 232/232 válidas en las seis posiciones. Los valores son coherentes con la señal del simulador (alternancia entre ~0 y ~3 100 cuentas por pie). Primer intento falló al arrancar Metro por no haber corrido `npm install` tras agregar el paquete `@plantillas/metrics`; resuelto con `npm install` en la raíz.

Ajustes de navegación derivados de la prueba: ver ADR 0005 (Detalle y Comparación dentro de la pestaña Historial; tocar una fila abre el detalle; selector para comparar; zonas táctiles).
