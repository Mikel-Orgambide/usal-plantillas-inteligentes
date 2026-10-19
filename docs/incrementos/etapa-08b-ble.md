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

## Verificación en dispositivo

Pendiente: firmware 0.2.0-h6 cargado; build nueva instalada; buscar y conectar; sesión física de duración definida; comparación generados (firmware) / guardados (app); desconexión y reconexión alejando la placa o reiniciándola.
