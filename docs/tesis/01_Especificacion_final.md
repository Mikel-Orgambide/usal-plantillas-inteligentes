# 01 — Especificación final del prototipo (alcance congelado al 5/11/2026)

- Versión de la app: 0.15.3 · firmware 0.3.1 (placa derecha; la izquierda quedó con 0.3.0) · actualizado el 11/11/2026 con la validación con dos placas · esquema local SQLite v8 · migraciones remotas 0001–0005 (0005 preparada, transferencia no implementada).
- Fuente técnica de verdad: `docs/especificacion/08_Alcance_Final_del_Prototipo.md`. Este archivo la reorganiza como especificación (objetivos → requisitos → evidencia) para los caps. 1, 4 y 7.
- Estados: **[H]** hardware · **[S]** simulación/pruebas automáticas · **[D]** diseñado · **[F]** futuro (ver `00_LEEME.md`).

## 1. Alcance congelado

| Dimensión | Decisión al 5/11/2026 | Origen |
|---|---|---|
| Montaje | **Banco en protoboard** (MJ 830 puntos, una protoboard por módulo), sensores sobre el piso, apoyo estático del pie. Sin plantilla dentro del calzado, sin cableado al cuerpo, sin autonomía con batería | Decisión del autor 3/11 (`etapa-09-fuente-fisica.md`) |
| Topología | **Dos módulos ESP32, uno por pie**: `ESP32-FSR-L-001` (izquierdo, placa `ESP32-9E7EE4`, [H]) y `ESP32-FSR-R-001` (derecho, placa `ESP32-68D1D8`, [H] desde el 11/11); ambos construidos y probados juntos por BLE | ADR 0011 |
| Sensores | 3 por pie: FSR406 talón (divisor 2,2 kΩ), FSR402 antepié medial y lateral (4,7 kΩ). ADC 12 bits del ESP32, cuentas 0–4095 | Etapa 9 |
| Tasa | 20 registros/s por módulo (período 50 ms), registro con 3 muestras | Firmware 0.3.1 |
| Transporte | BLE GATT (NimBLE) hacia la app; USB JSON por línea (230400 baud) para diagnóstico en PC | ADR 0006 |
| Magnitud | Cuentas ADC sin calibración. No fuerza, no presión | ADR/etapa 9 |
| Validación con personas | **No hay pruebas de uso con personas** (ni usabilidad, ni marcha, ni carrera). Las sesiones físicas son del autor en banco, como prueba técnica | Decisión del autor |
| Relevamiento | **Entrevista a un traumatólogo de rodilla** (guía de 8 preguntas) y **encuesta breve** (7 preguntas) como relevamiento de necesidades y validación de la propuesta; no como validación clínica | Cierre 27/10 (Drive) |
| Asistente | Explicativo con LLM (Qwen3 14B) por OpenRouter vía función de Supabase o LM Studio local; no diagnostica | ADR 0012 |
| Entrenamiento | Registro declarado de rutinas/series/RPE vinculado a sesiones; no medido | ADR 0013 |
| Fecha de entrega | 17/11/2026 (PDF + sistema + defensa) | Clase 13 |

## 2. Objetivo general propuesto (alineado a lo implementado)

> Diseñar e implementar un prototipo funcional de plataforma wearable basada en sensores plantares, compuesto por módulos de adquisición con ESP32 y sensores resistivos de fuerza, una aplicación móvil y servicios remotos, capaz de adquirir, transmitir de forma inalámbrica, validar, almacenar, procesar, visualizar y comparar lecturas plantares organizadas en sesiones, para demostrar la viabilidad tecnológica de convertir la interacción pie–suelo en información wearable consultable durante y entre sesiones.

Notas para la redacción:
- Cambia respecto de la Entrega 5: se quita «par de plantillas integrable debajo de plantillas convencionales» y «marcha controlada»; se reemplaza por «módulos de adquisición» y «sesiones» (banco).
- «Wearable» se sostiene como paradigma (sesión, historial, tendencias), no como forma física final: aclarar en alcance que el montaje es de banco.

## 3. Objetivos específicos propuestos

