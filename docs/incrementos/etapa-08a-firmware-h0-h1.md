# Etapa 8a - Hardware H0/H1 y protocolo USB (H5, primera evidencia)

- Fecha: 2026-10-19
- Firmware: `firmware/` 0.1.0-h1, entorno `esp32-synthetic` (lecturas sintéticas, sin sensores)
- Decisión de transporte: ADR 0006

## H0 - Inventario (parcial)

- Placa de desarrollo tipo ESP32 DevKitC (clon genérico), USB-C, botones EN e IO0, regulador AMS1117 3,3 V.
- Módulo con blindaje rotulado «ESP-32 · WIFI+BT SoC Inside». esptool identifica **ESP32-D0WD-V3, revisión v3.1**, Wi-Fi + BT, doble núcleo, 240 MHz, cristal 40 MHz, 4 MB de flash. MAC `68:09:47:9e:7e:e4`.
- Conversor USB-serie **Silicon Labs CP2102** (rótulo `CP2102 FPC03X 2433+`). Driver: Silicon Labs CP210x USB to UART Bridge, COM3 en la PC del autor.
- Sensores FSR: no recibidos. Se registrarán en H0 al llegar (seis activos + repuestos, modelo comprobado).

## H1 - Placa sin sensores

- Entorno: VS Code + PlatformIO Core 6.2.0, plataforma Espressif 32 7.1.3, framework-arduinoespressif32 4.20017 (Arduino Core 3.x), toolchain xtensa-esp32 8.4.0, NimBLE-Arduino 2.5.1, ArduinoJson 7.4.3. Uso de memoria: RAM 11,6 %, flash 47,4 %.
- Carga: la placa no entra sola en modo de descarga (*Wrong boot mode 0x13*); se carga manteniendo IO0. A 460800 baudios la carga se interrumpió al 54 %; con `upload_speed = 115200` es estable (≈ 37 s).
- Ejecución observada: al arrancar emite `info` (identificación, configuración, seis canales) y `status: boot`. El contador de arranques en NVS avanza en cada reinicio (`B2`, `B3`, `B4`), por lo que `capture_id` no se repite entre reinicios.
- Correcciones derivadas: `device_id` tomaba los 3 bytes del fabricante del MAC → ahora `ESP32-9E7EE4` (bytes propios); `info` y `record` perdían el campo `type` al armar el JSON → corregido; a 460800 baudios se observó un byte perdido en la recepción del host → USB a 230400.

Cierre H1: programa cargado y comunicación USB observada. ✔

## H5 - Protocolo USB (primera corrida, firmware previo a las correcciones)

Registro: `test-data/firmware/h1-usb-2026-10-19-firmware-0.1.0.txt`. Validación: `python scripts/check_serial.py <log>`.

| Comprobación | Captura `B4-C1` | Captura `B4-C2` |
|---|---|---|
| Registros recibidos / generados (contador del firmware) | 136 / 136 | 38 / 38 |
| Secuencia | 0…135 sin saltos | 0…37 sin saltos |
| Período entre registros (objetivo 50 ms) | 49,95–50,02 ms, mediana 50,00 | 49,74–50,25 ms, mediana 50,00 |
| Desfase entre el 1.º y el 6.º canal | 12–166 µs | 11–75 µs |
| `read_error` (null, nunca cero) | 1 | 0 |
| Líneas JSON corruptas | 0 de 174 | |

Limitaciones: corrida corta (≈ 9 s), señal sintética, sin carga BLE simultánea. No acredita adquisición plantar ni la tasa física sostenible (H04), que se medirán con duración y límites fijados de antemano.

## Pendiente

- Repetir la corrida con el firmware corregido (230400, `type` en todos los mensajes) y una duración definida (H04/H05).
- H6: aplicación como cliente BLE (`react-native-ble-plx`, build nueva), `BleDataSource`, pestaña Plantillas.
