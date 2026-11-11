# 05 — Mapa de la tesis: qué pide la cátedra, qué conservar, qué cambiar, qué agregar

- Base comparada: **Entrega 5** (Google Doc `1GLrGXiaHG-6NORTEb3bbp1RV4nyyU4eCC9ztgaMgFPs`, título «Plantillas inteligentes: desarrollo de una plataforma wearable para el seguimiento del rendimiento físico»), escrita antes de construir el prototipo (planificación al 11/10/2026).
- Requisitos de la cátedra: Clase 13 (estructura del documento final, repositorio, día de defensa), Clase 12 (caps. 7 y 8), Clase 11 (riesgos), Clase 10 (económico), Clase 5 (IA), Clase 14 (presentación).
- Estructura final: Preliminares → Cap. 1 Presentación → Cap. 2 Metodología → Cap. 3 Síntesis de la literatura → Cap. 4 Marco tecnológico → Cap. 5 Justificación económica → Cap. 6 Riesgos → Cap. 7 Resultados → Cap. 8 Conclusiones → Bibliografía → Apéndices → Anexos.
- Problema transversal de la Entrega 5: está redactada en **futuro** («se adquirirán», «se prevé», «estados previstos») y supone **par de plantillas debajo de plantillas convencionales, marcha controlada y participantes voluntarios**. Todo eso cambia: pasar a pasado/presente para lo hecho, y a «evolución futura» lo no hecho.

---

## Preliminares

| Elemento (Clase 13) | Estado / qué hacer | Fuente |
|---|---|---|
| Portada | Título actualizado (sugerencia: mantener «Plantillas inteligentes…» pero sin prometer seguimiento del rendimiento como resultado; p. ej. «…plataforma wearable para el registro y la comparación de lecturas plantares orientada al rendimiento físico»). Autor: Mikel Orgambide Rueda; tutor/profesor; USAL; fecha | — |
| Segunda página | **Enlace al repositorio** (`https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes`, tag `entrega-final`) | Clase 13 |
| Declaración de originalidad | Redactar según modelo de la cátedra | Clase 13 |
| Agradecimientos | Opcional; incluir al traumatólogo entrevistado y a quienes respondieron la encuesta si corresponde | — |
| Resumen / Abstract + palabras clave | **Reescribir completo**. El abstract de la Entrega 5 habla de «par de plantillas integrable debajo de plantillas convencionales», «marcha controlada» y carrera/fuerza «exploratorias». Nuevo resumen: problema → prototipo (2 módulos ESP32, 3 FSR por pie, BLE, app, Supabase, asistente, entrenamiento declarado) → evaluación técnica (números de `04`) → límites (banco, sin personas, cuentas ADC) → aporte. Palabras clave: plantillas instrumentadas; sensores resistivos de fuerza; wearables; ESP32; Bluetooth Low Energy; aplicación móvil; local-first; presión plantar | `01`, `04` |
| Declaración de uso de IA | **Reescribir** con `08_Uso_de_IA.md` (la Entrega 5 sólo declara ChatGPT/Claude/Gemini para documentación) | `08` |
| Índices (general, tablas, figuras) | Generados por LaTeX | Template Norman |
| Glosario, siglas, símbolos | Tomar de `07_Glosario_y_siglas.md` | `07` |

---

## Capítulo 1 — Presentación del proyecto

| Apartado E5 | Conservar | Contradice / cambiar (concreto) | Agregar | Fuente repo |
|---|---|---|---|---|
| 1.1 Introducción | Visión wearable, paradigma WHOOP como referencia conceptual, biomecánica plantar como fuente de información | Cualquier mención a «par de plantillas» como resultado; aclarar desde el inicio que el prototipo es un **banco con dos módulos** | Un párrafo de «qué se construyó» (síntesis de `01` §1) | `01` |
| 1.2.1 Objetivo general | Estructura (diseñar e implementar + demostrar viabilidad) | Sacar «integrable debajo de plantillas convencionales» y «durante la actividad física» como algo logrado | Usar el objetivo de `01` §2 | `01` §2 |
| 1.2.2 Objetivos específicos | Los de adquisición, transmisión, almacenamiento, visualización | Los que suponen participantes, marcha, carrera/fuerza exploratorias | OE1–OE10 de `01` §3 (incluye asistente, informe PDF, entrenamiento declarado, evaluación técnica) | `01` §3 |
| 1.3 Barreras (técnicas, metodológicas, prácticas) | Casi todo: es válido (variación de sensores, calibración, integración, fatiga ≠ medición directa) | Pasar de hipotético a observado donde haya dato: creep 2150→2600 en 5 s; repetibilidad ≈10 %; saturación con 10 kΩ; 12 reg/s con temporizador en núcleo 0 | Barreras encontradas en la práctica: Protección avanzada de Android (instalación por adb, http local bloqueado en Chrome), permisos remotos (`permission denied` → migración 0002) | `04` §2 |
| 1.4 Relevancia | Conservar | — | Mencionar informe para revisión profesional y entrenamiento declarado como puentes con profesionales | ADR 0010, 0013 |
| 1.5 Hipótesis | — | Reemplazar: la E5 plantea hipótesis sobre plantillas en marcha | Hipótesis tecnológica verificable de `01` §3 | `01` |
| 1.6 Enfoque | Investigación aplicada / diseño de artefacto | — | Desarrollo incremental en 15 etapas con ADR | `docs/incrementos/`, `docs/decisiones/` |
| 1.7.1 Recursos de hardware | ESP32, FSR406/FSR402, protoboard, Dupont, resistencias | **Sacar ADS1115, MPU6050, baterías/LiPo/TP4056** (no se usaron). Pasar de 1 a **2 ESP32** | Inventario real: NodeMCU ESP32-32S (ESP32-D0WD-V3, CP2102), 2 FSR406, FSR402 (cantidad final a registrar), kit de resistencias, protoboard MJ 830, Dupont, tester Brinna HB-113A, Kapton/doble faz | `etapa-09` |
| 1.7.2 Recursos de software | — | Actualizar versiones | Expo SDK 57, React Native, TypeScript, Vitest, PlatformIO + Arduino Core, NimBLE, `react-native-ble-plx`, SQLite (`expo-sqlite`), Supabase JS, `expo-print` | ADR 0001, `02` |
| 1.7.3 Infraestructura | — | Planes reales: **Supabase Free**, **EAS Free** (la E5 dice EAS Starter USD 19/mes) | GitHub privado; LM Studio en PC local | §Cap. 5 |
| 1.7.4 Recursos de IA | — | **Gemini API inicial → reemplazar**: el asistente usa **OpenRouter `qwen/qwen3-14b`** vía función de Supabase, o **LM Studio** (Qwen3 14B Q4_K_M) local | Herramientas de IA usadas en el desarrollo (ver `08`) | ADR 0012, `08` |
| 1.7.5 Académicos | Conservar | — | Base bibliográfica de 50 refs | Drive |
| 1.7.6 Recursos humanos | — | **«Equipo de trabajo» y voluntarios → un único autor**; traumatólogo como entrevistado | — | — |
| 1.7.7 Económicos y temporales | — | Fechas reales (inicio de desarrollo 18/10; cierre funcional 4/11; entrega 17/11) | 82 commits en 10 días de actividad (al 5/11) | `git log` |

