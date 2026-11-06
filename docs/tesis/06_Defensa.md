# 06 — Defensa: demo, respaldo, checklist y preguntas del jurado

- Requisitos de la cátedra (Clase 13/14): defensa de 15 min con presentación; sistema desplegado; **ambiente de respaldo**; **video grabado la semana anterior**; datos de prueba cargados; **guion de demo de 3–4 acciones en < 4 min**; instrucciones reproducibles. Presentación: 7–8 diapositivas para ≈10 min, ≤ 4 colores, tablas ≤ 3–4 × 3–4; orden: título/autor → antecedentes → problema → justificación → objetivos → hipótesis → marco teórico → metodología → resultados → conclusiones.
- Versión a defender: app 0.15.2 (build preview instalada por `adb install -r`), firmware 0.3.1, tag `entrega-final`.

## 1. Guion de demo (≤ 4 min, 4 acciones)

| # | Acción (qué se toca) | Qué se dice (una frase) | Tiempo | Respaldo si falla |
|---|---|---|---|---|
| 1 | **Plantillas** → conectar módulo izquierdo (y derecho si el 6/11 pasó) → **Nueva sesión** → grabar 30–40 s apoyando el pie: talón, antepié, centrado | «Cada pie es un módulo ESP32 con tres sensores; la app recibe 20 registros por segundo por BLE y muestra la calidad en vivo» | 1:15 | Ajustes → Demostración → «Simulador sin plantillas» (o «Simular dos módulos») y repetir |
| 2 | Terminar → **Detalle de sesión**: calidad por módulo (esperados/recibidos, huecos), carga por posición, reparto antepié/talón (e izq./der. si bilateral) | «Son cuentas del conversor, sin calibrar: describen cómo se reparte la lectura, no fuerza ni presión» | 0:45 | Abrir una sesión física importada (`ca49daed`) |
| 3 | Menú → **Comparar** con la sesión anterior del mismo protocolo → **Exportar informe (PDF)** | «Sólo compara sesiones compatibles, y el informe declara procedencia, calidad y limitaciones para que lo revise un profesional» | 1:00 | Mostrar el PDF ya exportado (guardado en el teléfono y en la PC) |
| 4 | **Asistente** desde el Detalle: «¿Qué cambió respecto de la anterior?» y luego «¿Tengo una lesión en el talón?» | «Explica con los indicadores ya calculados; lo clínico se rechaza sin consultar al modelo» | 0:50 | Cambiar a modo servidor propio (LM Studio) o mostrar el tramo del video |

Opcional si sobra tiempo (o en preguntas): Hoy → Entrenamiento (rutina con series y descanso, isla flotante), modo avión + sincronización, desconectar una placa 5 s (reconexión).

## 2. Cómo cargar los datos de demo

| Dato | Archivo | Cómo cargarlo |
|---|---|---|
| Sesión física sin carga del pie (3 canales, 436 registros) | `test-data/fisico/sesion-2026-11-03-18763da6.plantillas.json` | Copiar al teléfono → **Ajustes → Respaldo → Por sesión → Importar sesión** (no modifica las existentes) |
| Sesión física con apoyo del pie (609 registros) | `test-data/fisico/sesion-2026-11-03-ca49daed.plantillas.json` | Ídem |
| Sesiones del 6/11 (bilateral y las dos comparables) | `test-data/fisico/…` (a guardar el 6/11) | Ídem |
| Sesión de respaldo antigua | `test-data/backup/sesion-2026-10-20-977b2add.plantillas.json` | Ídem |
| Base completa (alternativa) | Copia `.db` exportada desde el teléfono de demo | **Ajustes → Respaldo → Base completa → Restaurar una copia completa** (⚠ reemplaza todo) |
| Rutina de ejemplo | — | Crear antes: Ajustes → Rutinas → «Pierna» (Sentadilla 3 × 10 · 40 kg · descanso 60 s; Caminata 2 min; Elongación) |

