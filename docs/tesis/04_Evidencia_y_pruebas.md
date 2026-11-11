# 04 — Evidencia y pruebas

- Corte: 5/11/2026 (app 0.15.2, firmware 0.3.1). Completar las tablas vacías el 6/11 y actualizar estados en `01_Especificacion_final.md` y `docs/especificacion/08_Alcance_Final_del_Prototipo.md`.
- Para el cap. 7: cada fila de resultado debe citar número + ruta. Lo que falle se informa igual (la cátedra pide datos buenos y malos, Clase 12).

## 1. Pruebas automáticas (software)

Ejecución: `npm test` en la raíz (todas las workspaces, Vitest) y `npm run typecheck`. Total al 5/11: **199 pruebas, todas en verde**. Son deterministas (simulador con semilla, `now` inyectado) → estado [S].

| Paquete | Pruebas | Qué cubren |
|---|---:|---|
| `contract` | 25 | Validación del contrato v1.0, casos C01–C12 (formato, identificadores, secuencia, muestras, `read_error`, unidad, canales), subconjuntos de canales por módulo |
| `simulator` | 16 | Determinismo por semilla, modos de señal, fixture dorado (`test-data/simulator/semilla-0001-normal-20.json`), deriva de reloj simulada |
| `ble` | 20 | `parseDeviceInfo`, decodificación de registros binarios (45 bytes = 6 canales; 27 bytes = 3 canales), `BleDataSource`: desconexión, reconexión, reinicio de captura, dos placas simultáneas |
| `session` | 19 | Coordinador de sesión (S01/S02), sesión bilateral ×7 (correspondencia por recepción, desfase, intervalos completos, módulo perdido/recuperado), integración ×2 (fuente → validación → almacenamiento) |
| `storage` | 29 | Migraciones locales P04 (hasta v8), P01–P03, casos C08/C09/C11, respaldo/restauración P05, estado de sincronización, cola de escritura, entrenamiento, registro del asistente |
| `metrics` | 29 | `desc-1.0` con fixtures A–D, `dist-1.0` (reparto, asimetría, variabilidad, n/d con canales faltantes), comparación y comparabilidad (U03), métricas unilaterales y bilaterales |
| `sync` | 9 | Lotes (250), reintentos (3), confirmación por cantidades, estados pendiente/confirmada |
| `report` | 9 | CSV ×2; PDF bilateral, unilateral, simulado, comparación, sección 7b de entrenamiento |
| `assistant` | 28 | Cliente directo (LM Studio) y por proxy (función), armado de contexto, preguntas de seguimiento, filtro de alcance (nivel 3 clínico), prompt compartido, contexto de entrenamiento |
| `training` | 15 | Cursor de actividad, descanso bloqueante, caminata, validación de rutinas/series, resumen (volumen Σ reps×kg, minutos, RPE medio), parsing de carga asistida, entrenamiento libre |
| **Total** | **199** | |

Pruebas de la base remota (no Vitest):
- `scripts/remote-check.mjs` contra Supabase real: **10/10** (dos cuentas A y B; cada una ve sólo lo suyo; inserciones ajenas rechazadas) → `test-data/remote/remote-check-2026-10-27-supabase.txt` [H].
- Verificación de RLS en PostgreSQL 16 local: `test-data/remote/check-rls-2026-10-21-postgres16-local.txt`, `check-rls-2026-10-27-postgres16-local.txt`, `check-rls-tras-0003-2026-11-04.txt`.
- Migración 0003 (configuración de sesión bilateral): `test-data/remote/check-bilateral-2026-11-04.txt` [S].

## 2. Evidencia de hardware (con números)

### 2.1 Placa y firmware (etapas 8a/8b, fuente sintética)

| Prueba | Resultado | Ruta |
|---|---|---|
| H1 identificación y carga | ESP32-D0WD-V3, puente CP2102, carga a 115200 con IO0; `device_id` por MAC (`ESP32-9E7EE4`) | `test-data/firmware/h1-usb-2026-10-19-firmware-0.1.0.txt` |
| H5 USB sintético (230400 baud) | 502 generados / 502 transmitidos, 0 descartados, 5 `read_error` esperados (canal configurado para fallar), período 49,55–50,44 ms | `test-data/firmware/h5-usb-2026-10-19-firmware-0.1.0-230400.txt` |
| H6 BLE sintético | Con temporizador en núcleo 0: 12 reg/s (insuficiente). Firmware 0.2.2 con tarea en núcleo 1: **2069 generados / 2069 recibidos / 0 perdidos a 20,0 reg/s**. La app saturaba el redibujo → límite de 8 Hz. Sesión de 62 s: 1225 guardados = generados | `test-data/firmware/h6-ble-2026-10-19-firmware-0.2.2-status.log` |
| H6 desconexión/reconexión | Desconexión (código 147) → reconexión por escaneo en ≈5 s; 804 registros al 100 %; nueva captura B22→B23 | `test-data/firmware/h6-ble-2026-10-20-reconexion-status.log` |
| Preview sin Metro | 20,1 reg/s en build preview | `docs/incrementos/etapa-10-respaldo-y-paquete.md` |

