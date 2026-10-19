# Etapa 7 - Historial y comparación básica

- Fecha de implementación: 2026-10-18
- Tag: v0.7-etapa7
- Especificación: `docs/especificacion/03` §10, `05` (U02, U03)

## Qué se implementó

- Historial recuperado de la base: fecha, actividad, duración, registros, procedencia, estado, configuración de la primera captura y calidad (huecos, lecturas fallidas, capturas) en `listSessions`. Nada se reconstruye desde el estado de la pantalla.
- Política de comparación en `@plantillas/metrics` (`assessComparability`): requisitos que bloquean la comparación por posición —misma configuración, misma unidad, misma procedencia, misma versión de métrica— y condiciones que solo se señalan —actividad distinta, contexto distinto, sesiones con reinicios (se compara la primera captura de cada una)—.
- Diferencias numéricas (`compareMetrics`): por posición, B − A sobre media, máximo y desvío, más la diferencia de media relativa a A. Si un lado no tiene lecturas válidas la diferencia es `null` («no disponible»), nunca cero. No se emite ninguna etiqueta de mejor/peor rendimiento.
- Pantalla Comparar: tarjetas A/B, banner con el motivo cuando no son compatibles y tabla de requisitos (U03), advertencias de condiciones distintas, tabla «Diferencia por posición» (Δ media en cuentas y en % de A; debajo A, B, Δ máx, Δ σ), calidad de recepción y gráficos alineados por tiempo de sesión (ya existentes). «Comparar con…» desde el Detalle llega al Historial con esa sesión ya marcada.
- Sin módulos nativos nuevos ni migraciones.

## Pruebas

`npm test`: 82 pruebas (7 nuevas). Compatibilidad: compatible sin advertencias; U03 con procedencia y configuración distintas; versión de métrica distinta bloquea; actividad/contexto/reinicios solo advierten. Diferencias: B − A por canal con razón relativa; lado sin válidas ⇒ `null`; media de A cero ⇒ diferencia absoluta sí, razón no.

## Limitaciones declaradas

- Se compara la primera captura de cada sesión; no hay alineación temporal fina ni comparación bilateral/proporciones (requieren calibraciones comparables, etapa 9).
- Las diferencias son de lectura en cuentas ADC bajo la misma configuración; con sensores físicos dependerán además de montaje y calibración, que se registrarán en la etapa 9.
- La comparación experimental entre sesiones físicas repetidas y condiciones documentadas queda para la validación con hardware.

## Verificación en dispositivo

Pendiente: dos sesiones simuladas compatibles (p. ej. `normal` y `read_error`) → tabla de diferencias con una posición mostrando válidas distintas; una sesión con `capture_restart` → advertencia de reinicios; historial vacío tras reinstalar (U02) ya verificado en la etapa 5.
