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

- Firmware 0.2.2-h6, sesión física de 103 s con el monitor USB abierto (`test-data/firmware/h6-ble-2026-10-19-firmware-0.2.2-status.log`): la placa generó **2069**, transmitió **2069**, descartó **0** (20,0 reg/s sostenidos: +100 por cada `progress` de 5 s). ✔ La tasa quedó resuelta con la tarea de adquisición en el núcleo 1.
- La app aceptó 1204 contiguos (0…1203, 0 huecos) y se atrasó: a 1:14 mostraba 1204 cuando la placa iba por ≈ 1480; «guardados 0 · en cola 1198»; los botones respondían tarde. Causa: cada registro (20/s) redibujaba la pantalla de Grabación completa (siluetas y gráfico SVG), saturando el hilo de JavaScript; la cola de escritura dependía de un temporizador sin turno; lo que llegó tras Finalizar se descartó como tardío. Con el simulador no se manifestaba porque el simulador no puede adelantarse a la app.
- Corrección en la app (sin build): publicación de estado a las pantallas limitada a 8 por segundo (los registros se procesan todos), lote de escritura completo se guarda sin temporizador, ventana de datos tardíos 1,5 s. El driver SQLite de Node pasa a serializar transacciones como el de expo-sqlite (la prueba C08/C12 detectó la diferencia).

- **Sesión física de 62 s con la app corregida (H05)**: placa generados 1225 · transmitidos 1225 · descartados 0 · read_errors 12; app guardados **1225**, 0 huecos, 12 lecturas fallidas, 20,0 reg/s; a los 30 s «guardados 607 · en cola 0». Registros generados = aceptados. ✔
- Firmware 0.2.3-h6: `start` con captura activa confirma con el `capture_id` vigente (orden idempotente). `BleDataSource` reenvía `start` al reconectar: mismo id ⇒ siguió la misma captura (lo perdido es hueco); id distinto (placa reiniciada) ⇒ `capture_restarted` y captura nueva. Pruebas con placa falsa: corte sin reinicio y reinicio durante la sesión (15 pruebas en el paquete).
- Observación: en la development build la interfaz se percibe con retardo durante la grabación; se atribuye al modo de desarrollo (Metro) y al redibujo de SVG a 8 Hz. Pendiente para la etapa 10: memorizar FootMap/LineChart y comprobar con una build *preview*.

- **H06, primera corrida (2026-10-20)**: placa desenchufada a los 33 s de una sesión física. Desconexión reconocida: evento «Desconectado · enlace cortado (código 147)», valores en gris, banner, duración continúa; 549 registros previos guardados (= generados hasta el corte). ✔ Reconexión: fallida; 10 intentos de conexión directa por dirección en ~28 s sin éxito y «Error de la fuente» al finalizar; además un rechazo de promesa sin manejar en `stopCapture`. Corrección: antes de reconectar la app espera ver la placa anunciarse (escaneo filtrado por el servicio, 4 s) y recién entonces conecta, con 12 intentos (≈ 1 min); las órdenes cancelan su espera si la escritura falla; detener sin enlace informa el motivo sin intentar escribir.

- **H06, segunda corrida (2026-10-20, reconexión por escaneo)**: sesión física de 51 s, placa desenchufada a los 25 s. Eventos: Desconectado 0:25 (código 147) → Reconectado 0:30 → Reinicio de captura (`ESP32-9E7EE4-B23-C1`, la placa arrancó de nuevo: B22 → B23) → Captura detenida 0:50 → Sesión finalizada. Detalle: 2 capturas · 1 reinicio, **804 registros = 100 % de los esperados** en sus dos capturas, 0 huecos, 8 lecturas fallidas, métricas por captura. Reconexión en 5 s. ✔
- Hallazgo adicional: tras recargar la app con la placa reiniciada, el estado decía «conectadas» sin enlace real y Iniciar fallaba (`Peripheral not connected`) dejando una sesión vacía incompleta. Corrección: con enlace perdido, Iniciar reconecta antes de crear la sesión (y explica si no puede); Hoy lo indica; la pestaña Plantillas reconecta al abrirse.

## Cierre de la etapa 8

Cumplidos los cierres de la guía para H6 (recepción sostenida con seis canales, desconexión reconocida, reconexión con dispositivo/configuración/captura comprobados) y de la etapa 8 de software (los seis canales reales recorren adquisición, recepción, guardado, cierre y recuperación; mensajes generados/recibidos y discontinuidades registrados). Lecturas sintéticas generadas en la placa: acreditan transporte y software, no adquisición plantar (H2–H4 con los FSR).

Registros: `test-data/firmware/h6-ble-2026-10-19-firmware-0.2.2-status.log`, `h6-ble-2026-10-20-reconexion-status.log`. build nueva instalada; buscar y conectar; sesión física de duración definida; comparación generados (firmware) / guardados (app); desconexión y reconexión alejando la placa o reiniciándola.