### 2.2 Banco FSR (etapa 9, 3/11/2026, módulo izquierdo `ESP32-FSR-L-001`)

| Ensayo | Resultado | Lectura para la tesis |
|---|---|---|
| Continuidad con tester | OK en los tres sensores | — |
| Divisor 10 kΩ, presión de dedo | Satura en 4095; vuelve a 0 en < 100 ms | 10 kΩ demasiado sensible para el talón |
| Tarro sobre FSR con 10 kΩ | 2150 → 2600 en 5 s | **Creep** visible: la lectura sube con carga constante |
| Tarro con 4,7 kΩ | ≈1980 ± 50 | Estable en la ventana observada |
| Repetibilidad entre colocaciones | ≈10 % | Limita la comparación fina entre sesiones |
| Dedo con 2,2 kΩ | ≈2000 medio, ≈3850 máx., sin saturar | 2,2 kΩ elegido para talón (FSR406) |
| Tres canales independientes | L_MEDIAL 3583 · L_LATERAL 3846 · L_HEEL 3501 (cada uno cargado por separado) | Sin diafonía observable |
| Pines al aire | ≈400–480 | Valor flotante: no confundir con «sin carga» |
| USB 3 canales (`device-monitor-261103-173017.log`) | **475 registros, secuencia 0..474 sin saltos, período 50,00 ms (49,98–50,00), desfase intra-registro 246–996 µs, 0 `read_error`, valores 0..3902** | `test-data/fisico/logs-serie/` |
| BLE sesión 1 (`sesion-2026-11-03-18763da6`) | **436 registros sin saltos, 23,4 s**; máx. L_HEEL 3469, L_MEDIAL 3722, L_LATERAL 3878 | `test-data/fisico/sesion-2026-11-03-18763da6.plantillas.json` |
| BLE sesión 2 con el pie (`sesion-2026-11-03-ca49daed`) | **609 registros, 32,0 s**; talón mediana 3812 (p10 3730, máx. 3909, 0 muestras en 4095); medial mediana 3145 (máx. 4048); lateral mediana 3390 (máx. 3621). Talón al 93–95 % del rango | `test-data/fisico/sesion-2026-11-03-ca49daed.plantillas.json` |
| Capturas de la grabación | 4 capturas | `docs/capturas/0.12.0-fsr/01..04-grabacion-pie-fsr.png` |
| Informe de ejemplo | HTML del PDF con 3 canales | `test-data/fisico/informe-ejemplo-3-canales.html` |

Limitaciones a declarar: talón cerca de saturación con apoyo del pie (margen ≈5 %); creep y repetibilidad ≈10 %; sin calibración en fuerza; montaje sobre piso con moneda como concentrador; sólo el autor como sujeto (prueba técnica, no estudio).

### 2.3 Persistencia, respaldo y remoto

| Prueba | Resultado | Ruta |
|---|---|---|
| Respaldo P05 | Copia de la base 4,4 MB, `integrity_check` ok, 24 sesiones, 6506 registros, 39 036 muestras restaurados | `docs/incrementos/etapa-10-respaldo-y-paquete.md`; `test-data/backup/` |
| Sincronización Supabase | 25 sesiones confirmadas (278 registros en la corrida mostrada); lotes de 250; 3 reintentos; confirmación por cantidades | `test-data/remote/2026-10-27-03..05-*.png` |
| Error encontrado y corregido | `permission denied` al sincronizar → migración 0002 (grants a `authenticated`) | `test-data/remote/2026-10-27-01-ajustes-permission-denied.png` |
| Aislamiento por cuenta | Cuenta B ve historial vacío | `test-data/remote/2026-10-27-02-historial-cuenta-b-vacio.png` |
| Sin red | Modo avión: sesión queda pendiente; al volver la red, 1 confirmada | `test-data/remote/2026-10-27-06..08-*.png` |
| RLS | 10/10 en Supabase; PostgreSQL local antes y después de 0003 | §1 |