---

## Capítulo 2 — Metodología de la investigación

| Apartado E5 | Conservar | Cambiar (concreto) | Agregar | Fuente |
|---|---|---|---|---|
| 2.1 Área temática | Sí | — | — | — |
| 2.2 Planteamiento del problema | Sí | Verificar que no prometa resultados deportivos | — | — |
| 2.3.1 Delimitación funcional | Núcleo usuario→sensores→ESP32→BLE→app | — | Asistente, informe, entrenamiento declarado | `01` |
| 2.3.2 Delimitación del sensado | 3 FSR por pie, ubicaciones | «Sensores bajo plantillas convencionales» → **banco en protoboard, sensores en el piso con moneda** | Resistencias 2,2 kΩ/4,7 kΩ elegidas por ensayo | `etapa-09` |
| 2.3.3 Delimitación de actividades | — | «Marcha controlada», carrera y fuerza → **apoyo estático en banco**; actividad y entrenamiento sólo como contexto declarado | — | `01` §6 |
| 2.3.4 Participantes y pies analizados | — | «Participantes adultos» → **sin pruebas con personas**; sesiones técnicas del autor | — | `01` §1 |
| 2.3.5 Evaluación profesional | Idea de información profesional externa sin reinterpretación | Concretar: entrevista a traumatólogo de rodilla (relevamiento) + informe PDF para revisión profesional | — | ADR 0010 |
| 2.3.6 Temporal | Sí (seguimiento no prolongado) | — | — | — |
| 2.3.7 Exclusiones | **Sí, casi textual**: es coherente | — | Agregar «sin integración en calzado, sin batería, sin usuarios» | `01` §6 |
| 2.4 Marco teórico (2.4.1–2.4.10) | Contenidos útiles | Duplica cap. 3: dejar en cap. 2 sólo la definición operativa y remitir al cap. 3 | — | — |
| 2.5 Diseño de investigación | Design science (artefacto + evaluación) | Sacar «segunda etapa con voluntarios y consentimiento» | Etapas reales 0–15 y criterios de cierre | `docs/incrementos/` |
| 2.6 Indicadores | Frecuencia efectiva, integridad, repetibilidad | **Sacar «error respecto de referencia en N»** (no hay calibración) y «diferencia bilateral de fuerza» (→ reparto izq./der. en cuentas) | Indicadores reales: tasa efectiva, % huecos, `read_error`, saturación (% en 4095), creep, CV entre colocaciones, `complete_fraction`, `offset_ms`, reconexión | `04` |
| 2.7 Técnicas de recolección | Registro automático, ensayos de carga | «Observación de participantes» y «consulta al participante» → **entrevista semiestructurada (traumatólogo) y encuesta breve** | Guía de 8 preguntas y encuesta de 7 preguntas (Cierre 27/10) | Drive |
| 2.8 Instrumentos | Prototipo como instrumento | Ficha de participante, cinta métrica, masas comprobadas → no se usaron (no hay balanza ni masas certificadas) | Planilla de ensayo de banco (`04` §3), guía de entrevista, cuestionario | `04` |
| 2.9–2.11 Datos, procesamiento, análisis | Valores originales conservados, versiones de procesamiento | Ajustar a lo implementado | Contrato v1.0, métricas versionadas `desc-1.0`/`dist-1.0`/`bilateral-1.0`, comparabilidad | `02` |
| 2.13 Dirección del proyecto | Procedimientos | 2.13.2 Tiempos: tabla prevista → **agregar columna «real»** (ver abajo) | Gantt previsto vs. real | `docs/incrementos/` |
| 2.14 Declaración de IA | — | Mover/reescribir según `08` | Cómo se verificó | `08` |

Cronograma real para 2.13.2 (fechas de `docs/incrementos/`):