| # | Objetivo específico | Qué lo cumple en el prototipo | Estado | Evidencia |
|---|---|---|---|---|
| OE1 | Relevar el estado del arte de plantillas instrumentadas, wearables deportivos y métricas plantares, y las necesidades de usuarios y profesionales | Cap. 3 (base bibliográfica de 50 refs); entrevista a traumatólogo; encuesta | Literatura: hecho; entrevista/encuesta: **pendiente de realizar/registrar** | Drive: Base bibliográfica; Cierre 27/10 |
| OE2 | Diseñar e implementar un módulo de adquisición con ESP32 y tres FSR por pie, con muestreo periódico e identificación de cada registro | Firmware 0.3.1 `esp32-analog` / `esp32-analog-right`; contrato v1.0 | [H] izquierdo (3/11) y derecho (11/11: 397 registros USB, 0 saltos, 50,00 ms, 0 errores) | `etapa-09`, `test-data/fisico/logs-serie/` |
| OE3 | Definir un contrato de datos y un protocolo de transmisión inalámbrica que permita detectar pérdidas y reconstruir la secuencia | Contrato v1.0 (C01–C12), BLE GATT registro binario 9+6n bytes, `sequence`, `time_us`, `read_error` | [H] | `packages/contract`, ADR 0006, `etapa-08b` |
| OE4 | Implementar una aplicación móvil que reciba, valide, visualice en tiempo real y almacene localmente las sesiones de uno o dos módulos | App Expo 0.15.3; SQLite; sesión unilateral y bilateral | [H] unilateral (3/11) y bilateral con dos placas (11/11: `9befa503`, `2523ea01`) | `etapa-08b`, `etapa-09`, `etapa-13` |
| OE5 | Calcular indicadores descriptivos versionados y de calidad de señal, y comparar sesiones compatibles | `desc-1.0`, `dist-1.0`, `bilateral-1.0`; comparabilidad | [H] desc/dist/comparación unilateral; [H] `bilateral-1.0` en tramos completos (11/11); [H] comparación entre sesiones bilaterales (13/11) | `packages/metrics` (29 pruebas), sesiones `test-data/fisico/` |
| OE6 | Conservar el historial con respaldo local y copia remota protegida por titular | Respaldo/restauración; Supabase con RLS | [H] | `etapa-10`, `etapa-11`, `test-data/remote/` |
| OE7 | Generar un informe exportable para revisión profesional | PDF de sesión y comparación; CSV | [H] PDF; [S] CSV | ADR 0010, `etapa-12` |
| OE8 | Incorporar un asistente explicativo acotado que traduzca los indicadores sin emitir diagnósticos | Asistente ADR 0012 (dos modos, tres niveles) | [H] (4/11, sesiones físicas) | `etapa-14`; registro local; `test-data/asistente/` **a crear** |
| OE9 | Registrar el entrenamiento declarado (rutinas, series, RPE) y vincularlo con las sesiones medidas | Paquete training, ADR 0013 | [S] (pruebas automáticas) + uso en teléfono 0.15.1 | `etapa-15`, 15 pruebas |
| OE10 | Evaluar técnicamente el prototipo (integridad, tasa efectiva, saturación, repetibilidad, pérdida y reconexión) | Pruebas H1–H6, banco FSR, pruebas automáticas (201) | [H]/[S]; con dos placas el 11/11 (`04` §3 bis); sesión de 90 s, comparación y sincronización bilaterales el 13/11 (`04` §3 ter); no ejecutados: sesión ≥ 120 s con consigna de cargas, H3 por sensor (`04` §3 quater) | `04_Evidencia_y_pruebas.md` |

Hipótesis (para reemplazar la de la Entrega 5): proponer una hipótesis tecnológica verificable, p. ej.: *«Es posible adquirir lecturas de tres FSR por pie con módulos ESP32 a 20 registros/s, transmitirlas por BLE a un teléfono sin pérdida de registros en condiciones de banco, y convertirlas en sesiones con indicadores descriptivos comparables entre sesiones.»* Se verifica con H5/H6/etapa 9 (unilateral) y, para el bilateral, con las sesiones del 11/11 (714 registros por módulo a 20,03 reg/s sin huecos; corte y recuperación de un módulo), en corridas cortas de banco: falta la corrida de ≥ 120 s y la comparación entre dos sesiones bilaterales. No formular hipótesis sobre rendimiento, fatiga o lesiones.

