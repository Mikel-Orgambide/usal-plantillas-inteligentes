# ADR 0006 - Transporte físico: USB (JSON por línea) y BLE (GATT con registros binarios)

- Fecha: 2026-10-18
- Estado: propuesta (pasa a aceptada cuando H5 y H6 se comprueben con la placa)

## Contexto

La guía (02 §8, 04 §9–10) separa transporte de significado: el contrato v1.0 define qué es un registro; el transporte solo lo lleva. USB se admite como JSON por línea para diagnóstico. Para BLE pide fijar biblioteca, servicio, características, tamaño útil y reconstrucción después de comprobar la capacidad real, y advierte que el JSON de seis muestras (≈ 400 bytes) no cabe en una notificación por defecto (20 bytes útiles con MTU 23).

Hardware disponible: NodeMCU ESP32 (modelo exacto a confirmar en H0/H1). Sensores FSR aún no recibidos: la adquisición sintética permite validar transporte y software antes.

## Decisión

### Firmware
- PlatformIO, Arduino Core para ESP32, C++17. Módulos según la guía 04 §7: `configuration`, `acquisition`, `clock`, `capture_controller`, `record_builder`, `usb_transport`, `ble_transport`, `diagnostics`.
- Dos fuentes de adquisición intercambiables en compilación: `synthetic` (señal determinista, misma forma que el simulador de la app) y `analog` (ADC de 12 bits sobre divisor FSR + resistencia fija; `read_error` cuando la lectura falla o el pin no está configurado). La forma de la señal sintética queda identificada en `configuration_id` (`ESP32-SYN-001`) para que nunca se confunda con lecturas físicas (`ESP32-FSR-001`, cuando exista el circuito).
- Identificadores: `device_id = ESP32-<6 últimos hex de la MAC>`. `capture_id = <device_id>-B<boot>-C<n>`: `boot` es un contador persistente en NVS que se incrementa en cada arranque; `n` el número de captura desde ese arranque. Así no colisiona entre reinicios ni ejecuciones (02 §3).
- Tiempo: `time_us` = microsegundos desde el inicio de la captura, tomado al comienzo de la lectura de cada canal (`esp_timer_get_time`, monotónico). Se transmite como `uint32` (desborda a los 71 min; límite declarado para esta versión).
- Adquisición y transmisión separadas: lectura por temporizador a período fijo; cola acotada de registros; si la cola se llena, el registro se descarta **después** de haber consumido su `sequence`, y el descarte se cuenta en `diagnostics` (hueco observable, 04 §7).

### USB (H5)
- 230400 baudios (115200 no sostiene 20 registros JSON por segundo; a 460800 se perdieron bytes en el host), JSON por línea, UTF-8. Dos tipos: `{"type":"status",...}` y `{"type":"record",...}` con exactamente los campos del contrato (`format_version`, `device_id`, `capture_id`, `configuration_id`, `sequence`, `samples[]`). Órdenes desde el host: `start`, `stop`, `info` (una por línea). Sirve para H1, H5 y para diagnóstico permanente.

### BLE (H6)
- ESP32 servidor GATT (NimBLE-Arduino); app cliente con `react-native-ble-plx` (plugin de configuración para Expo, build nativa nueva).
- Servicio `7a0e0001-5d3f-4b1a-9f4c-2e6b8c1d0001`. Características:
  - `…0002` **info** (read): JSON compacto (< 512 bytes, límite de un valor de característica) con `format_version`, `device_id`, `configuration_id`, `firmware`, `raw_max`, `period_us`, `model` y `channels[]` como lista de códigos; `installation_id` se deriva como `<configuration_id>-<code>`. La app construye la `AcquisitionConfiguration` desde acá, nunca desde un nombre anunciado.
  - `…0003` **control** (write con respuesta): `0x01` start, `0x02` stop. La orden no acredita ejecución: la app espera el evento en **status**.
  - `…0004` **status** (notify): JSON corto: `capture_started {capture_id, boot, n}`, `capture_stopped`, `dropped {count}`, `error {code}`.
  - `…0005` **measurement** (notify): registro binario little-endian de 45 bytes: `u8 version(=1)`, `u16 boot`, `u16 n`, `u32 sequence`, 6 × (`u32 time_us`, `u16 value`) en el orden fijo L_HEEL, L_MEDIAL, L_LATERAL, R_HEEL, R_MEDIAL, R_LATERAL; `value = 0xFFFF` significa `read_error` (raw_value nulo). La app reconstruye el registro JSON del contrato (`capture_id` desde boot+n) y lo pasa por el mismo validador que usa el simulador.
- MTU: la app solicita 185 (mínimo que garantiza 45 bytes por notificación con margen); si la negociación devuelve menos de 48, no se inicia la captura y se informa el motivo (límite comprobado, no asumido).
- Seguridad del enlace: sin emparejamiento en esta versión (prototipo de laboratorio); se declara como alcance de la prueba (04 §10). El nombre anunciado `Plantillas-<id>` es solo para descubrimiento.

### App
- `BleDataSource` implementa la misma interfaz `DataSource` que `SimulatedDataSource`; el coordinador y la persistencia no cambian. Procedencia `physical` la determina el adaptador.
- Pestaña Plantillas: buscar, elegir, conectar, leer **info**, mostrar estado; la sesión física se inicia desde Hoy como hoy, con el dispositivo conectado.

## Consecuencias

- El contrato no cambia; cambia solo el adaptador. Las pruebas H05 comparan registros generados (contador del firmware) con registros aceptados (base de la app).
- La tasa física se medirá (H04) antes de fijarla; el período inicial de 50 ms (20 reg/s ≈ 900 B/s por BLE) es un punto de partida, no un resultado.
- Pendientes que convierten esta ADR en aceptada: biblioteca y versión instaladas, MTU negociado real en el Pixel, caudal sostenido medido, comportamiento ante desconexión.
