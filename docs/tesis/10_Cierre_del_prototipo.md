# 10 — Cierre del prototipo (13/11/2026)

- Estado: **desarrollo y validación cerrados**. App 0.15.3 · firmware 0.3.1 (placa derecha) y 0.3.0 (placa izquierda) · contrato v1.0 · 201 pruebas automáticas.
- Desde el 11/11 no hubo cambios de código: lo del 13/11 es evidencia y documentación.
- Este archivo es la síntesis del cierre: qué hace el sistema, cómo lo hace, qué quedó demostrado, qué no, y qué pide la cátedra para la entrega. El detalle está en `01`–`09`; acá cada afirmación remite a su fuente.
- Estados: **[H]** hardware real con registro guardado · **[S]** simulación o pruebas automáticas · **[D]** diseñado · **[F]** futuro (`00_LEEME.md`).

## 1. Qué es el sistema

Plataforma de dos módulos autónomos, uno por pie. Cada módulo es un ESP32 con tres sensores FSR (talón, antepié medial, antepié lateral) que envía sus lecturas por Bluetooth Low Energy a una aplicación Android. La aplicación arma sesiones, calcula indicadores descriptivos, guarda el historial, compara sesiones compatibles, genera informes PDF, registra el entrenamiento declarado, sincroniza con un servidor y ofrece un asistente que explica los indicadores ya calculados.

Lo que el sistema entrega son **cuentas ADC (0–4095) sin calibrar** y descriptores derivados de ellas. No mide fuerza ni presión, no detecta fatiga y no diagnostica.

Todo el hardware se validó **en banco, sobre protoboard**, con alimentación por USB y los sensores cargados con la mano o con el pie apoyado. No hay plantilla integrada en calzado ni pruebas de uso con personas.

## 2. Cómo funciona, de punta a punta

| Paso | Qué ocurre | Dónde está | Estado |
|---|---|---|---|
| 1. Sensado | Cada FSR forma un divisor de tensión (FSR a 3V3, resistencia fija a GND: 2,2 kΩ en talón con FSR406, 4,7 kΩ en antepié con FSR402). El punto medio va a un pin ADC1 (36, 39, 34) | `firmware/include/configuration.h`, `docs/incrementos/etapa-09-fuente-fisica.md` | [H] |
| 2. Adquisición | El ESP32 lee los tres canales cada 50 ms (20 registros/s), 12 bits. Cada registro lleva secuencia, tiempo del módulo (`time_us`) y estado por muestra | `firmware/src/` | [H] |
| 3. Transporte | Por USB (texto, 230400 baudios, para verificación) y por BLE (notificaciones binarias, registro de 27 bytes, MTU 185) | `firmware/`, `packages/ble`, ADR 0006 | [H] |
| 4. Validación | La app valida cada registro contra el contrato v1.0 (reglas C01–C12) y descarta los inválidos con motivo. Un canal no instrumentado es «n/d», nunca 0 | `packages/contract` | [H]/[S] |
| 5. Sesión | Una sesión reúne 1 o 2 módulos; cada módulo tiene sus capturas, su secuencia y su reloj. Se registran eventos (conexión, inicio y fin de captura, módulo perdido y recuperado) | `packages/session`, ADR 0011 | [H] |
| 6. Correspondencia entre pies | No hay reloj común: las lecturas de ambos módulos se alinean por instante de recepción y se **declara** el desfase estimado (`offset_ms`). Lo bilateral se calcula sólo en tramos con ambos módulos presentes (`complete_fraction`) | `packages/metrics`, ADR 0011 | [H] declarado · [S] exactitud |
| 7. Indicadores | Por posición: media, máximo, desvío, n válidas (`desc-1.0`). Reparto antepié/talón e izquierda/derecha, asimetría por zona, variabilidad (`dist-1.0`, `bilateral-1.0`). Cada resultado lleva la versión del algoritmo | `packages/metrics` | [H] |
| 8. Calidad | Registros recibidos, muestras válidas y con error, saltos de secuencia, desconexiones, tasa efectiva por módulo | `packages/metrics`, `packages/report` | [H] |
| 9. Persistencia | SQLite en el teléfono (migraciones v1–v8). La app funciona completa sin red ni cuenta | `packages/storage`, ADR 0004 | [H] |
| 10. Historial y comparación | Historial por día; comparación entre dos sesiones sólo si comparten el conjunto de configuraciones y el origen de la señal; las no comparables se bloquean | `packages/metrics`, `apps/mobile` | [H] |
| 11. Informes | PDF de sesión y de comparación «para revisión profesional», con calidad, indicadores, gráficos y limitaciones; CSV por muestra; paquete `.plantillas.json` | `packages/report`, ADR 0010 | [H] |
| 12. Respaldo y nube | Respaldo y restauración locales. Cuenta y sincronización de sesiones cerradas con Supabase, con confirmación por cantidades y aislamiento por usuario (RLS) | `packages/sync`, `supabase/`, ADR 0007 y 0008 | [H] |
| 13. Entrenamiento | Rutinas, ejercicios de fuerza, caminata/carrera u otros, series con repeticiones, peso y esfuerzo percibido, descansos; el entrenamiento puede vincularse a la sesión medida. Es declarado por la persona: la app no lo verifica | `packages/training`, ADR 0013 | [S] + uso en teléfono |
| 14. Asistente | Responde sobre los indicadores ya calculados y ayuda a cargar series. Un filtro previo rechaza con respuesta fija las preguntas clínicas (fatiga, lesión, diagnóstico). Dos modos: nube (función en Supabase con la clave en el servidor) y servidor propio en la red local | `packages/assistant`, `supabase/functions/assistant`, ADR 0012 | [H] en ambos modos (4/11) |
| 15. Demostración | Fuente simulada determinista con el mismo contrato que el hardware, marcada `simulated` y nunca mezclada con sesiones físicas en una comparación | `packages/simulator` | [S] |