## 4. Requisitos funcionales

| ID | Requisito | Estado | Evidencia (ruta) |
|---|---|---|---|
| RF-01 | Adquirir lecturas de 3 FSR por módulo con ADC de 12 bits a período fijo (50 ms) y numerar cada registro (`sequence`) | [H] | `test-data/fisico/logs-serie/` (475 registros 0..474, 50,00 ms); `etapa-09` |
| RF-02 | Marcar lecturas fallidas como `read_error` (nunca cero por ausencia) | [H] (sintético: 5 read_error esperados en H5) | `test-data/firmware/h5-usb-2026-10-19-firmware-0.1.0-230400.txt` |
| RF-03 | Transmitir por USB (JSON por línea) para diagnóstico | [H] | `test-data/firmware/h1-…`, `h5-…`; logs de serie etapa 9 |
| RF-04 | Anunciarse por BLE con identificación del dispositivo, configuración y canales; notificar registros binarios | [H] | `etapa-08b`; `test-data/firmware/h6-ble-*.log`; pruebas `packages/ble` (20) |
| RF-05 | Buscar y conectar uno o dos módulos desde la app (una fila por pie, estado por módulo) | [H] uno y dos (11/11: dos enlaces simultáneos, MTU 185) | Pantalla Plantillas; `etapa-13`; pruebas «two boards»; `04` §3 bis |
| RF-06 | Detectar desconexión, reconectar automáticamente y registrar el evento; reiniciar la captura en el módulo | [H] (reconexión en 5 s, B22→B23) | `test-data/firmware/h6-ble-2026-10-20-reconexion-status.log` |
| RF-07 | Validar cada registro contra el contrato v1.0 (C01–C12) y descartar inválidos con motivo | [H]/[S] | `packages/contract` (25 pruebas) |
| RF-08 | Preparar una sesión (actividad, contexto, rutina opcional) y grabarla con gráfico en vivo, calidad y siluetas | [H] | `docs/capturas/0.12.0-fsr/01..04-grabacion-pie-fsr.png` |
| RF-09 | Sesión bilateral: correspondencia por instante de recepción, desfase declarado, intervalos completos, `module_lost/recovered` | [H] (11/11: `9befa503` y corte `2523ea01`; pérdida detectada a ≈ 4,5 s, no ≤ 3 s) · [S] deriva de reloj y fallas simuladas | `etapa-13`; pruebas `packages/session` bilateral ×7; `test-data/remote/check-bilateral-2026-11-04.txt` |
| RF-10 | Persistir localmente sesiones, capturas, registros, eventos y resultados (SQLite con migraciones) | [H] | `packages/storage` (29 pruebas); `etapa-10` (.db 4,4 MB integrity ok) |
| RF-11 | Calcular descriptores por posición `desc-1.0` (media, máx., desvío, válidas/inválidas) | [H] | `packages/metrics`; sesiones `test-data/fisico/*.plantillas.json` |
| RF-12 | Calcular reparto antepié/retropié, variabilidad, izq./der. y asimetría por zona `dist-1.0` (izq./der. sólo con ambos pies) | [H] antepié/talón · [H] izq./der. en tramos completos (11/11, `2523ea01`: 60,4 / 39,6 %, sensores apretados a mano) | `packages/metrics/src/distribution.ts` |
| RF-13 | Calcular calidad: esperados/recibidos, huecos, lecturas fallidas, desconexiones, tasa efectiva, por módulo | [H] (dos módulos, 11/11; la tasa se calcula por captura desde 0.15.3) | Detalle de sesión; PDF `test-data/fisico/informe-2026-11-11-2523ea01-bilateral-corte.pdf` |
| RF-14 | Mostrar Hoy (día navegable, indicadores, entrenamiento, sesiones) e Historial por día | [H] | `03_Funcionalidades_por_pantalla.md` |
| RF-15 | Comparar dos sesiones compatibles (misma configuración y procedencia) con diferencias por posición y reparto; bloquear las no comparables | [H] unilateral (dos sesiones físicas 3/11) · [H] entre sesiones bilaterales (13/11: `f66ec0f5` y `d3367518`) | `packages/metrics` compare/comparability (U03) |
| RF-16 | Exportar informe PDF de sesión y de comparación para revisión profesional | [H] sesión unilateral y bilateral (11/11) y comparación unilateral · [H] PDF de comparación bilateral (13/11, `test-data/fisico/informe-comparacion-2026-11-13-*.pdf`) | ADR 0010; `etapa-12`; `test-data/fisico/informe-ejemplo-3-canales.html` |
| RF-17 | Exportar CSV por muestra y paquete de sesión `.plantillas.json` | [H] CSV (sesiones bilaterales del 11/11 y 13/11) · [H] paquete | `packages/report` (9 pruebas); `test-data/fisico/*.plantillas.json` |
| RF-18 | Respaldo completo y restauración desde archivo | [H] | `etapa-10`; `test-data/backup/sesion-2026-10-20-977b2add.plantillas.json` |
| RF-19 | Modo de demostración con fuente simulada determinista, marcada `simulated` | [H]/[S] | Ajustes → Demostración; `packages/simulator` (16) |
| RF-20 | Cuenta de usuario y sincronización de sesiones cerradas con confirmación por cantidades | [H] unilateral · [H] bilateral (13/11: dos sesiones de dos placas en Supabase con cantidades coincidentes, `test-data/remote/2026-11-13-*.png`) | `etapa-11`; `test-data/remote/2026-10-27-0*.png`, `remote-check-2026-10-27-supabase.txt` |
| RF-21 | Asistente explicativo en dos modos (nube gestionada / servidor propio) con rechazo fijo de consultas clínicas | [H] | `etapa-14`; ADR 0012 |
| RF-22 | Carga asistida de series por lenguaje natural con tarjeta de confirmación | [S] | `packages/assistant` (30), `packages/training` (parsing) |
| RF-23 | Rutinas (propias o del profesional), entrenamiento con series (reps, peso, RPE, nota), caminata/tiempo, descanso, vínculo con sesión | [S] + uso en teléfono 0.15.1 | `etapa-15`; `packages/training` (15) |
| RF-24 | Sincronizar rutinas y entrenamientos | [D] (esquema 0005) | `supabase/migrations/0005_training.sql` |