| Período | Previsto (E5) | Real |
|---|---|---|
| 12–18/10 | Compra, lectura inicial, app con datos simulados | Compra 13/10. 18/10: monorepo, contrato, simulador, persistencia, sesiones, pantallas, métricas, historial (etapas 0–7) |
| 19–25/10 | Ampliar sensado e integrar | 19/10: firmware H0/H1, USB H5, BLE H6 (8a/8b). 20/10: respaldo y paquete (10). 21–27/10: Supabase, auth, sincronización (11) |
| 26/10–3/11 | Ensayos técnicos y pruebas de uso | 3/11: banco FSR (9), informe PDF y marca .NSL (12). Pruebas de uso con personas: **no realizadas** (decisión de alcance) |
| 4–10/11 | Revisión y demo | 4/11: bilateral (13), asistente (14), rutinas (15). 5/11: documentación para la tesis. 11/11: llegada del segundo ESP32 y pruebas con dos módulos (estaban previstas para el 6/11); app 0.15.3 |
| 11–17/11 | Verificación final | Redacción final, LaTeX, video, tag `entrega-final` |

---

## Capítulo 3 — Síntesis de la literatura consultada

### Qué conservar / cambiar

| Apartado E5 | Acción |
|---|---|
| 3.1.1 Nacionales (N01 Caloggero 2022, N02 Lescano 2015) | Conservar (verificadas; mantener la discrepancia 91,2/91,8 % de Caloggero) |
| 3.1.2 Internacionales (S01 González 2015, S02 Khandakar 2022, S04 Schofield 2016, S05 Fuchs 2024…) | Conservar |
| 3.1.3 Productos (Moticon OpenGo, novel loadsol, novel pedar, WHOOP) | Conservar; agregar una tabla comparativa con el prototipo (sensores por pie, tecnología, frecuencia, transmisión, sincronización, almacenamiento, salida) — el prototipo: 3 FSR/pie, 20 Hz, BLE, correspondencia por recepción, SQLite + Supabase, cuentas ADC |
| 3.2.1–3.2.8 Bases teóricas | Conservar la estructura; **agregar** los temas nuevos de la tabla siguiente (BLE GATT, alineación de relojes, local-first, RLS, LLM con barreras, RPE) |
| 3.3 Marco conceptual (verificación/validación, metadatos, latencia, línea de base) | Conservar; conectar con lo implementado (procedencia, versiones, redibujo a 8 Hz) |

### Temas teóricos que habilita el código (para 3.2)

Leyenda de referencias: código de la **Base bibliográfica** de Drive (`1m5sqbWb2DttDbbTtYkx_17WiwhMqY5z0f1r0ivJ9MXA`) cuando existe; «**Candidata**» = no está en la base, **verificar antes de citar**.

| Tema | Qué del código lo justifica | Puntos a desarrollar | Referencias |
|---|---|---|---|
| Sensores resistivos de fuerza y divisor de tensión | Firmware fuente `analog`; divisor 3V3→FSR→nodo→R fija→GND; 2,2 kΩ talón / 4,7 kΩ antepié elegidos por ensayo | Principio del FSR (resistencia decrece con la fuerza, respuesta no lineal); ecuación del divisor V = 3,3·R/(R+R_FSR); elección de R vs. sensibilidad/saturación; creep, histéresis, dependencia del área y del concentrador | B02/B05 Interlink (FSR Integration Guide); S03 Sêco 2025; S04 Schofield 2016; B04 Moebs (fuerza, presión) |
| Conversión analógico-digital y saturación | ADC1 de 12 bits (GPIO 36/39/34), `adc_count` 0–4095; detección de muestras en 4095; pines al aire 400–480 | Resolución, rango, no linealidad del ADC del ESP32 en extremos, atenuación; saturación como pérdida de información; ADC2 incompatible con radio | B06 Smith (digitalización); documentación técnica Espressif (ESP32 TRM / ADC; ver doc «Referencias tecnológicas» de Drive) |
| Muestreo y temporización | Período 50 ms, `time_us` monotónico (`esp_timer`), tarea en núcleo 1, cola acotada con descarte contado; 12 reg/s → 20 reg/s al mover de núcleo | Frecuencia de muestreo vs. contenido de la señal (apoyo, contacto); jitter; separación adquisición/transmisión; planificación en tiempo real | B06 Smith; B08 Buttazzo; S01 González (50 Hz); B03 TI (frecuencia efectiva multiplexada) |
| BLE, GATT y notificaciones | Servidor GATT NimBLE; característica de medición con notificaciones; registro binario 9+6n bytes; MTU; reconexión por escaneo | Roles central/periférico, servicios/características, notificaciones vs. lecturas, intervalo de conexión y throughput, tamaño útil por paquete | Candidatas: Bluetooth SIG, *Core Specification* (v5.x); Gomez, Oller y Paradells (2012), «Overview and Evaluation of Bluetooth Low Energy», *Sensors* 12(9). C01 Moticon (BLE) como referencia funcional |
| Alineación de relojes entre dispositivos | ADR 0011: origen = mediana(`received_at` − `time_us`), `offset_ms` declarado, intervalos completos (huecos < 1 s), `complete_fraction` | Relojes independientes y deriva; sincronización por referencia común; estimación robusta por mediana; por qué se declara y no se corrige | Candidatas: Cristian (1989) «Probabilistic clock synchronization»; Lamport (1978) «Time, clocks, and the ordering of events»; Mills (1991) NTP. C01 Moticon («time synced sensors»); T06 Mercuri (sincronización) |
| Local-first y sincronización | SQLite como fuente primaria; sincronización de sesiones cerradas por lotes (250), reintentos (3), confirmación por cantidades; funciona en modo avión | Ventajas (disponibilidad, privacidad, latencia), costo (conflictos, consistencia eventual), confirmación idempotente | Candidata: Kleppmann et al. (2019) «Local-first software», Onward! 2019. B07 Riley (metadatos) |
| Seguridad por fila (RLS) | Migraciones 0001–0005 con políticas por titular; `remote-check` 10/10 | Autenticación vs. autorización; políticas en la base y no en el cliente; clave pública vs. clave de servicio | Candidatas: documentación de PostgreSQL «Row Security Policies»; documentación de Supabase (Auth/RLS) |
| Métricas de presión plantar y asimetría | `desc-1.0` (media, máx., desvío, válidas); `dist-1.0` (reparto antepié/retropié, izq./der., asimetría (izq−der)/(izq+der) por zona, variabilidad CV); comparabilidad | Métricas usuales en la literatura (pico, integral, regiones); índices de simetría; por qué en cuentas ADC son descriptivas; cantidad de sensores vs. validez de la fuerza total | S13 VanZant 2001 (simetría); S05 Fuchs 2024 (cantidad de sensores); T05 Olugbon; R01 Abdul Razak 2012; S09 Hohmann 2016, S10 Bercovitz 2022 (cambios con carrera); candidata: Robinson, Herzog y Nigg (1987) índice de simetría |
| Calibración, repetibilidad y error | No hay calibración; repetibilidad ≈10 %; CV entre colocaciones (protocolo H3) | Vocabulario metrológico (repetibilidad, reproducibilidad, exactitud); concordancia; diferencia mínima detectable; pseudorreplicación | M05 JCGM VIM; M06 NIST; M07 Bland-Altman; M08 Lazic; S12 Mulligan 2025; S07 Renner 2019 |
| LLM con contexto en la consulta y barreras | ADR 0012: contexto armado en el teléfono (sesiones, indicadores, comparaciones precalculadas), ficha de conocimiento, filtro clínico por patrones (nivel 3 sin modelo), `/no_think`, temp. 0,4, «Generado por IA · revisar»; dos modos (proveedor externo vs. servidor propio) | Contexto en la consulta (en vez de reentrenar), alucinaciones y mitigación, barreras de alcance, privacidad del contexto enviado a terceros, modelos abiertos ejecutables localmente | Candidatas: Lewis et al. (2020) «Retrieval-Augmented Generation…» (NeurIPS); Ji et al. (2023) «Survey of hallucination in natural language generation» (*ACM Computing Surveys*); Qwen Team (2025) «Qwen3 Technical Report» (arXiv) |
| Registro de entrenamiento y RPE | ADR 0013: rutinas, series (reps, peso, RPE, nota), volumen Σ reps×kg, minutos, RPE medio; vínculo sesión↔serie; declarado | Esfuerzo percibido como medida subjetiva de carga interna; volumen como carga externa; por qué vincular lo declarado con lo medido | Candidatas: Borg (1982) «Psychophysical bases of perceived exertion» (*MSSE*); Foster et al. (2001) «A new approach to monitoring exercise training» (*JSCR*); Zourdos et al. (2016) escala RPE basada en repeticiones en reserva (*JSCR*) |
| Wearables y seguimiento longitudinal | Historial por día, Hoy, comparación, informe, sincronización | Paradigma sensores→métricas→historial→tendencias; línea de base individual; límites de comparar sesiones con condiciones distintas | C06/C07 WHOOP; S11 Escamilla-Martínez 2020 (longitudinal); T04 Dobrescu 2021 (long-term); S01 González 2015 |
| Fatiga: límite explícito | Ningún indicador de fatiga en el código | Fatiga vs. fatigabilidad; cambios biomecánicos con esfuerzo acumulado ≠ medición de fatiga | R02 Enoka y Duchateau; S09 Hohmann (sin cambios en maratón); S10 Bercovitz |
| Metodología de diseño (para cap. 2) | Etapas incrementales con ADR y criterios de cierre | Ciencia del diseño: construir y evaluar un artefacto | M03 Hevner 2004; M04 Peffers 2007; M11 Scrum (iteraciones) |

