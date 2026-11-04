# Etapa 13 — Sesión bilateral con dos módulos (ADR 0011)

- Fecha: 2026-11-04. Estado: **implementada y comprobada con dos fuentes simuladas**; **pendiente de validación física** con dos ESP32 (previsto para el 6/11/2026).
- Alcance: la app conecta hasta dos módulos a la vez (uno por pie), graba una sesión con dos capturas independientes, muestra el estado de cada módulo, calcula izquierda/derecha y asimetría sólo en los tramos con ambos presentes, y lo declara en el detalle, la comparación y el informe PDF. Firmware: entorno `esp32-analog-right` (`ESP32-FSR-R-001`, firmware 0.3.1) para el segundo ESP32.

## Qué se implementó

| Bloque | Cambio |
|---|---|
| Firmware | `esp32-analog-right` (`-DACQ_FOOT_RIGHT=1`): códigos `R_*`, mismos pines 36/39/34, modelos y resistencias (2,2 kΩ talón, 4,7 kΩ antepié). `FIRMWARE_VERSION` 0.3.1 en ambos entornos. Nombre BLE sin cambios (`Plantillas-<hex>`): el pie sale de la configuración publicada. |
| Contrato | `RIGHT_MODULE_CONFIGURATION`, `simulatedModuleConfiguration(foot)` (SIM-L-001 / SIM-R-001). |
| Simulador | `clock_drift_ppm`: deriva configurable del reloj de la fuente, para dos módulos con relojes distintos. |
| Sesión | `SessionCoordinator` acepta `modules[]` (1..2; `source`+`configuration` siguen valiendo). Rechaza dos módulos del mismo pie, procedencias mezcladas, mismo `device_id` o más de dos. Estado por módulo (`identified/connected/stale/disconnected/reconnecting`), captura, cola y secuencia por módulo, `values` fusionados. Pérdida de un módulo: la sesión sigue, eventos `module_lost` / `module_recovered` (con `device_id`, `foot`, `incomplete_ms`); `interrupted` sólo sin ningún módulo. Falta de un módulo al iniciar: arranca con el otro y lo registra perdido. |
| Storage | El paquete de respaldo lleva `configurations[]`; la restauración abre cada captura con su configuración. Paquetes anteriores (sin el campo) siguen restaurando. |
| Métricas | `computeBilateral` (`bilateral-1.0`): origen de reloj por módulo = mediana de `received_at − time_us`; `offset_ms` = diferencia de orígenes (declarado, no corregido); intervalos completos = intersección de la presencia de ambos (huecos < 1 s); `complete_fraction`; métricas y distribución sólo dentro de los intervalos completos. |
| BLE | Dos `BleDataSource` simultáneas (independientes por construcción); reconexión por módulo. `deviceStore` de la app mantiene hasta dos placas (`modules`), rechaza un segundo módulo del mismo pie, recuerda `lastDevices` y reconecta ambas. |
| App | Plantillas: una fila por pie, buscar el módulo del otro pie, desconectar uno o ambos. Preparación: posiciones de ambas configuraciones. Grabación: chips de estado por módulo y banner «módulo perdido · la sesión sigue». Detalle: calidad por módulo, correspondencia (desfase y % completo), bloque Izquierda/derecha sobre tramos completos. Comparación: ventana = primera captura de cada módulo combinadas; bloque izq/der cuando ambas sesiones lo tienen. Ajustes → Demostración: «Simular dos módulos». |
| Informe PDF | Montaje con un módulo por fila, correspondencia entre módulos en Calidad, bloque bilateral en Indicadores con desfase y fracción completa; comparación con ambas configuraciones. |

## Pruebas (comprobación de la preparación bilateral, cierre del 27/10 §6.5)

`packages/session/test/bilateral.test.ts` (7), `integration.test.ts` (+1 con dos `SimulatedDataSource`), `packages/ble/test/source.test.ts` (+1 con dos placas falsas), `packages/simulator/test/drift.test.ts` (1), `packages/report/test/report.test.ts` (+1 bilateral):

- dos módulos identificables, recepción independiente, una captura por dispositivo, sin secuencia global;
- falta de un módulo al inicio → sesión con el otro, `module_lost`;
- pérdida y reconexión de uno a mitad de sesión → la sesión sigue, `module_lost`/`module_recovered` con `incomplete_ms`, hueco de secuencia en la captura correcta, métricas bilaterales sólo sobre los dos tramos completos (80 + 80 registros, no los 40 del tramo sin derecho);
- relojes con distinto origen (700 ms) y deriva (+1 %) → `offset_ms` estimado entre −760 y −650, fracción completa ≈ 1;
- sin ambos pies → bilateral «n/d»;
- export/import de paquetes con uno y con dos módulos, y de un paquete anterior sin `configurations`;
- dos placas BLE falsas: el corte de una no afecta a la otra; el hueco queda en su captura.

Resultado: 148 pruebas en verde (contract 25, simulator 16, storage 26, metrics 29, session 19, ble 20, sync 8, report 5); `tsc` en verde en los ocho paquetes y en `apps/mobile`.

**Esto comprueba la lógica, no el enlace físico.** No acredita conexión simultánea real de dos ESP32, tasa sostenida con dos enlaces ni el desfase real.

## Pendiente para la validación física (6/11/2026)

1. Cablear el segundo banco de tres divisores (FSR406 2,2 kΩ; FSR402 4,7 kΩ ×2) y cargar `pio run -e esp32-analog-right -t upload`; confirmar `info` con `ESP32-FSR-R-001`.
2. En la app: Plantillas → conectar la primera placa → «Buscar el módulo del pie derecho» → conectar la segunda. Preparación debe mostrar 6 de 6 posiciones.
3. Sesión bilateral de apoyo estático (parado, talones, puntas) y una segunda con el mismo protocolo para Comparación. Exportar paquete e informe PDF; guardar en `test-data/fisico/`.
4. Registrar: tasa efectiva por módulo con dos enlaces (objetivo 20 reg/s cada uno), descartes (`progress` por USB), desfase estimado y fracción completa observados, comportamiento de Android al perder y recuperar un módulo (apagar una placa 5 s).
5. H3 por sensor (seis) con `esp32-adc-test`.
6. Remoto: `session.configuration` guarda sólo el primer módulo; evaluar ampliar el esquema (evolución futura).