## 5. Requisitos no funcionales

| ID | Requisito | Criterio | Estado | Evidencia |
|---|---|---|---|---|
| RNF-01 | Tasa de adquisición estable | 20 reg/s ± 1 % por módulo | [H] USB (50,00 ms; 49,98–50,00) y BLE sintético (20,0 reg/s, 2069/2069) | `etapa-08b`, `etapa-09` |
| RNF-02 | Integridad de la secuencia | 0 saltos de `sequence` en banco | [H] (475/475 USB; 436 y 609 BLE sin saltos) | `test-data/fisico/` |
| RNF-03 | Funcionamiento sin conexión (local-first) | Grabar, consultar, exportar sin red; sincronizar al volver | [H] (modo avión) | `test-data/remote/2026-10-27-06..08-*.png` |
| RNF-04 | Seguridad de datos remotos | RLS por titular; un usuario no ve datos de otro | [H] | `remote-check-2026-10-27-supabase.txt` (10/10), `check-rls-*.txt` |
| RNF-05 | Secretos fuera del repositorio | Clave del proveedor LLM sólo como secreto de la función; `.env` fuera de git; `.env.example` con nombres | [H] | `.gitignore`, `apps/mobile/.env.example`, `supabase/functions/.env.example` |
| RNF-06 | Trazabilidad de métricas | Cada resultado lleva versión (`desc-1.0`, `dist-1.0`, `bilateral-1.0`) | [H] | `packages/metrics` |
| RNF-07 | Procedencia explícita | `physical`/`simulated` en cada captura; informe lo declara | [H] | Contrato; PDF |
| RNF-08 | Fluidez de la interfaz en grabación | Redibujo limitado a 8 Hz sin perder registros | [H] | `etapa-08b` |
| RNF-09 | Reproducibilidad del software | Pruebas automáticas deterministas; 201 pruebas en verde; typecheck | [S] | `npm test`, `04_Evidencia_y_pruebas.md` |
| RNF-10 | Costo de operación acotado | Servicios en planes gratuitos; LLM por uso con límite (30 consultas/h por usuario) | [H] | Tesis, capítulo 5 |
| RNF-11 | Prudencia en la comunicación | Ninguna pantalla, informe ni respuesta del asistente presenta fuerza, presión, fatiga o diagnóstico; respuestas IA marcadas «Generado por IA · revisar» | [H] (revisión de textos) | ADR 0010, 0012 |
| RNF-12 | Desfase entre módulos declarado | `offset_ms` informado; correspondencia por recepción | [H] declarado con dos placas (125 ms en `2523ea01`; primera recepción con 55 ms de diferencia en `9befa503`) · [S] exactitud de la estimación (simulado 700 ms + deriva 1 %: −760..−650 ms); sin contraste con una referencia externa | `etapa-13` |
| RNF-14 | Detección de la pérdida de un módulo | `module_lost` registrado ≤ 3 s después del corte (criterio fijado en `04` §3) | **No cumplido**: ≈ 4,5 s el 11/11 (tiempo de supervisión del enlace BLE); se declara | `04` §3 bis; `09` |
| RNF-13 | Instalación reproducible | README con inicio rápido de 15 min | [D]→ verificar con persona externa | `README.md` |

