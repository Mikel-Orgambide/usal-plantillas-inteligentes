# Firmware ESP32

Proyecto PlatformIO (Arduino Core, C++17). Decisiones de transporte en `docs/decisiones/0006-transporte-fisico-usb-y-ble.md`; etapas de hardware en `docs/especificacion/04_Hardware_y_Firmware_Paso_a_Paso.md`.

## Entornos

- `esp32-synthetic` (por defecto): lecturas sintéticas generadas en la placa, sin sensores. Sirve para H1, H5 y H6 antes de que lleguen los FSR. `configuration_id = ESP32-SYN-001`.
- `esp32-analog`: **módulo del pie izquierdo** (decisión del 3/11/2026): tres divisores FSR + resistencia fija en pines ADC1 (36, 39, 34). `configuration_id = ESP32-FSR-L-001`. Las posiciones del otro pie se muestran en la app como «no disponible».
- `esp32-analog-right`: **módulo del pie derecho** (ADR 0011), mismo circuito y pines, códigos `R_HEEL`, `R_MEDIAL`, `R_LATERAL`, `configuration_id = ESP32-FSR-R-001`. Se carga en el segundo ESP32; la app conecta ambos módulos a la vez. Firmware 0.3.1 para los dos.

  | Canal | Sensor | Pin | Rótulo en la placa | Resistencia fija |
  |---|---|---|---|---|
  | `L_HEEL` | FSR406 | GPIO 36 | SVP | 2,2 kΩ |
  | `L_MEDIAL` | FSR402 | GPIO 39 | SVN | 4,7 kΩ |
  | `L_LATERAL` | FSR402 | GPIO 34 | P34 | 4,7 kΩ |

  Divisor por canal: 3V3 → FSR → punto medio (al pin) → resistencia fija → GND. Más presión = más cuentas. Resistencias elegidas en banco (`docs/incrementos/etapa-09-fuente-fisica.md`).
- `esp32-adc-test`: programa de banco (H2–H4) en `src/adc_test/`: imprime las seis cuentas crudas por USB cada 100 ms, sin BLE ni contrato. `pio run -e esp32-adc-test -t upload -t monitor`.

## Uso

1. Abrir la carpeta `firmware/` en VS Code con PlatformIO.
2. Conectar la placa por USB (cable con datos). Compilar y cargar (`PlatformIO: Upload`).
3. Abrir el monitor serie (`PlatformIO: Monitor`, 230400). Al arrancar se imprime una línea `info` y una `status` con `event: boot`.
4. Escribir `start` + Enter: se imprime `capture_started` y después un `record` por línea (20 por segundo). `stop` detiene la captura. `info` repite la identificación.

Cada línea es un JSON del contrato v1.0 (`format_version`, `device_id`, `capture_id`, `configuration_id`, `sequence`, `samples[]`) o un `status` con contadores (`generated`, `transmitted`, `dropped`, `read_errors`). `samples[]` trae una muestra por canal configurado (6 en sintético, 3 en analógico). Por BLE, `info` publica `channels` y `models` (listas paralelas) y el registro binario mide 9 + 6 × canales bytes (45 ó 27).

## Identificadores

- `device_id`: `ESP32-<6 hex de la MAC>`.
- `capture_id`: `<device_id>-B<arranque>-C<n>`; el contador de arranques persiste en NVS, así que no se repite entre reinicios.

## Estado

- H0/H1/H5/H6 cerrados con `esp32-synthetic` (etapas 8a y 8b).
- H2–H6 validados en banco el 3/11/2026 con el módulo izquierdo (`esp32-analog` 0.3.0: 475 registros USB sin saltos a 50,00 ms; sesiones físicas por BLE en la app). `esp32-analog-right` pendiente de carga en la segunda placa (6/11).