## 3. Qué quedó demostrado con hardware

| Fecha | Prueba | Resultado | Evidencia |
|---|---|---|---|
| 3/11 | Módulo izquierdo por USB | 475 registros, 0 saltos, período 50,00 ms, 0 lecturas fallidas | `test-data/fisico/logs-serie/`, `etapa-09` |
| 3/11 | Módulo izquierdo por BLE, pie apoyado | Dos sesiones (436 y 609 registros, 0 saltos); talón sin saturar | `test-data/fisico/sesion-2026-11-03-*.plantillas.json` |
| 3/11 | Comparación e informe PDF unilateral | Generados sobre las dos sesiones físicas | `etapa-12` |
| 4/11 | Asistente con sesiones físicas | Responde en modo nube y en servidor propio | `etapa-14` |
| 11/11 | Módulo derecho por USB | 397 registros, 0 saltos, 50,00 ms | `04` §3 bis |
| 11/11 | Primera sesión bilateral `9befa503` | 714 registros por módulo, 20,03 reg/s, 0 huecos | `sesion-2026-11-11-9befa503-bilateral.csv` |
| 11/11 | Corte de un módulo `2523ea01` | Pérdida registrada, recuperación automática con nueva captura, bilateral sólo en tramos completos (75,5 %) | `informe-2026-11-11-2523ea01-bilateral-corte.pdf` |
| 13/11 | Sesión bilateral de 90 s `d3367518` | 1802 + 1803 registros, 20,0 reg/s, 0 huecos, 0 errores, 99,9 % con ambos módulos, sin saturación; reparto izq./der. coherente con la carga aplicada | `sesion-2026-11-13-d3367518-bilateral.csv`, `informe-2026-11-13-d3367518-bilateral.pdf` |
| 13/11 | Comparación entre dos sesiones bilaterales | Declaradas comparables; diferencia izq./der. 4,6 puntos; PDF de comparación generado | `informe-comparacion-2026-11-13-f66ec0f5-d3367518-bilateral.pdf` |
| 13/11 | Sincronización bilateral | Las dos sesiones en Supabase con las mismas cantidades que en el teléfono (3605 y 3731 registros) | `test-data/remote/2026-11-13-supabase-sesiones-bilaterales-registros.png` |