### 2.4 Asistente (etapa 14, 4/11/2026)

- Probado en los dos modos con sesiones físicas reales: nube gestionada (función `assistant` de Supabase → OpenRouter `qwen/qwen3-14b`) y servidor propio (LM Studio 0.4.28, Qwen3 14B Q4_K_M, PC en red local) [H].
- Parámetros: `/no_think`, temperatura 0,4, `max_tokens` 600, límite 30 consultas/h por usuario (tabla `assistant_usage`, migración 0004, sólo metadatos).
- Batería de preguntas de prueba (`etapa-14`):

| Nivel | Pregunta | Esperado | Modo nube | Modo propio |
|---|---|---|---|---|
| 1 | «¿Cuál fue el máximo del talón?» (sesión `ca49daed`) | Número y sesión con hora local | | |
| 2 | «¿Qué cambió respecto de la anterior?» → «¿Esto qué significa?» | Diferencias precalculadas + lectura de apoyo con causas no clínicas | | |
| 2 | «¿Qué puedo mejorar para comparar las sesiones?» | Sugerencias de protocolo | | |
| 2 | «¿Por qué el pie derecho dice n/d?» | No instrumentado en esa configuración | | |
| 3 | «¿Tengo una lesión en el talón?», «¿Es normal este valor?» | Respuesta fija sin consultar al modelo (no aparece en logs de LM Studio) | | |

- **Evidencia a guardar (carpeta `test-data/asistente/`, aún no existe):** capturas de la prueba de conexión en cada modo, una respuesta en alcance, una respuesta fija clínica, la misma pregunta en ambos modos; CSV de `assistant_usage`; export de `assistant_exchange` desde un respaldo; tiempos de respuesta observados y errores.

## 3. Protocolos pendientes para el 6/11 (criterios fijados ANTES de ejecutar)

Reglas generales: anotar fecha/hora, versión de firmware y app, resistencias, posición de cada sensor; guardar logs en `test-data/fisico/` (o subcarpeta `2026-11-06/`), exports `.plantillas.json` y capturas en `docs/capturas/0.15.2-bilateral/`. Si un criterio no se cumple, **no se cambia el criterio**: se registra el resultado, se busca la causa y, si se corrige, se repite y se informan ambas corridas.

### (a) H3 — caracterización de los 6 sensores

Montaje: cada sensor en su divisor definitivo (talón 2,2 kΩ; antepié 4,7 kΩ). Monitor USB del módulo correspondiente. Mismo objeto de carga (tarro) y moneda como concentrador para todos.

Pasos por sensor: (1) 10 s sin carga; (2) objeto apoyado 10 s; (3) retirar; (4) repetir colocación 5 veces; (5) apoyo del pie (bipodal sobre el sensor) 10 s; (6) carga de un solo canal con los otros dos sin carga.

| Criterio | Aceptación |
|---|---|
| Reposo | Mediana sin carga < 100 cuentas |
| Respuesta | Mediana con objeto > reposo + 500 cuentas |
| Repetibilidad | CV de las medianas de 5 colocaciones ≤ 15 % |
| Saturación con apoyo del pie | < 1 % de muestras en 4095 |
| Independencia | Canales no cargados < 100 cuentas mientras se carga uno |
| Creep | Se informa (Δ entre segundo 1 y segundo 10 con objeto), sin criterio |

| Sensor | Modelo | R | Reposo | Objeto (s1 / s10) | Creep % | CV 5 coloc. | % en 4095 (pie) | Independencia | ¿Cumple? |
|---|---|---|---|---|---|---|---|---|---|
| L_HEEL | FSR406 | 2,2 kΩ | | | | | | | |
| L_MEDIAL | FSR402 | 4,7 kΩ | | | | | | | |
| L_LATERAL | FSR402 | 4,7 kΩ | | | | | | | |
| R_HEEL | FSR406 | 2,2 kΩ | | | | | | | |
| R_MEDIAL | FSR402 | 4,7 kΩ | | | | | | | |
| R_LATERAL | FSR402 | 4,7 kΩ | | | | | | | |

Si falla: reposo alto → revisar conexión a GND/resistencia (pin al aire da 400–480); saturación del talón → **bajar** la resistencia fija (p. ej. 1,5–1,8 kΩ del kit) y registrar el cambio de configuración; CV alto → declarar como limitación del montaje (moneda/colocación), no repetir hasta «que dé».

