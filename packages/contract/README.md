# @plantillas/contract

Contrato lógico de datos **v1.0** (especificación: `docs/especificacion/02_Contrato_de_Datos_y_Modelo.md`). Lo consumen el simulador, los adaptadores de dispositivo, la persistencia y las pruebas. No depende de React Native.

## Contenido

| Módulo | Qué define |
|---|---|
| `channels.ts` | Los seis códigos de posición, su pie/zona/modelo esperado, `AcquisitionConfiguration`, la configuración simulada de referencia y `validateConfiguration` |
| `types.ts` | `Sample`, `SourceRecord` (lo que genera la fuente), `RecordContext` y `NormalizedRecord` (lo que añade la app), clave externa `recordKeyOf` |
| `validate.ts` | `validateSourceRecord(input: unknown, config)`: validación en ejecución con errores (código, ruta, mensaje) y advertencias |
| `normalize.ts` | `normalizeRecord`: incorpora procedencia, sesión y recepción |
| `sequence.ts` | `classifySequence`: primero / siguiente / duplicado / salto / fuera de orden |

## Reglas que implementa

- Seis posiciones exactamente una vez por registro; una ausente o desconocida rechaza el registro (no se rellena con cero).
- `status = ok` exige `raw_value` entero dentro de `raw_range`; `status = read_error` exige `raw_value = null`. Cualquier otra combinación es error.
- Un valor en el límite del rango es dato válido con advertencia `adc_boundary`; no demuestra saturación del sensor.
- `sequence` y `time_us` son enteros no negativos seguros (`Number.isSafeInteger`).
- `device_id` y `configuration_id` deben coincidir con la configuración autorizada para la sesión.

## Uso

```ts
import { SIMULATED_CONFIGURATION, validateSourceRecord, normalizeRecord } from "@plantillas/contract";

const result = validateSourceRecord(payload, SIMULATED_CONFIGURATION);
if (result.ok) {
  const record = normalizeRecord(result.record, {
    source: "simulated",
    session_id,
    received_at: new Date().toISOString(),
  });
}
```

Pruebas: `npm test` (casos C01–C08, C10 y C12 de `docs/especificacion/05`). Fixtures en `test-data/contract/`.