---

## Capítulo 4 — Marco tecnológico

| Apartado E5 | Conservar | Cambiar (concreto) | Agregar | Fuente |
|---|---|---|---|---|
| 4.1 Arquitectura | Cuatro capas (sensado, embebido, servicios, aplicación) | Pasar de «propuesta» a «implementada»; un ESP32 central → **un ESP32 por pie**; los **dos módulos están construidos** (cada uno en su protoboard) y probados juntos por BLE el 11/11 | Diagrama real (README mermaid) | `02`, ADR 0011 |
| 4.1.3 Requisitos ↔ decisiones ↔ comprobaciones | Idea | — | Tabla RF/RNF de `01` con ADR y evidencia | `01` |
| 4.2.1 Alcance funcional «previsto» / Tabla 10 «estados previstos» | — | **Todo implementado**: reemplazar por estados [H]/[S]/[D] | — | `08_Alcance_Final…` |
| 4.2.2 Etapas de construcción | — | Etapas reales 0–15 | — | `docs/incrementos/` |
| 4.2.3 Límites | Idea | «Asistente IA … posibles ampliaciones» → **implementado** (ADR 0012) | Rutinas/entrenamiento (ADR 0013), informe PDF (ADR 0010), marca .NSL (ADR 0009) | ADR |
| 4.3.1 Firmware | — | Detalle real: PlatformIO, entornos `esp32-synthetic`/`esp32-analog`/`esp32-analog-right`/`esp32-adc-test`, módulos, núcleo 1 | — | `02` |
| 4.3.2 App | — | Pantallas reales | — | `03` |
| 4.3.3 Procesamiento y servicios | — | Métricas versionadas; Edge Function `assistant` | — | `02` |
| 4.3.4 Comunicación y contrato | Contrato | USB JSON 230400; BLE binario 9+6n bytes | — | ADR 0006 |
| 4.3.5 Persistencia | — | SQLite v8; Supabase 0001–0005 | Modelo de datos (tablas) | `02` |
| 4.4.2 Servicios remotos | — | **N ≈ 6×f×T** (un ESP32 con 6 canales) → con dos módulos: N = 2 módulos × 3 canales × 20 Hz × T (idéntico en muestras, pero **dos capturas y dos configuraciones** por sesión). Planes: Supabase Free (pausa a los 7 días de inactividad), EAS Free, OpenRouter por uso | Región São Paulo (sa-east-1) | §Cap. 5 |
| 4.5 Diseño y UX | Objetivos de uso | 4.5.3 «Usabilidad con 5 tareas» → **no realizada con usuarios**; reemplazar por recorrido de tareas por el autor y criterios de diseño (números grandes, n/d, chips de procedencia) | Marca .NSL; brief de interfaz (doc del proyecto `diseno/brief-interfaz.md`) | `03`, ADR 0005, 0009 |
| 4.6.1 Protección de datos | RLS | — | Secretos sólo en la función; seudonimización en el PDF; contexto del asistente declarado | ADR 0008, 0010, 0012 |
| 4.6.2 Estrategia de pruebas («5 pruebas») | — | Reemplazar por 201 pruebas automáticas + H1–H6 + banco | — | `04` |
| 4.6.3 Versiones y despliegue | — | Repo `usal-plantillas-inteligentes`, tag `entrega-final`, builds EAS preview, APK por adb | README «Inicio rápido» | `README.md` |

