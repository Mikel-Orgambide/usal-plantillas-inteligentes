# Firmware ESP32

Proyecto PlatformIO (Arduino Core, C++17). Decisiones de transporte en `docs/decisiones/0006-transporte-fisico-usb-y-ble.md`; etapas de hardware en `docs/especificacion/04_Hardware_y_Firmware_Paso_a_Paso.md`.

## Entornos

- `esp32-synthetic` (por defecto): lecturas sintéticas generadas en la placa, sin sensores. Sirve para H1, H5 y H6 antes de que lleguen los FSR. `configuration_id = ESP32-SYN-001`.
- `esp32-analog`: seis divisores FSR + resistencia fija en pines ADC1. `configuration_id = ESP32-FSR-001`. Solo a partir de H2.

## Uso

1. Abrir la carpeta `firmware/` en VS Code con PlatformIO.
2. Conectar la placa por USB (cable con datos). Compilar y cargar (`PlatformIO: Upload`).
3. Abrir el monitor serie (`PlatformIO: Monitor`, 460800). Al arrancar se imprime una línea `info` y una `status` con `event: boot`.
4. Escribir `start` + Enter: se imprime `capture_started` y después un `record` por línea (20 por segundo). `stop` detiene la captura. `info` repite la identificación.

Cada línea es un JSON del contrato v1.0 (`format_version`, `device_id`, `capture_id`, `configuration_id`, `sequence`, `samples[]`) o un `status` con contadores (`generated`, `transmitted`, `dropped`, `read_errors`).

## Identificadores

- `device_id`: `ESP32-<6 hex de la MAC>`.
- `capture_id`: `<device_id>-B<arranque>-C<n>`; el contador de arranques persiste en NVS, así que no se repite entre reinicios.

## Estado

- Pendiente de compilar y comprobar en la placa real (H1). El modelo exacto de la placa y la versión de Arduino Core se registrarán en `docs/incrementos/` al cerrar H1.