Detalle, tablas y cálculos: `04_Evidencia_y_pruebas.md` §2, §3 bis y §3 ter.

## 4. Qué NO quedó demostrado (declararlo en el capítulo 7)

| Tema | Situación | Cómo escribirlo |
|---|---|---|
| Sesión de ≥ 120 s con consigna de seis fases de carga | No ejecutada. La más larga es de 90 s con carga manual | «La corrida más larga fue de 90 s»; no extrapolar a sesiones largas |
| Reparto antepié/talón con dos placas | Sin fases diferenciadas: los tres sensores de cada módulo se cargaron juntos | El indicador se calcula, pero su respuesta a un cambio de carga sólo se observó en el módulo izquierdo (3/11) |
| Detección de la pérdida de un módulo | ≈ 4,5 s; el criterio fijado era ≤ 3 s | Criterio no cumplido; causa: tiempo de supervisión del enlace BLE |
| Caracterización H3 por sensor | No ejecutada | No hay curva lectura–carga por sensor; sin calibración |
| Corrida USB de 60 s del módulo derecho | Se hizo una de ≈ 20 s | Declarar la duración real |
| Orden medial/lateral del módulo derecho | Sin confirmar si SVN y P34 están cruzados | Limitación del montaje de banco |
| Saturación del antepié | 4095 puntual apretando con la mano (11/11); no verificada con el pie en el derecho | Declarar; en las sesiones del 13/11 no hubo lecturas en 4095 |
| Exactitud del desfase entre módulos | Se declara (125–235 ms según la sesión) pero no se contrastó con una referencia externa | Es una estimación por recepción, no sincronización |
| Asistente sobre la comparación bilateral | No probado («¿qué cambió respecto de la anterior?») | No afirmarlo con sesiones bilaterales |
| Entrenamiento en la nube | Esquema 0005 preparado, transferencia no implementada | [D] |
| Plantilla en calzado, autonomía, marcha, personas | Fuera del alcance | [F] |
| Relación con la fatiga | No se estudió experimentalmente | Sólo marco bibliográfico y trabajo futuro |

Lista completa de deudas y limitaciones: `09_Deudas_y_limitaciones.md`.

## 5. Qué se puede afirmar (base para hipótesis y conclusiones)

1. Es técnicamente viable adquirir tres FSR por pie con un ESP32 a 20 registros/s y transmitirlos por BLE a un teléfono **sin pérdida de registros** en corridas de hasta 90 s con dos módulos simultáneos (0 huecos en 3605 y 3731 registros).
2. La cadena completa usuario → sensores → microcontrolador → BLE → aplicación → procesamiento → almacenamiento → visualización → historial → comparación → informe → nube funcionó con hardware real, con registro guardado de cada eslabón.
3. Dos módulos sin reloj común pueden integrarse en una sesión si la correspondencia se hace por recepción, el desfase se declara y lo bilateral se limita a los tramos completos; el sistema siguió funcionando ante la pérdida de un módulo y lo recuperó sin intervención.
4. Los indicadores son descriptores de la lectura. El reparto izquierda/derecha siguió la carga aplicada; no se validó contra un instrumento de referencia.
5. El mismo contrato sirve para datos simulados y reales, lo que permitió desarrollar el software antes de tener el hardware.

Lo que **no** se puede afirmar: precisión de medida, validez clínica, detección de fatiga, comportamiento en marcha o carrera, durabilidad, ni utilidad percibida por usuarios.

## 6. Requisitos de la cátedra (Clase 13) y estado