---

## Capítulo 5 — Justificación económica

### Qué cambia respecto de la Entrega 5

| E5 | Real / qué hacer |
|---|---|
| 1 ESP32 central | **2 ESP32** (uno por pie): recalcular hardware por unidad bilateral |
| EAS Starter USD 19/mes | **EAS Free** en el prototipo (builds preview). Para producción: verificar plan pago vigente |
| 3× ChatGPT Plus | Herramientas de IA usadas realmente (ver `08`); costo de suscripciones del autor: **a completar por Mikel** |
| Gemini API | **OpenRouter** por uso (`qwen/qwen3-14b`) o **LM Studio** (gratis, hardware propio) |
| Equipo de 7 personas, 760 h, USD 14.712 | Mantener **como caso simulado de desarrollo profesional** (Clase 10) declarándolo así; agregar las horas reales del autor por separado |
| Componentes USD 424,60; herramientas USD 619; total USD 17.331,16; preparación adicional USD 7.425,59; operación USD 6.864/año; variable USD 268,40/unidad bilateral | **Recalcular** con: 2 ESP32, sin ADS1115/MPU6050/LiPo/TP4056, servicios reales; volver a correr VAN/TIR |
| VAN negativo en 3 escenarios; TIR optimista 10,03 %; tasa real 21,15 %; ARS 1.500/USD (supuesto); base 14/10/2026 | Mantener metodología; actualizar flujos. Si VAN sigue negativo, **decirlo** (la cátedra pregunta «¿VAN?») y explicar qué haría falta |

### Servicios usados y costo (prototipo)

| Servicio | Uso | Plan | Costo |
|---|---|---|---|
| Supabase | Auth, PostgreSQL con RLS, Edge Function `assistant`, tabla `assistant_usage` | Free (proyecto `lvctmafqmrngqwxcidjw`, sa-east-1) | USD 0 (pausa tras 7 días sin actividad) |
| Expo / EAS | Builds Android preview | Free | USD 0 |
| OpenRouter | LLM `qwen/qwen3-14b` para el modo nube | Prepago por uso; crédito mínimo USD 5; límite recomendado de la clave USD 10 | ≈ USD 0,0003 por pregunta (estimación de la conversación de diseño; **verificar con el panel de OpenRouter**) |
| LM Studio | Modo servidor propio (Qwen3 14B Q4_K_M, 9 GB) | Gratis | USD 0 (usa PC propia: Ryzen 9 9900X, 32 GB, RTX 5070 12 GB) |
| GitHub | Repositorio privado, CI | Free | USD 0 |
| Herramientas de IA para desarrollo | Claude/Claude Code, ChatGPT, Codex, Claude Design | Suscripciones del autor | **A completar** |

### Hardware: referencia de precios (Drive «Componentes Prototipo», relevamiento 13/10/2026, ARS, **sin conciliar con pagos**)

| Ítem | Cant. | Referencia ARS | Nota |
|---|---|---|---|
| ESP32 NodeMCU 38 pines | 1 → **2** | 12.098,37–15.136,68 c/u | Segundo ESP32 (ítem 23) comprado y en uso desde el 11/11: **costear** con el importe pagado |
| FSR (FSR406 ×2 confirmados; FSR402 a conciliar) | 6 activos + repuestos | 16.500–22.000 c/u (referencia indexada) | Cantidad final de FSR402 a registrar |
| Cable USB de datos | 1 → 2 | 2.000–5.000 | Uno por placa en banco |
| Protoboard 830 | 1 → **2** | 3.700–4.500 c/u | Una por módulo: **costear la segunda** |
| Kit Dupont 120 | 1 | 10.200–11.000 | |
| Resistencias 1 % kit | 1 | 6.500–14.000 | |
| Kapton/doble faz | lote | 15.000–25.000 (reserva) | |
| Tester | 1 | 5.000–15.000 | Brinna HB-113A (verificar si se compró o ya se tenía) |
| No usados (sacar del costo del prototipo) | — | — | ADS1115, MPU6050, LiPo, TP4056, plantillas, EVA, caja, velcro, cable siliconado, placas perforadas (salvo que se hayan comprado: entonces costo hundido) |

Escenarios de referencia del documento: piloto 2 FSR $67.498–93.637; par básico 6 FSR $207.598–288.787. **Pendiente: importe efectivamente pagado** (Registro_de_compra `1Wnt4bxFXdVNmiyYx_RX5EXKYzvIM9RH9`: 12 productos comprados 13/10, precios no conciliados).

---

## Capítulo 6 — Riesgos (formato Clase 11)

Formato: «Debido a [causa], podría ocurrir [evento], lo que provocaría [efecto]». P e I de 1 a 5; exposición = P × I. Respuestas: evitar / mitigar / transferir / aceptar. Etapas: antes (desarrollo), durante (demo/defensa), pasaje a producción, operación. Responsable: el autor salvo indicación. Clasificación: alcance, técnicos, recursos, terceros, datos/cumplimiento.