## 6. Qué NO hace el prototipo (escribirlo explícitamente)

- No mide fuerza ni presión: las salidas son cuentas ADC sin calibración. No hay mapa continuo de presión ni fuerza total.
- No detecta fatiga, riesgo de lesión ni rendimiento; no hace diagnóstico ni reemplaza equipamiento clínico o profesionales.
- No está integrado en el calzado ni es autónomo (sin batería, sin carcasa); no se probó en marcha, carrera ni entrenamiento real.
- No se validó con usuarios (sin pruebas de usabilidad ni de aceptación con personas; sin SUS).
- No sincroniza rutinas ni entrenamientos (esquema preparado, transferencia no implementada).
- No calibra ni compensa el creep/histéresis de los FSR; no corrige el desfase entre módulos (sólo lo declara).
- No detecta pasos, fases de la marcha ni eventos de contacto (no hay IMU ni algoritmo de pasos).
- El asistente no entrena ni ajusta modelos, no consulta la base con herramientas, no hace streaming y no decide la validez de las mediciones.
- El entrenamiento es declarado: la app no verifica repeticiones, pesos ni tiempos.
- No integra con WHOOP ni otros wearables.

## 7. Supuestos

- S1. Las lecturas de un mismo sensor, montaje y resistencia son comparables entre sesiones del mismo día si se repite el protocolo (repetibilidad observada ≈10 % entre colocaciones: se declara).
- S2. El instante de recepción en el teléfono es una referencia común suficiente para alinear dos módulos a 20 reg/s (error del orden de la latencia BLE).
- S3. Los servicios gratuitos (Supabase Free, EAS Free) se mantienen disponibles hasta la defensa; el proyecto Supabase se reactiva si se pausa por inactividad (7 días).
- S4. OpenRouter mantiene el modelo `qwen/qwen3-14b`; si no, se usa LM Studio local.
- S5. La persona usuaria declara sus series y RPE de buena fe.

## 8. Restricciones

- R1. Un autor, plazo fijo (entrega 17/11/2026).
- R2. Presupuesto personal: componentes comprados en Argentina (13/10), sin ADS1115, IMU ni batería.
- R3. ADC1 del ESP32 (GPIO 36/39/34): 12 bits, no lineal en los extremos; con Wi-Fi activo no se puede usar ADC2.
- R4. `time_us` en `uint32`: desborda a los ≈71 min (límite declarado por captura).
- R5. Teléfono de prueba Android (Pixel 10 Pro XL con Protección avanzada: instalación por `adb install -r`); iOS no probado.
- R6. Servidor propio del asistente sólo en la red local (LM Studio en PC de escritorio con GPU de 12 GB).
- R7. Sin pruebas con personas: los resultados son técnicos, no de uso.