### Repositorio

| Requisito | Estado | Dónde |
|---|---|---|
| Nombre `usal-<proyecto>` | Cumplido: `usal-plantillas-inteligentes` | GitHub |
| README: qué es, instalación, ejecución, variables de entorno, estructura, autor | Cumplido | `README.md` |
| Prueba de los 15 minutos (clonar y levantar) | Cumplido para el recorrido A (software y pruebas); B y C requieren teléfono y placas | `README.md` «Inicio rápido» |
| `.gitignore` | Cumplido | `.gitignore` |
| Secretos fuera del repo y `.env.example` | Cumplido: sin claves versionadas; dos `.env.example` | `apps/mobile/.env.example`, `supabase/functions/.env.example` |
| Licencia | Cumplido: MIT | `LICENSE` |
| Commits frecuentes | Cumplido: historial desde la etapa 0 con Conventional Commits | `git log`, `CHANGELOG.md` |
| Datos de prueba en el repo | Cumplido | `test-data/` |
| Capturas del sistema en el README | Cumplido (13/11) | `README.md` «Capturas», `docs/capturas/` |
| Documentación técnica que no entra en el PDF | Cumplido | `docs/` (especificación, ADR, incrementos, tesis) |
| Acceso de lectura para el profesor y el coach (mail USAL) | **Pendiente (autor)** | GitHub → Settings → Collaborators |
| Tag `entrega-final` en el commit que se defiende | Cumplido: etiqueta en `1169f82` | `git tag -l entrega-final` |
| Enlace al repo y tag citados en la segunda página y en el anexo de repositorios | Cumplido (16/11): segunda página y anexo I del PDF | PDF de la tesis |

### Sistema el día de la defensa

| Requisito | Estado |
|---|---|
| Sistema funcionando | APK 0.15.3 instalada; Supabase y función del asistente desplegadas |
| Ambiente de respaldo | Modo local sin red, simulador «dos módulos», servidor propio del asistente (`06_Defensa.md`) |
| Datos de prueba cargados | Sesiones del 3/11, 11/11 y 13/11 en el teléfono; las dos bilaterales del 13/11 verificadas en Supabase |
| Guion de demo < 4 min | `06_Defensa.md` |
| Video grabado | **Pendiente (autor)** |
| Instrucciones reproducibles | `README.md` |
| Supabase activo | Plan Free: se pausa a los 7 días sin uso. Abrir el panel y sincronizar el día anterior |

### Documento

Estructura exigida (preliminares, capítulos 1–8, bibliografía, apéndices y anexos) según la Clase 13. Declaración de uso de IA: `08_Uso_de_IA.md`. Glosario y siglas: `07_Glosario_y_siglas.md`. Pendientes del autor que afectan al documento: entrevista y encuesta, costos reales pagados, declaración de originalidad.

### Preguntas del jurado (Clase 13) y dónde está la respuesta

| Pregunta | Fuente |
|---|---|
| ¿Por qué esa tecnología y no otra? | ADR 0001–0013 |
| ¿Qué pasó con la hipótesis? ¿Se cumplió? | §5 de este archivo; `01` (hipótesis) |
| ¿Qué está implementado y qué simulado? | §2 y §3; `01` (RF con estado) |
| ¿Qué no funcionó y qué harían distinto? | §4; `09` |
| ¿Qué parte es propia y qué de terceros? | `02_Arquitectura_y_codigo.md`; `08_Uso_de_IA.md` |
| Preguntas económicas (tasa, clientes, VAN) | Tesis, capítulo 5 |

## 7. Pasos para cerrar el repositorio

1. `npm test` y `npm run typecheck` en la PC: deben dar 201 pruebas en verde.
2. `git push`.
3. Verificar que la CI de GitHub quede en verde.
4. Dar acceso de lectura al profesor y al coach.
5. Cuando el documento cite el commit definitivo: `git tag entrega-final` y `git push --tags`.