| ID | Riesgo | Área | Int./Ext. | Etapa | P | I | Exp. | Respuesta | Contingencia | Estado al 11/11 |
|---|---|---|---|---|---|---|---|---|---|---|
| R01 | Debido a que el teléfono debe sostener dos enlaces BLE a la vez y el segundo ESP32 no se había probado con sensores, podría fallar la sesión bilateral, lo que provocaría presentar el bilateral sólo como [S] | Técnico | Int. | Antes | 3 | 3 | 9 | Mitigar (protocolo `04` §3 con criterios previos) | Declarar [S]; demo unilateral + bilateral simulado | **No materializado** (11/11): dos enlaces simultáneos, 714 registros por módulo a 20,03 reg/s, 0 huecos (`9befa503`). Queda la corrida de ≥ 120 s |
| R17 | Debido a que la pérdida de un módulo se detecta por el tiempo de supervisión del enlace BLE, podría tardar ≈ 4,5 s en registrarse (medido el 11/11; el criterio era ≤ 3 s), lo que provocaría que el inicio del tramo incompleto quede marcado tarde | Técnico | Int. | Operación | 4 | 2 | 8 | Aceptar y declarar (las métricas bilaterales usan sólo tramos con ambos módulos; evolución: detectar por ausencia de registros o reducir el tiempo de supervisión) | Informar el dato en resultados y limitaciones | Materializado y declarado |
| R02 | Debido a la saturación del talón con apoyo del pie (93–95 % del rango), podría perderse información en apoyos fuertes, lo que provocaría reparto sesgado hacia el antepié | Técnico | Int. | Antes/Operación | 3 | 3 | 9 | Mitigar (bajar R del talón si H3 lo indica; contar % en 4095) | Declarar como limitación | Abierto |
| R03 | Debido al creep y a la repetibilidad ≈10 % de los FSR, podría interpretarse como cambio lo que es variación del montaje, lo que provocaría conclusiones erróneas al comparar sesiones | Técnico/Datos | Int. | Operación | 4 | 3 | 12 | Mitigar (comparabilidad, protocolo fijo, advertencias en informe) | Limitar conclusiones a descriptivas | Mitigado parcialmente |
| R04 | Debido a la inactividad del plan Supabase Free, podría pausarse el proyecto, lo que provocaría fallo de login, sincronización y asistente en la defensa | Terceros | Ext. | Durante | 3 | 4 | 12 | Mitigar (verificar «Active» el día anterior; actividad periódica) | App funciona local-first; asistente por LM Studio | Abierto |
| R05 | Debido a crédito agotado o cambio del modelo en OpenRouter, podría fallar el modo nube del asistente, lo que provocaría no poder mostrarlo | Terceros | Ext. | Durante/Operación | 2 | 3 | 6 | Mitigar (crédito y límite de clave; prueba de conexión) | Modo servidor propio; video | Abierto |
| R06 | Debido a que la red del lugar de defensa puede bloquear tráfico o no permitir la PC en la misma red, podría fallar LM Studio, lo que provocaría depender sólo del modo nube | Terceros | Ext. | Durante | 3 | 2 | 6 | Aceptar | Video grabado | Aceptado |
| R07 | Debido a fallas de BLE en ambientes con interferencia, podría desconectarse un módulo en la demo, lo que provocaría huecos en la sesión mostrada | Técnico | Ext. | Durante | 3 | 3 | 9 | Mitigar (reconexión automática ya implementada; mostrarla como función) | Modo simulado | Mitigado |
| R08 | Debido a que la clave del proveedor LLM podría filtrarse si se incluyera en la app o el repo, podría usarse por terceros, lo que provocaría costos y exposición | Datos/cumplimiento | Int. | Antes/Operación | 1 | 4 | 4 | Evitar (clave sólo como secreto de la función; `.env` fuera de git; `.env.example` sin valores) | Rotar la clave en OpenRouter | Cerrado |
| R09 | Debido a que el contexto del asistente en modo nube sale hacia un proveedor externo, podría tratarse información personal fuera del control del usuario, lo que provocaría problemas de privacidad | Datos/cumplimiento | Ext. | Operación | 2 | 3 | 6 | Mitigar (declarado en Ajustes; seudonimización; modo servidor propio) | Desactivar modo nube | Mitigado |
| R10 | Debido a que un usuario podría interpretar los indicadores como diagnóstico, podría tomar decisiones de salud, lo que provocaría daño y responsabilidad | Alcance/Datos | Ext. | Operación | 2 | 5 | 10 | Mitigar (nivel 3 rechazado sin modelo; textos «no es diagnóstico»; informe para profesional) | — | Mitigado |
| R11 | Debido a que un único autor concentra todo el trabajo y el plazo es fijo (17/11), podría no completarse la redacción, lo que provocaría entrega incompleta | Recursos | Int. | Antes | 3 | 4 | 12 | Mitigar (alcance congelado 5/11; material base en `docs/tesis/`) | Priorizar caps. 4, 7, 8 | Abierto |
| R12 | Debido a la Protección avanzada de Android en el teléfono de prueba, podría bloquearse la instalación de builds o el acceso http local, lo que provocaría no poder actualizar la app el día de la defensa | Técnico/Terceros | Ext. | Durante | 2 | 3 | 6 | Mitigar (instalar por `adb install -r` antes; cleartext habilitado en la app) | Teléfono con la build ya instalada | Mitigado |
| R13 | Debido a que la plantilla no está integrada al calzado, podría no lograrse uso en actividad real al pasar a producto, lo que provocaría rediseño mecánico y electrónico | Alcance | Int. | Pasaje a producción | 5 | 4 | 20 | Aceptar (evolución futura declarada) | — | Aceptado |
| R14 | Debido a que FSR genéricos no garantizan equivalencia con Interlink, podría variar la respuesta entre lotes, lo que provocaría falta de reproducibilidad entre unidades | Técnico/Terceros | Ext. | Pasaje a producción | 3 | 3 | 9 | Mitigar (caracterización por sensor H3; registrar modelo y lote) | Calibración individual | Abierto |
| R15 | Debido a que rutinas y entrenamientos no se sincronizan, podría perderse ese registro si se pierde el teléfono, lo que provocaría pérdida de datos del usuario | Datos | Int. | Operación | 2 | 3 | 6 | Mitigar (respaldo local exportable) | Implementar transferencia (esquema 0005 listo) | Abierto |
| R16 | Debido a que `time_us` es `uint32`, una captura de más de ≈71 min desbordaría el tiempo, lo que provocaría marcas temporales incorrectas | Técnico | Int. | Operación | 1 | 3 | 3 | Aceptar (límite declarado; sesiones de banco cortas) | Reiniciar captura | Aceptado |

