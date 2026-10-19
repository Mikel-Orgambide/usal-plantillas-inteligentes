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

## Verificación en dispositivo (2026-10-18)

Pixel 10 Pro XL, build 2c4c674f. Dos sesiones «Caminata» simuladas de 18 s (A 272 registros, B 278) comparadas desde el Historial: encabezado «Compatibles», tabla «Diferencia por posición» con Δ media entre −16 y +40 cuentas (−1,7 % a +5,3 %), Δ máx 0 en las seis posiciones (misma señal sintética) y Δ σ entre −10,3 y +30,0; calidad de recepción 100 % / 100 %; gráficos A/B alineados por tiempo de sesión con la barra inferior visible. Resultado coherente con dos corridas del mismo generador con distinta semilla. Historial vacío (U02) verificado en la etapa 5.

Hallazgo durante la prueba: tras cerrar la hoja de confirmación «Finalizar», el botón «Ver la sesión» solo respondía en la franja del texto. Causa: el `Modal` nativo de Android con barra de estado translúcida dejaba desplazados los toques de la pantalla de abajo al cerrarse. Corrección: la hoja se dibuja como capa absoluta dentro del árbol de la app (sin `Modal`), con el botón atrás manejado con `BackHandler`; además la pantalla de Grabación deja de refrescarse cada 250 ms una vez finalizada la sesión.
