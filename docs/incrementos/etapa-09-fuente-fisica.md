# Etapa 9 - Fuente física: banco de sensores FSR (H2, H3 parcial, H4)

- Fecha: 2026-11-03 (en curso)
- Firmware: `firmware/` 0.3.0 — entorno de banco `esp32-adc-test` (cuentas crudas por USB); entorno `esp32-analog` con configuración `ESP32-FSR-L-001` (tres canales), pendiente de carga
- Alcance físico: decisión del 3/11/2026 (ver más abajo)
- Estado: H2 y H4 ensayados en banco; H3 por sensor, sesión física en la app y H6 con sensores reales: pendientes

## Decisión de alcance (3/11/2026)

- Todas las pruebas se realizan **en protoboard**. No se construye plantilla, caja ni cableado de calzado: la plantilla instrumentada queda como diseño y evolución futura. El objetivo es demostrar el recorrido completo señal real → ESP32 → BLE → app → sesión → métricas → historial.
- Se monta un **módulo unilateral izquierdo**: un único ESP32 (sólo se dispone de uno; la arquitectura bilateral prevé un módulo por pie) con tres canales: talón, antepié medial y antepié lateral. El pie derecho no se instrumenta; en todo el sistema queda «no disponible», nunca en cero.
- Vocabulario para la tesis: «módulo de sensado en banco» (montaje), «ensayo de apoyo estático» (pie sobre los sensores), «señal adquirida de FSR» frente a «señal sintética».
- Consecuencia en software: el contrato admite configuraciones con un subconjunto de las seis posiciones (en su orden); validador, BLE, sesión, métricas, persistencia y pantallas respetan ese subconjunto (ver «Cambios de software»).

## Inventario usado (H0, cierre)

| Componente | Cantidad | Uso |
|---|---|---|
| NodeMCU ESP32-32S 38 pines, USB-C (`ESP32-9E7EE4`, ESP32-D0WD-V3) | 1 | Placa única del módulo |
| FSR406 (cuadrado 38 mm, película resistiva, 2 patas) | 2 | Talón (1 activo + 1 repuesto) |
| FSR402 (redondo 18 mm) | paquete(s) de 5 (cantidad final a registrar) | Antepié medial y lateral (2 activos + repuestos) |
| Resistencias ¼ W 1 % del kit (30 valores) | 2,2 kΩ ×1, 4,7 kΩ ×2 activas; 10 kΩ, 1 kΩ, 22 kΩ, 47 kΩ para ensayos | Divisores |
| Protoboard MJ 830 puntos | 1 | Montaje |
| Dupont macho-macho y macho-hembra 20 cm | — | Las hembras abrazan las patas del FSR (no se suelda la película) |
| Multímetro Brinna HB-113A | 1 | Verificación de FSR, resistencias y divisor |
| Cinta Kapton y doble faz | — | Fijación de conectores |

Sin power bank ni batería: alimentación por USB desde la PC. Sin ADS1115 ni multiplexor: ADC interno de 12 bits.

## Circuito y pin map (H2, fijado)

Divisor por canal: `3V3 → FSR → punto medio → R fija → GND`; el punto medio va al pin ADC1. Más presión ⇒ menor resistencia del FSR ⇒ mayor tensión ⇒ más cuentas (0–4095, atenuación 11 dB por defecto del core).

| Canal | Sensor | Pin ESP32 | Rótulo | R fija | Fila de protoboard |
|---|---|---|---|---|---|
| `L_HEEL` | FSR406 | GPIO 36 | SVP | 2,2 kΩ | 10 |
| `L_MEDIAL` | FSR402 | GPIO 39 | SVN | 4,7 kΩ | 15 |
| `L_LATERAL` | FSR402 | GPIO 34 | P34 | 4,7 kΩ | 20 |

Los pines 34/36/39 son sólo entrada, sin resistencias internas; el divisor externo las hace innecesarias.

## Resultados de banco (3/11/2026)

Programa: `esp32-adc-test` (10 lecturas/s, cuentas crudas). Logs: `firmware/logs/device-monitor-261103-*.log` (no versionados; copia de los cuatro principales como `.txt` en `test-data/fisico/logs-serie/`) (162826 carga y primera lectura; 163138 dedo con 10 kΩ; 163418 y 163652 tarro con 10 kΩ y 4,7 kΩ; 165003 dedo con 2,2 kΩ; 170847 tres canales).

| Ensayo | Sensor · R fija | Observado | Lectura |
|---|---|---|---|
| Verificación con tester (H0) | todos los FSR, escala 2 MΩ | «1» (fuera de rango) en reposo; pocos kΩ al apretar; a más presión, menos resistencia | Ningún sensor muerto; comportamiento correcto |
| Divisor con tester (H2) | FSR402 · 10 kΩ, V⎓ 20 | ≈0 V reposo, 1–2,5 V pulgar, ≈3 V fuerte | Divisor correcto; la escala V⎓ 2 sobrecarga por encima de 2 V |
| Reposo | FSR406 · 10 kΩ | 0 cuentas, estable | Sin ruido de reposo con el divisor conectado |
| Pulgar | FSR406 · 10 kΩ | 3500 → 4095 al apretar; vuelve a 0 en < 100 ms | 10 kΩ satura con el dedo: inservible para carga corporal |
| Carga constante (tarro de maní) | FSR406 · 10 kΩ | 2150 → 2600 en 5 s (deriva / creep) | Mitad de rango; deriva propia del FSR a documentar como limitación |
| Carga constante (mismo tarro) | FSR406 · 4,7 kΩ | ≈1980 ± 50, estable | Diferencia entre 10 kΩ y 4,7 kΩ menor que la variación por colocación (≈10 %) |
| Pulgar medio / máximo | FSR406 · 2,2 kΩ | ≈2000 medio; 3200 y luego ≈3850 máximo, sin llegar a 4095; rampa visible al apretar y soltar | **2,2 kΩ elegida para el talón** |
| Tres canales independientes (H4) | 2,2 / 4,7 / 4,7 kΩ | Reposo 0 en los tres; al apretar de a uno: `L_MEDIAL` 3583, `L_LATERAL` 3846, `L_HEEL` 3501, cada uno sólo en su campo | Identificación de canales sin mezclas; `R_HEEL` (pin 35 al aire) copia a su vecino: desaparece al no leerlo |

