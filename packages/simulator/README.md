# @plantillas/simulator

Fuente de datos **simulada y determinista** que implementa la interfaz `DataSource` del contrato. Produce los seis canales con semilla fija, capturas y secuencias, y modos de prueba para ejercitar validación, persistencia y sesiones sin hardware.

Todo lo que genera lleva `device_id = SIM-001` y configuración `SIM-CONFIG-001`; la aplicación lo marca como procedencia `simulated`. Los valores siguen un patrón sintético de alternancia de pies; **no reproducen una marcha real ni frecuencias del ESP32**. El período entre registros (`record_period_us`, 20 000 µs por defecto) es un parámetro del generador.

## Módulos

| Módulo | Qué hace |
|---|---|
| `random.ts` | PRNG mulberry32 con semilla |
| `signal.ts` | Patrón de carga por zona y pie, escalado al rango ADC de la configuración |
| `scenario.ts` | Modos de prueba: `normal`, `read_error`, `disconnect`, `sequence_gap`, `duplicate`, `conflict`, `capture_restart`, `contradiction`, `missing_channel` |
| `generator.ts` | Iterador puro que produce payloads (sin validar) y eventos de fuente |
| `source.ts` | `SimulatedDataSource`: emite con temporizador, implementa `DataSource` |

## Uso

```ts
import { SimulatedDataSource, SCENARIOS } from "@plantillas/simulator";

const source = new SimulatedDataSource({ seed: 1, scenario: SCENARIOS.disconnect });
source.subscribe({ onPayload: (p) => {/* validateSourceRecord(p, source.configuration) */}, onEvent: console.log });
await source.connect();
await source.startCapture();
```

Pruebas: `npm test` (13 pruebas; incluye un fixture dorado en `test-data/simulator/`).
