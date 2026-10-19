# Etapa 8b - Fuente física por BLE (H6)

- Fecha de implementación: 2026-10-19
- Firmware: 0.2.0-h6 (`esp32-synthetic`). App: build de desarrollo nueva (módulo nativo BLE).
- Decisión: ADR 0006.

## Qué se implementó

### Firmware 0.2.0-h6
- Anuncio BLE separado en anuncio (flags + UUID de servicio de 128 bits) y respuesta de escaneo (nombre `Plantillas-<id>`): juntos superaban los 31 bytes de un anuncio.
- Una notificación que la pila BLE no pudo encolar cuenta como descarte (`dropped`) y no como transmitida: el hueco es observable en la app.

### Paquete `@plantillas/ble` (TypeScript, sin React Native)
- `parseDeviceInfo`: lee la característica *info* y construye la `AcquisitionConfiguration` con procedencia `physical`; rechaza versión de formato desconocida, canales en otro orden o modelos desconocidos.
- `decodeMeasurement` / `encodeMeasurement`: registro binario de 45 bytes ↔ registro del contrato (sin validar). `0xFFFF` → `read_error` con `raw_value` null; enteros de 32 bits sin signo conservados.
- `BleDataSource`: misma interfaz `DataSource` que el simulador sobre un `BleLink` abstracto. `startCapture`/`stopCapture` esperan la confirmación de la placa por *status* (una orden enviada no acredita captura iniciada); MTU menor a 48 se rechaza; corte del enlace → `disconnected`, reintentos y `reconnected`; notificaciones malformadas se cuentan.
- `SensorModel` admite `synthetic` (canal sin sensor).

### App
- Biblioteca: `react-native-ble-manager` 12.5.3 (TurboModule de la nueva arquitectura, plugin de Expo). Se descartó `react-native-ble-plx` 3.5.1 por usar todavía el puente antiguo.
- Permisos (plugin): `BLUETOOTH_SCAN` con `neverForLocation` y `BLUETOOTH_CONNECT`; ubicación solo hasta Android 10.
- `infrastructure/ble/deviceStore`: permisos, búsqueda filtrada por el UUID del servicio (no por nombre), conexión, MTU 185, prioridad de conexión alta, lectura de *info*, reconexión con verificación de que la placa informe la misma configuración, última placa recordada.
- `application/activeSource`: regla única de fuente para sesiones nuevas (plantillas conectadas → física; si no, simulador si está permitido).
- Pestaña Plantillas real (buscar, conectar, configuración publicada, MTU, desconectar); Hoy, Preparación, Grabación y Ajustes muestran la fuente efectiva.

## Pruebas automáticas

`npm test`: 95 pruebas (13 nuevas en `@plantillas/ble`), incluida la integración con una placa falsa a nivel de bytes → `BleDataSource` → `SessionCoordinator` → SQLite: sesión `physical`, `capture_id` de la placa, hueco por notificación perdida, `disconnected`/`reconnected`, lectura fallida como null.

## Limitaciones declaradas

- `configuration_id` lo fija el firmware (`ESP32-SYN-001`), no incluye el `device_id`: con una segunda placa del mismo firmware la base rechazaría la configuración. Con una sola placa no aplica; se resolverá al definir la configuración física (H2).
- Sin emparejamiento ni cifrado del enlace (prototipo de laboratorio, ADR 0006).
- `time_us` en 32 bits: desborda a los 71 min de captura.

## Verificación en dispositivo (en curso, 2026-10-19)

- Build de desarrollo 9b754d72 (`react-native-ble-manager`), `expo-doctor` 21/21, instalada por `adb`.
- Búsqueda: la app encuentra `Plantillas-9E7EE4` (68:09:47:9E:7E:E6, −60 dBm) filtrando por el UUID del servicio. El permiso de dispositivos cercanos se pidió y concedió. ✔
- Primer intento de conexión: «la característica info no contiene JSON válido». Causa: el JSON de *info* (≈ 630 bytes) superaba los 512 bytes máximos de un valor de característica y la pila de la placa lo recortaba. Corrección en firmware 0.2.1-h6: *info* compacta (≈ 230 bytes, `model` único y canales como códigos); la app deriva `installation_id` y acepta ambas formas.

- Firmware 0.2.1-h6 + build 9b754d72: conexión con MTU 185, configuración `ESP32-SYN-001` leída y seis posiciones reconocidas; Hoy y Preparación muestran `Plantillas · ESP32-9E7EE4`. ✔
- Primera sesión física (Caminata, 54 s): 643 registros guardados = 100 % de los esperados por secuencia, 0 huecos, 1 captura (`capture_id` de la placa), procedencia **física**, 6 lecturas fallidas en `R_LATERAL` (643/97 ≈ 6,6 → coherente con el firmware), métricas y gráfico completo calculados por el mismo camino que las sesiones simuladas. ✔
- Observaciones a resolver antes de cerrar: (1) tasa recibida 12,0 reg/s con secuencia contigua ⇒ la placa generó menos registros con BLE activo (por USB daba 20,00); hipótesis: el temporizador `esp_timer` corre en el núcleo 0 junto al controlador BLE → firmware 0.2.2-h6 mueve la adquisición a una tarea propia del núcleo 1 y publica `status: progress` por USB cada 5 s con generados/transmitidos/descartados; (2) en Grabación «guardados 0 · en cola 639» a los 53 s, todo confirmado recién al finalizar; se repite la corrida para ver si es el contador o la escritura.

Pendiente: firmware 0.2.2-h6 cargado; build nueva instalada; buscar y conectar; sesión física de duración definida; comparación generados (firmware) / guardados (app); desconexión y reconexión alejando la placa o reiniciándola.