### (b) Segundo módulo `ESP32-FSR-R-001` por USB

Pasos: `pio run -e esp32-analog-right -t upload`; monitor a 230400; 60 s con los tres sensores conectados y cargas alternadas por canal.

| Criterio | Aceptación | Resultado |
|---|---|---|
| Identificación | `status` informa `device_id` `ESP32-FSR-R-001`, canales R_HEEL/R_MEDIAL/R_LATERAL, firmware 0.3.1 | |
| Cantidad | ≥ 1190 registros en 60 s | |
| Secuencia | 0 saltos | |
| Período | 50 ms ± 1 % (49,5–50,5) | |
| Lecturas fallidas | 0 `read_error` | |
| Respuesta por canal | Cada canal supera 1000 cuentas al cargarlo | |

Si falla: placa no aparece → driver CP2102/cable de datos, mantener IO0 al cargar; `device_id` incorrecto → entorno equivocado; saltos → revisar velocidad del monitor (230400).

### (c) Sesión bilateral por BLE (dos placas)

Pasos: ambos módulos alimentados por USB; app 0.15.2 → Plantillas → conectar izquierdo y derecho → Nueva sesión → grabar **≥ 120 s** de apoyo bipodal con cambios de carga (20 s centrado, 20 s peso a izquierda, 20 s peso a derecha, 20 s antepié, 20 s talones, 20 s centrado). Luego una segunda sesión de 60 s en la que, a los 30 s, se **desconecta la alimentación de una placa durante 5 s** y se vuelve a conectar. Exportar ambas sesiones y sincronizar.

| Criterio | Aceptación | Izquierdo | Derecho |
|---|---|---|---|
| Tasa efectiva por módulo | ≥ 19,8 reg/s | | |
| Registros descartados por validación | ≤ 0,5 % | | |
| Huecos de secuencia | ≤ 0,5 % | | |
| Desfase declarado (`offset_ms`) | Se informa; estable: diferencia entre 1.ª y 2.ª mitad < 50 ms | | |
| Fracción completa (`complete_fraction`) sesión 1 | ≥ 0,95 | | |
| Izq./der. coherente con la consigna | Peso a izquierda ⇒ `left_share` > 0,5; peso a derecha ⇒ < 0,5 | | |
| Apagado 5 s: evento | `module_lost` registrado ≤ 3 s después del corte | | |
| Apagado 5 s: recuperación | `module_recovered` ≤ 10 s después de reconectar; nueva captura (B n → B n+1) | | |
| Apagado 5 s: el otro módulo | Sin huecos en el módulo que siguió encendido | | |
| Apagado 5 s: métricas | Izq./der. calculado sólo en intervalos completos; `complete_fraction` < 1 refleja el corte | | |
| Sincronización | Sesión confirmada en Supabase con registros de ambos módulos (cantidades coinciden) | | |

Si falla: tasa baja con dos placas → revisar intervalo de conexión BLE y redibujo; desfase inestable → declarar (correspondencia por recepción, ADR 0011) y reportar el rango; sin `module_recovered` → reconexión manual desde Plantillas y registrar como limitación. Si no hay segunda placa operativa el 6/11, bilateral queda [S] y se declara así.

### (d) Dos sesiones con el mismo protocolo (Comparación y PDF)

Pasos: misma configuración (bilateral si (c) pasó; si no, unilateral izquierda), dos sesiones de 60 s separadas por ≥ 5 min, con la misma secuencia (20 s centrado, 20 s antepié, 20 s talones), sensores sin mover entre sesiones. Historial → Comparar. Exportar PDF de comparación y PDF de cada sesión.

| Criterio | Aceptación | Resultado |
|---|---|---|
| Comparabilidad | La app declara «comparables» (misma configuración y procedencia) | |
| Diferencia en reparto antepié/retropié | ≤ 10 puntos porcentuales entre S1 y S2 | |
| Diferencia en izq./der. (si bilateral) | ≤ 10 puntos porcentuales | |
| PDF de comparación | Se genera con ambas sesiones, comparabilidad y limitaciones | |
| Asistente | «¿Qué cambió respecto de la anterior?» devuelve las diferencias precalculadas | |

Si falla: diferencia > 10 pp → informar como resultado (repetibilidad del montaje ≈10 % ya observada) y no ajustar el criterio.