Antes de la defensa: tener en el historial al menos dos sesiones comparables del mismo protocolo (las del 6/11) y una con entrenamiento vinculado.

## 3. Plan de respaldo (por capa)

| Falla | Respaldo 1 | Respaldo 2 |
|---|---|---|
| Placa/sensores/BLE no conectan | Modo simulado (Ajustes → Demostración; procedencia `simulated` visible) | Sesiones físicas importadas |
| Sin internet / Supabase pausado | La app es local-first: grabar, ver, comparar y exportar funcionan sin red | Mostrar capturas `test-data/remote/` |
| OpenRouter sin crédito o caído | Ajustes → Asistente → servidor propio (LM Studio en la PC, misma red) | Video |
| Red del lugar no permite la PC | Hotspot del teléfono con la PC conectada (LM Studio en `http://<ip-local>:1234`) | Video |
| Teléfono falla | Segundo dispositivo con la build instalada (si hay) | Video completo |
| Todo falla | **Video de la demo** (grabado antes) | Capturas en la presentación |

## 4. Checklist del día

Día anterior:
- [ ] Supabase: proyecto **Active** (no pausado); login de prueba en la app; prueba de conexión del asistente en verde.
- [ ] OpenRouter: crédito disponible y límite de la clave; una pregunta de prueba.
- [ ] LM Studio: modelo Qwen3 14B cargado; servidor en `0.0.0.0:1234`; regla de firewall «LM Studio 1234 (red local)»; prueba desde la app en modo servidor propio.
- [ ] Teléfono: build 0.15.2 instalada; batería al 100 %; «Pantalla encendida al grabar» activado; Bluetooth y ubicación permitidos; datos de demo cargados.
- [ ] Video final copiado en la notebook y en un pendrive.
- [ ] Presentación en PDF y en el formato original.
- [ ] Repo: tag `entrega-final` empujado; README probado.

Para llevar:
- [ ] Dos ESP32 (izquierdo `ESP32-FSR-L-001`, derecho `ESP32-FSR-R-001`) ya cableados en la protoboard, sensores fijados con Kapton.
- [ ] **Dos cables USB de datos** (no sólo carga) y cargador/power bank o la notebook para alimentar las placas.
- [ ] Repuestos: FSR402, resistencias 2,2 kΩ y 4,7 kΩ, cables Dupont, moneda(s) concentradoras, cinta.
- [ ] Notebook con PlatformIO (por si hay que volver a cargar firmware) y `adb`.
- [ ] Cable USB del teléfono (para `adb`).
- [ ] Tester.

En sala (10 min antes):
- [ ] Encender placas, conectar en la app, grabar 10 s de prueba y descartar.
- [ ] Abrir el asistente y hacer una pregunta en el modo elegido.
- [ ] Dejar abierta la pantalla Plantillas.

## 5. Video a grabar (semana anterior, ≈3–4 min)

1. Banco: placas, sensores, divisores (plano cenital) — 15 s.
2. Conexión de los dos módulos y sesión bilateral con cambios de carga (izq./der., antepié/talón) — 60 s.
3. Desconexión de una placa 5 s y recuperación automática — 30 s.
4. Detalle de sesión y comparación con otra sesión; PDF — 45 s.
5. Asistente: una respuesta en alcance y un rechazo clínico; mencionar los dos modos — 40 s.
6. Entrenamiento: rutina, serie, descanso, vínculo con la sesión — 30 s.
7. Modo avión y sincronización al volver la red — 20 s.

Grabar la pantalla del teléfono (`scrcpy --record` o grabación de Android) y una cámara para el banco. Guardar en Drive y en el pendrive; enlace en la presentación.

## 6. Preguntas probables del jurado (Clase 13) y datos para responder