Supuestos y restricciones van **separados** de los riesgos (ver `01` §7–8). Pregunta de la cátedra «¿quién lo mantiene?»: responder con el autor (prototipo académico) y qué haría falta para operación (soporte, costos de Supabase/EAS pagos, actualización de dependencias Expo).

---

## Capítulo 7 — Resultados (Clase 12: datos imparciales, buenos y malos, tablas)

| Objetivo | Prueba | Resultado (dato) | Limitación | Fuente |
|---|---|---|---|---|
| OE2 Adquisición | USB 3 canales | 475 registros, 0 saltos, 50,00 ms (49,98–50,00), 0 `read_error` | Banco; un módulo | `04` §2.2 |
| OE2 Sensores | Ensayos de banco | 3 canales independientes (3583/3846/3501); creep 2150→2600 en 5 s (10 kΩ); repetibilidad ≈10 %; 2,2/4,7 kΩ elegidos | Sin calibración; H3 por sensor pendiente (opcional); `R_MEDIAL`/`R_LATERAL` llegaron a 4095 apretando con la mano (4,7 kΩ) | `04` §2.2 |
| OE3 Transmisión | H5 USB, H6 BLE | 502/502; 2069/2069 a 20,0 reg/s; reconexión en ≈5 s con 804 registros al 100 % | Fuente sintética en H5/H6 | `04` §2.1 |
| OE4 App y sesiones | Sesiones físicas BLE | 436 registros (23,4 s) y 609 registros (32,0 s), sin saltos | Talón 93–95 % del rango | `04` §2.2 |
| OE2 Segundo módulo | USB, módulo derecho (11/11) | 397 registros, 0 saltos, 50,00 ms (49,98–50,00), 0 errores; cada sensor mueve sólo su canal | Corrida de ~20 s (el criterio pedía 60 s); falta confirmar medial/lateral | `04` §3 bis |
| OE4 Bilateral (simulación) | Pruebas automáticas + simulación | Desfase simulado 700 ms + deriva 1 % → estimado −760..−650 ms; módulo perdido/recuperado | Datos simulados | `04` §3(c) |
| OE4 Bilateral (dos placas) | Sesión BLE `9befa503` (11/11) | 714 registros por módulo, 20,03 reg/s cada uno, 0 huecos, 0 muestras inválidas; primera recepción con 55 ms de diferencia | 35,6 s (el criterio pedía ≥ 120 s); sensores apretados a mano; firmware 0.3.0 izq. / 0.3.1 der. | `04` §3 bis |
| OE4/OE10 Pérdida de un módulo | Corte de alimentación `2523ea01` (11/11) | Pérdida registrada ≈ 4,5 s después del corte (**no cumple** ≤ 3 s); recuperación automática con nueva captura; tramo incompleto 13 s; `complete_fraction` 75,5 %; 16 248 muestras válidas, 0 con error; el otro módulo siguió a 20,0 reg/s | Dato «malo» a informar: demora de detección | `04` §3 bis |
| OE5 Métricas bilaterales | `bilateral-1.0` sobre `2523ea01` | Izq./der. 60,4 / 39,6 % en tramos completos (64,5 / 35,5 % sobre todo); desfase declarado 125 ms | Cuentas ADC, apretando a mano: no describe un apoyo | `04` §3 bis |
| OE5 Métricas | 29 pruebas + sesiones físicas | Descriptores y reparto calculados; n/d cuando falta un canal | Cuentas ADC | `04` §1 |
| OE5 Comparación | Dos sesiones físicas 3/11 (unilateral) y protocolo (d) | Unilateral: hecho. Bilateral: **pendiente** (sesión de ≥ 120 s y su repetición) | Repetibilidad ≈10 % | `04` §3(d) |
| OE6 Historial y remoto | Respaldo P05; Supabase | 24 sesiones / 6506 registros / 39 036 muestras restaurados; 25 sesiones sincronizadas; RLS 10/10; modo avión OK | Error `permission denied` encontrado y corregido (dato «malo» a informar) | `04` §2.3 |
| OE7 Informe | PDF de sesión y comparación | Generado con procedencia, calidad, limitaciones; PDF de sesión bilateral del 11/11 (mostró dos defectos, corregidos en 0.15.3: tasa promediada sobre el tramo sin un módulo y comparables unilaterales) | Revisión por profesional no realizada | `etapa-12` |
| OE8 Asistente | Batería de preguntas (5) en dos modos | Completar con evidencia de `test-data/asistente/` | Filtro clínico por patrones en español; sin streaming | `04` §2.4 |
| OE9 Entrenamiento | 15 pruebas + uso en teléfono 0.15.1 | Bug encontrado y corregido (cierre de la app por hooks) | Declarado, sin sincronización | `etapa-15` |
| OE1 Relevamiento | Entrevista traumatólogo + encuesta | **Completar** (respuestas, n, hallazgos) | Muestra pequeña, no representativa | Drive |
| Hipótesis | Síntesis | Verificada para unilateral en banco; bilateral verificada en corridas cortas (11/11), con la detección de pérdida más lenta que el criterio | No extrapolable a marcha | — |

