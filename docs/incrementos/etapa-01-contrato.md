# Etapa 1 - Contrato de datos y validación

- Fecha de cierre: 2026-10-18
- Tag: v0.1-etapa1
- Paquete: `packages/contract` (`@plantillas/contract` 1.0.0)

## Qué se implementó

- Configuración de seis canales con código de posición, pie, zona, modelo esperado e `installation_id` por unidad física. Configuración simulada de referencia `SIM-CONFIG-001` / `SIM-001` con rango ilustrativo de 12 bits (0–4095), identificada como simulada.
- Tipos del registro de la fuente (`SourceRecord`, `Sample`) y del registro normalizado (`NormalizedRecord`), separando lo que genera la fuente de lo que añade la aplicación (`source`, `session_id`, `received_at`).
- Validador en ejecución independiente de los tipos: devuelve el registro tipado o una lista de errores con código, ruta y mensaje; advertencias separadas para valores en el límite del rango.
- Normalización y clave externa `device_id + capture_id + sequence`.
- Clasificación de secuencia (primero, siguiente, duplicado, salto con rango faltante, fuera de orden) como función pura; la política de aceptación queda para la etapa 4.
- La app móvil importa el paquete (`App.tsx` muestra versión y configuración) y Metro lo empaqueta.

## Pruebas ejecutadas

`npm test`: 3 archivos, 23 pruebas, todas satisfactorias. `npm run typecheck`: sin errores en `mobile` y `contract`. `npx expo export --platform android`: bundle generado con el contrato incluido.

| Caso | Resultado |
|---|---|
| C01 registro completo válido | satisfactoria |
| C02 cero con estado ok | satisfactoria (se conserva; advertencia de límite) |
| C03 null con read_error | satisfactoria |
| C04 estado/valor contradictorios | satisfactoria (error `status_value_mismatch`) |
| C05 versión desconocida | satisfactoria |
| C06 canal ausente / duplicado / desconocido | satisfactoria |
| C07 no finito, decimal, negativo, no seguro, tipo incorrecto | satisfactoria |
| C08 repetición de identificador | satisfactoria a nivel de clasificación; la no duplicación en base se prueba en etapa 3 |
| C10 salto de secuencia | satisfactoria (evento con rango faltante) |
| C12 registro fuera de orden | satisfactoria a nivel de clasificación; política de ventana pendiente (etapa 4) |
| C09, C11 | pendientes: requieren persistencia y coordinación de capturas (etapas 3–4) |

Datos usados: fixtures simulados en `test-data/contract/`.

## Decisiones registradas

- Rango ilustrativo 0–4095 para el simulador. El rango real del ESP32 se documentará en H2 y dará lugar a una configuración física distinta.
- Las advertencias no invalidan un registro; se conservan para diagnóstico.
- Imports sin extensión en el paquete para que lo compilen tanto `tsc` como Metro.

## Limitaciones

Ningún dato físico. No se ha definido el formato de transporte USB/BLE: el validador opera sobre el registro ya decodificado como objeto.

## Próxima tarea

Etapa 2: simulador determinista con semilla, modos de prueba (normal, lectura fallida, desconexión, salto, duplicado, contradicción, reinicio de captura) y tasa configurable registrada como parámetro.