| Pregunta | Respuesta con datos |
|---|---|
| ¿Por qué esa tecnología? | ESP32: ADC de 12 bits + BLE integrados, barato y documentado; FSR: delgados, simples, usados en plantillas de la literatura (S01 González usa 4 FSR/pie a 50 Hz). Expo/React Native: una base de código, BLE nativo con `react-native-ble-plx`, builds sin Mac. Supabase: PostgreSQL con RLS, Auth y funciones en un plan gratuito. Qwen3 14B: modelo abierto que corre local (12 GB GPU) y en la nube por OpenRouter con el mismo comportamiento |
| ¿Qué pasó con la hipótesis? | Unilateral en banco: verificada (475/475 USB; 436 y 609 BLE sin saltos; 20 reg/s). Bilateral: según el 6/11 (completar). No se planteó ni verificó nada sobre rendimiento o fatiga |
| ¿Qué está implementado y qué simulado? | Tabla de estados [H]/[S]/[D] de `01` §4: hardware real unilateral; bilateral con simulación (+ hardware si el 6/11 pasó); entrenamiento con pruebas automáticas y uso en teléfono; sincronización de rutinas sólo diseñada |
| ¿De dónde sale la tasa? | Firmware: tarea en el núcleo 1 con período fijo de 50 ms (`esp_timer`), `sequence` por registro; medido 50,00 ms (49,98–50,00) por USB y 20,0 reg/s por BLE (2069/2069). Con temporizador en el núcleo 0 daba 12 reg/s: por eso se movió |
| ¿Por qué cuentas y no kilogramos? | Sin calibración individual; el FSR tiene creep (2150→2600 en 5 s) y repetibilidad ≈10 % entre colocaciones; convertir a fuerza exige ensayos con masas y modelo por sensor (S04 Schofield) |
| ¿Cómo alinean dos relojes? | Cada módulo tiene su reloj; la referencia común es el instante de recepción en el teléfono; el origen se estima con la mediana de (recepción − `time_us`); el desfase se declara y las métricas izq./der. sólo usan intervalos con ambos módulos (ADR 0011) |
| ¿Qué no funcionó y qué harían distinto? | 12 reg/s con el temporizador en núcleo 0; redibujo saturado (→ 8 Hz); `permission denied` en Supabase (→ migración 0002); 10 kΩ saturaba; cierre de la app en Entrenamiento por orden de hooks; talón cerca de saturar. Distinto: comprar el segundo ESP32 desde el inicio, ensayar resistencias antes, planificar pruebas con personas antes |
| ¿Qué es propio y qué de terceros? | Propio: firmware, contrato, todos los paquetes, app, migraciones, función, métricas, documentación. Terceros: bibliotecas (Expo, React Native, NimBLE, ble-plx, Supabase JS), servicios (Supabase, EAS, OpenRouter), modelo Qwen3. Código generado con asistencia de IA revisado y probado por el autor (ver `08`) |
| ¿VAN? | Responder con el resultado recalculado del cap. 5 (la Entrega 5 daba VAN negativo en los tres escenarios y TIR optimista 10,03 % contra tasa real 21,15 %). Explicar qué supuestos lo harían positivo |
| ¿Qué datos se envían a terceros? | En modo nube, el contexto armado (indicadores y sesiones recientes, sin nombre) pasa por la función de Supabase a OpenRouter; la clave nunca está en el teléfono; se registra sólo metadato de uso. En modo servidor propio no sale de la red local |
| ¿Cómo evitan que el asistente diagnostique? | Tres niveles; el clínico se detecta por patrones y recibe respuesta fija sin llamar al modelo; prompt de sistema con prohibición; contexto sólo con datos precalculados; marca «Generado por IA · revisar» |
| ¿Lo probaron con usuarios? | No (decisión de alcance). Hubo entrevista a un traumatólogo de rodilla y una encuesta breve como relevamiento; las pruebas son técnicas |
| ¿Por qué no está dentro del zapato? | Decisión del 3/11: priorizar la cadena completa de datos en banco; integración mecánica, cableado y batería son evolución futura (R13) |
| ¿Quién lo mantiene? | Hoy el autor; para operación harían falta planes pagos (Supabase, EAS), actualización de dependencias y soporte |