Incluir también (Clase 12): requisitos FR/NFR con estado (tabla de `01`), diseño, construcción/integración (etapas), pruebas técnicas y de aceptación (aceptación = criterios fijados en `04` §3), comparación con el estado del arte (tabla de productos de 3.1.3).

---

## Capítulo 8 — Conclusiones

### Conclusiones permitidas (con evidencia)

- Es técnicamente viable adquirir tres lecturas FSR por pie con un ESP32 a 20 registros/s, transmitirlas por BLE y USB sin pérdida de registros en condiciones de banco (H5, H6, etapa 9).
- La arquitectura en capas con contrato de datos versionado permitió desarrollar el software con datos simulados y conectar luego el hardware sin cambiar el contrato.
- Es posible organizar las lecturas en sesiones con calidad explícita, persistirlas localmente, respaldarlas y sincronizarlas con aislamiento por usuario (RLS 10/10, modo avión).
- Las métricas descriptivas en cuentas ADC permiten comparar sesiones bajo condiciones compatibles, con límites dados por creep y repetibilidad (≈10 %).
- Un asistente con LLM puede explicar indicadores precalculados dentro de un alcance acotado, con rechazo fijo de consultas clínicas, tanto con proveedor externo como con modelo local.
- Bilateral (permitido desde el 11/11): el teléfono sostuvo dos enlaces BLE simultáneos a 20 reg/s por módulo sin pérdida de registros en banco (714 + 714, 0 huecos); la sesión continúa cuando se pierde un módulo, lo recupera sin intervención y calcula lo bilateral sólo en los tramos con ambos; el desfase entre módulos se declara (125 ms) y no se corrige. Con sus límites: corridas de 36 s y 79 s, sensores apretados a mano, detección de la pérdida en ≈ 4,5 s (no ≤ 3 s).

### Conclusiones NO permitidas

- Que el dispositivo mide fuerza, presión o peso; que detecta fatiga, lesiones, riesgo o mejora del rendimiento.
- Que es un wearable usable en carrera, caminata o gimnasio (no se probó montado en el calzado ni en movimiento).
- Que fue validado con usuarios o que es usable/útil para deportistas (no hubo pruebas con personas; la encuesta es percepción de la propuesta).
- Que el asistente es seguro clínicamente o que no alucina (sólo que tiene barreras y fue probado con una batería acotada).
- Que el reparto izquierda/derecha medido describe el apoyo de una persona (las sesiones bilaterales del 11/11 fueron con los sensores apretados a mano; falta la sesión de ≥ 120 s con el pie).
- Que dos sesiones bilaterales son comparables o repetibles, o que la sincronización remota de una sesión bilateral está verificada (no se probó con placas).
- Que la pérdida de un módulo se detecta en menos de 3 s, o que los dos módulos están sincronizados (sólo hay correspondencia por recepción con desfase declarado).
- Que el modelo de negocio es viable si el VAN da negativo.

### Estructura sugerida (Clase 12)

Implicancias teóricas e innovación (integración wearable de lecturas plantares + entrenamiento declarado + asistente acotado) → conclusiones por objetivo → aportes (contrato y protocolo, métricas versionadas con n/d, correspondencia bilateral por recepción, informe para profesional, asistente de tres niveles) → limitaciones → recomendaciones (práctica, investigadores, instituciones, desarrollo tecnológico) → líneas futuras: integración en calzado y batería, calibración a fuerza, IMU y detección de pasos, pruebas con personas (SUS, marcha, carrera), sincronización de entrenamiento, herramientas de consulta para el asistente, integración con WHOOP u otros wearables, portal profesional.

---

## Bibliografía

- Base: 50 referencias de Drive (M01–M11, S01–S13, T01–T07, B01–B08, R01–R02, N01–N02, C01–C07). Formato APA 7 (como en la base).
- Agregar las «Candidatas» del cap. 3 **sólo después de verificarlas** (DOI, páginas).
- Documentación técnica de herramientas usadas (Expo, React Native, Supabase, PlatformIO, NimBLE-Arduino, react-native-ble-plx, OpenRouter, LM Studio, Qwen3) como referencias técnicas, no científicas.

## Apéndices (material propio)

| Apéndice sugerido | Contenido | Fuente |
|---|---|---|
| A. Contrato de datos v1.0 | Campos, reglas C01–C12, formato binario BLE | `docs/especificacion/02_Contrato_de_Datos_y_Modelo.md`, `packages/contract` |
| B. Decisiones de arquitectura | Resumen de ADR 0001–0013 | `docs/decisiones/` |
| C. Protocolos de prueba y resultados | Tablas de `04` | `04` |
| D. Modelo de datos | Tablas locales y remotas | `02`, `supabase/migrations/` |
| E. Prompts y uso de IA | Prompt de sistema del asistente; selección de prompts de desarrollo | `packages/assistant/src/prompt.ts`, `08` |
| F. Guía de entrevista y encuesta | Instrumentos y respuestas | Drive (Cierre 27/10) |

## Anexos (material de terceros / complementario)

| Anexo | Contenido |
|---|---|
| Anexo de repositorios | URL del repo `usal-plantillas-inteligentes`, tag `entrega-final`, acceso de lectura al mail USAL del profesor y del coach si es privado, estructura del monorepo, cómo ejecutar (README «Inicio rápido») |
| Hojas de datos | Interlink FSR 400/406, Espressif ESP32 (fragmentos citados) |
| Capturas | `docs/capturas/` |