Observaciones: los pines no conectados leen ruido (≈400–480 en `R_MEDIAL`): es esperable y no es dato. La carga constante muestra deriva ascendente (creep) y una repetibilidad del orden del 10 % entre colocaciones; ambas van a Limitaciones. El tester en escala V⎓ 2 muestra «1» por encima de 2 V: usar V⎓ 20.

## Cambios de software (implementados, pendientes de validar con la placa)

- Firmware 0.3.0: `esp32-analog` declara 3 canales (`ESP32-FSR-L-001`), modelo por canal, registro binario de 9 + 6 × n bytes (27 con tres canales), `info` BLE con `channels` y `models`; entorno `esp32-adc-test` para banco. `esp32-synthetic` sigue en seis.
- Contrato: `validateConfiguration` acepta 1..6 posiciones en orden; `validateSourceRecord` exige exactamente las de la configuración (`channel_not_in_configuration` para las ajenas); `configuredChannels`, `footAvailability`, `LEFT_MODULE_CONFIGURATION`.
- BLE: `info` con subconjunto; `decodeMeasurement` usa la cantidad de canales de la configuración (`measurementContextOf`).
- Sesión: posiciones no configuradas con estado `unavailable` y valor `null` (nunca `stale` ni 0).
- Métricas: `NOT_INSTRUMENTED` por posición; distribución sobre las instrumentadas (izq/der y asimetría `null` sin ambos pies; `instrumented`, `bilateral`); comparación sólo sobre posiciones instrumentadas en ambas sesiones; resultados guardados sólo para las configuradas.
- App: siluetas con «n/d» gris y discontinuo para posiciones no instrumentadas; indicador Izq/der «n/d · requiere ambos pies»; Detalle y Comparación muestran sólo las posiciones instrumentadas; Preparación cuenta posiciones respecto de la configuración.
- Pruebas: contrato 25, BLE 19, sesión 11, métricas 29, storage 26, simulador 15, sync 8 (todas en verde); typecheck de paquetes y app en verde.

## Validación con la placa y la app (3/11/2026, tarde)

- **H4/H5 por USB** con `esp32-analog` 0.3.0: log `firmware/logs/device-monitor-261103-173017.log`, validado con `scripts/check_serial.py` (ahora toma los canales de la línea `info`): 475 registros, secuencia 0..474 sin saltos, período 50,00 ms (mín 49,98 / máx 50,00), desfase 1.º→3.º canal 246–996 µs, 0 `read_error`, valores 0..3902.
- **H6 con señal real (BLE → app)**, primera sesión física: `test-data/fisico/sesion-2026-11-03-18763da6.plantillas.json` (configuración `ESP32-FSR-L-001`, origen `physical`, 436 registros sin saltos en 23,4 s, eventos connected → capture_started → session_started → capture_stopped → session_stopped; máximos L_HEEL 3469 · L_MEDIAL 3722 · L_LATERAL 3878, sin saturar). Grabación muestra el pie derecho como «no instrumentado · n/d» y 20,0 reg/s con 0 huecos.
- **Ensayo de apoyo con el pie** (sensores sobre el piso con moneda, pie izquierdo descalzo): `test-data/fisico/sesion-2026-11-03-ca49daed.plantillas.json`, 609 registros sin saltos en 32,0 s. Talón (FSR406, 2,2 kΩ) con carga: mediana 3812, p10 3730, máx 3909, **ninguna lectura en 4095**. Antepié medial (FSR402, 4,7 kΩ): mediana 3145, máx 4048. Antepié lateral: mediana 3390, máx 3621. Conclusión H2: se confirman 2,2 kΩ en el talón y 4,7 kΩ en el antepié; el talón con todo el peso queda al 93–95 % del rango, margen justo pero sin saturación (si en ensayos posteriores satura, pasar a 1 kΩ y registrar nueva configuración).
- Capturas de Grabación con el pie en `docs/capturas/0.12.0-fsr/01..04-grabacion-pie-fsr.png`.

## Pendientes para cerrar la etapa

- [ ] Prueba con el pie (apoyo estático) para confirmar 2,2 kΩ en talón y 4,7 kΩ en antepié; cambiar a 1 kΩ / 2,2 kΩ si satura.
- [ ] H3 por sensor: reposo 30 s, carga conocida 10 s × 3, retiro; tabla por unidad (hoja «Test Sensores FSR» en Drive).
- [ ] Cargar `esp32-analog` 0.3.0 y validar por USB con `scripts/check_serial.py` (tres canales, 20 reg/s, sin saltos).
- [ ] Primera sesión física en la app (BLE, H6 con sensores): conteo = `transmitted`, mapeo correcto en siluetas, prueba de desconexión.
- [ ] Ensayo de apoyo estático (parado, talones arriba, puntas arriba) en dos sesiones y comparación en la app.
- [ ] Foto cenital del banco con rótulos; cantidades finales del inventario.