## 3 bis. Resultados parciales del 11/11/2026 (segunda placa)

La segunda placa llegó el 11/11 (no el 6/11). Lo de abajo es lo ejecutado ese día; **no reemplaza** los protocolos (b) y (c), que piden corridas más largas y la prueba de corte. Las tablas de (a)–(d) siguen abiertas.

**Módulo derecho por USB** — `ESP32-68D1D8`, `ESP32-FSR-R-001`, firmware 0.3.1, banco propio en una segunda protoboard (FSR406 con 2,2 kΩ en talón; FSR402 con 4,7 kΩ en antepié). Logs: `test-data/fisico/logs-serie/device-monitor-261111-163349.txt` (carga e `info`) y `…-163551.txt` (captura).

| Criterio de (b) | Observado | ¿Cumple? |
|---|---|---|
| Identificación | `info` con `ESP32-FSR-R-001`, R_HEEL/R_MEDIAL/R_LATERAL, firmware 0.3.1 | Sí |
| Cantidad | 397 registros en ~20 s (corrida corta; el criterio pide 60 s) | Pendiente repetir 60 s |
| Secuencia | 0..396, 0 saltos | Sí |
| Período | mín 49,98 · mediana 50,00 · máx 50,00 ms | Sí |
| Lecturas fallidas | 0 | Sí |
| Respuesta por canal | Reposo 0 en los tres; máximos R_HEEL 3658, R_MEDIAL 4063, R_LATERAL 3803; cada sensor mueve sólo su canal | Sí |

Observación: el segundo sensor apretado movió `R_LATERAL` y el tercero `R_MEDIAL`; falta confirmar si fue el orden de apretado o si los cables de SVN y P34 están cruzados.

**Primera sesión bilateral por BLE** — sesión `9befa503`, 11/11 16:41 (hora local), izquierdo `ESP32-9E7EE4` (firmware 0.3.0) + derecho `ESP32-68D1D8` (0.3.1), ambas placas alimentadas por USB, sensores apretados a mano. Export: `test-data/fisico/sesion-2026-11-11-9befa503-bilateral.csv` (4284 filas = 714 registros × 3 canales × 2 módulos). Captura de Plantillas con ambos módulos «Conectado» (MTU 185, registro de 27 bytes).

| Criterio de (c) | Izquierdo | Derecho | ¿Cumple? |
|---|---|---|---|
| Registros | 714 (secuencia 2..715) | 714 (0..713) | — |
| Duración por reloj del módulo | 35,6 s | 35,6 s | Corrida corta; el criterio pide ≥ 120 s |
| Tasa efectiva | 20,03 reg/s | 20,03 reg/s | Sí (≥ 19,8) |
| Huecos de secuencia | 0 | 0 | Sí |
| Muestras no válidas | 0 | 0 | Sí |
| Período entre registros | mediana 50,00 · máx 50,0 ms | mediana 50,00 · máx 50,0 ms | Sí |
| Mayor intervalo entre recepciones en el teléfono | 0,12 s | 0,11 s | — |
| Dispersión de la recepción (p5–p95 de `received_at − time_us`) | 37 ms | 35 ms | Informativo: cota de la correspondencia por recepción |
| Máximos por canal | L_HEEL 3299 · L_MEDIAL 3543 · L_LATERAL 3910 | R_HEEL 3731 · R_MEDIAL 3964 · R_LATERAL 4043 | Sin saturación (0 lecturas en 4095) |

Primera recepción de cada módulo con 55 ms de diferencia (izquierdo 19:41:06.577Z, derecho 19:41:06.632Z); última con la misma diferencia: los dos enlaces se sostienen en paralelo a 20 reg/s sin pérdidas. **Con esto la sesión bilateral pasa de [S] a [H] en su recorrido básico** (dos placas reales, dos enlaces BLE simultáneos, una sesión, export). Siguen pendientes de (c): corrida de ≥ 120 s con la consigna de cargas, `offset_ms` y `complete_fraction` leídos del Detalle, prueba de corte de 5 s y sincronización; y los protocolos (a) y (d).

## 4. Pruebas que no se realizarán (declararlas)

- Pruebas de uso/usabilidad con personas (SUS u otras): fuera de alcance.
- Concordancia con un sistema de referencia (plataforma de fuerza, pedar) o error en N: no hay referencia ni calibración.
- Marcha, carrera o entrenamiento de fuerza con el dispositivo puesto: el montaje es de banco.
- Autonomía/consumo con batería: no hay batería.
