# docs/tesis — material base para redactar la tesis

- Fecha de corte: 5/11/2026; actualizado el 11/11/2026 con la validación con dos placas y **cerrado el 13/11/2026** (ver `10_Cierre_del_prototipo.md`). App 0.15.3; firmware 0.3.1 en la placa derecha y 0.3.0 en la izquierda (no se recargó; 0.3.1 sólo agrega el entorno del pie derecho).
- Propósito: reunir en un solo lugar, en forma de puntos y tablas, todo lo que la tesis puede afirmar sobre el prototipo, con la ruta de la evidencia en el repositorio. **No es prosa académica**: es la materia prima para redactar en Google Docs y luego pasar a LaTeX (template de la cátedra: `https://github.com/Noorman999/usal-proyecto-final-template`).
- Regla: si algo no figura acá o en los documentos enlazados, no se afirma en la tesis sin verificarlo primero en el código o en los registros.

## Índice

| Archivo | Para qué sirve | Capítulos que alimenta |
|---|---|---|
| `00_LEEME.md` | Este índice, convención de estados y forma de uso | — |
| `01_Especificacion_final.md` | Alcance congelado al 5/11/2026; objetivo general y específicos propuestos; requisitos funcionales (RF-xx) y no funcionales (RNF-xx) con estado y evidencia; qué NO hace; supuestos y restricciones | 1 (objetivos, alcance), 2 (metodología), 4 (requisitos), 7 (contraste) |
| `02_Arquitectura_y_codigo.md` | Arquitectura en capas, paquetes del monorepo, firmware, protocolo, persistencia, sincronización, asistente; qué hace cada módulo y qué conceptos teóricos toca (lo escribe otro agente) | 3 (marco teórico), 4 (diseño), apéndices técnicos |
| `03_Funcionalidades_por_pantalla.md` | Cada pantalla de la app: qué muestra, qué permite hacer, qué datos usa, estado (lo escribe otro agente) | 4 (diseño de interfaz), 7 (resultados), defensa |
| `04_Evidencia_y_pruebas.md` | Pruebas automáticas por paquete; evidencia de hardware con números; evidencia remota; asistente; protocolos con criterios de aceptación fijados antes de ejecutar (§3) y resultados con dos placas del 11/11 (§3 bis) | 4 (plan de pruebas), 7 (resultados) |
| `05_Mapa_tesis.md` | Recorrido por cada parte del documento: qué pide la cátedra, qué conservar de la Entrega 5, qué cambiar, qué agregar y de qué archivo del repo sale | Todos |
| `06_Defensa.md` | Guion de demo (< 4 min), carga de datos de demostración, plan de respaldo, checklist del día, video, preguntas del jurado con datos | Defensa del 17/11 (o la fecha que fije la cátedra) |
| `07_Glosario_y_siglas.md` | Glosario, siglas y símbolos (lo escribe otro agente) | Preliminares (glosario/siglas/símbolos) |
| `09_Deudas_y_limitaciones.md` | Deudas técnicas y limitaciones conocidas, con su estado | 6, 7, 8, defensa |
| `10_Cierre_del_prototipo.md` | **Empezar por acá.** Síntesis del cierre: qué hace el sistema y cómo, qué quedó demostrado y qué no, qué se puede afirmar, requisitos de la cátedra con su estado y pasos para cerrar el repositorio | Todos |
| `08_Uso_de_IA.md` | Material para la declaración de uso de IA: herramientas, para qué, qué hizo el autor, cómo se verificó | Preliminares (declaración de uso de IA), cap. 2 (metodología), apéndice de prompts |

Documentos del repo que estos archivos citan con frecuencia:

| Ruta | Contenido |
|---|---|
| `docs/especificacion/08_Alcance_Final_del_Prototipo.md` | Alcance del prototipo con estados por función (fuente de verdad técnica) |
| `docs/decisiones/0001…0013-*.md` | Decisiones de arquitectura (ADR); cada una con contexto, alternativas y consecuencias |
| `docs/incrementos/etapa-00…15-*.md` | Bitácora por incremento: qué se hizo, cómo se probó, qué quedó pendiente |
| `test-data/` | Datos de prueba y registros: `firmware/` (logs USB y BLE), `fisico/` (sesiones con FSR y logs de serie), `remote/` (Supabase, RLS, capturas), `backup/`, `simulator/`, fixtures del contrato |
| `docs/capturas/` | Capturas de pantalla por versión (`0.11.0/`, `0.12.0-fsr/`) |

## Convención de estados (usar siempre en la tesis)

| Marca | Significado | Qué se puede escribir |
|---|---|---|
| **[H]** | Validado con hardware real (ESP32 + FSR, teléfono físico) y con registro guardado | «Se comprobó experimentalmente…» citando el registro |
| **[S]** | Validado con simulación (simulador determinista, pruebas automáticas, fuente sintética del firmware) | «Se verificó con datos simulados / pruebas automáticas…»; no afirmar que funciona con sensores reales |
| **[D]** | Diseñado (decisión documentada, esquema o interfaz preparada) pero no implementado o no probado de extremo a extremo | «Se diseñó…», «queda preparado…» |
| **[F]** | Evolución futura: planteado, sin diseño detallado ni implementación | «Como trabajo futuro se propone…» |

Reglas de uso:

- Un estado [H] exige número + ruta del registro (`test-data/...` o `docs/capturas/...`). Sin registro, baja a [S] o [D].
- Una función puede tener estados distintos por parte: p. ej., bilateral = [H] en su recorrido básico desde el 11/11 (dos enlaces BLE simultáneos, sesión con dos módulos, pérdida y recuperación de uno, métricas en tramos completos, informe PDF), más comparación entre dos sesiones bilaterales y sincronización bilateral desde el 13/11, y [S] en lo que no se probó con placas: deriva de reloj y exactitud del desfase (ver `04_Evidencia_y_pruebas.md` §3 bis, §3 ter y §3 quater).
- Las magnitudes son **cuentas ADC (0–4095)** sin calibración: nunca escribir «presión», «fuerza», «kg» o «N» como salida del prototipo.
- Diferenciar siempre medición → lectura descriptiva → patrón → recomendación → diagnóstico (el prototipo llega hasta lectura descriptiva; no diagnostica).
- Diferenciar lo demostrado por la literatura, lo demostrado por el prototipo, lo diseñado y lo futuro (instrucciones del proyecto).

## Cómo usar este material para redactar

1. Abrir `05_Mapa_tesis.md` en el apartado a redactar: indica qué pide la cátedra, qué conservar/cambiar de la Entrega 5 y qué archivo consultar.
2. Tomar los datos del archivo fuente indicado (01, 02, 03 o 04) con su estado [H]/[S]/[D]/[F].
3. Para el marco teórico (cap. 3), usar la lista de temas de `05_Mapa_tesis.md` §Cap. 3: cada tema indica qué parte del código lo justifica y qué referencias de la base bibliográfica de Drive existen o faltan.
4. Redactar en primera persona del plural para decisiones propias y en tercera persona/impersonal para literatura (instrucciones del proyecto). Las tesis de referencia sirven de guía de tono, no de fuente.
5. Al terminar un capítulo, revisar contra `01_Especificacion_final.md` (alcance y «qué NO hace») para no prometer funciones no implementadas.
6. Hecho el 11/11: resultados con dos placas en `04_Evidencia_y_pruebas.md` §3 bis y estados actualizados en 01 y en `08_Alcance_Final_del_Prototipo.md`. Si se ejecutan las pruebas que faltan (lista en «Actualización 11/11», más abajo), completar las tablas de `04` §3 y volver a actualizar los estados.

## Pendientes que afectan a estos documentos

- Resultados del 11/11 (segundo módulo por USB, bilateral BLE, prueba de corte): ya incorporados en 01, 02, 03, 04 §3 bis, 05, 06 y 09. Lo que falta (sesión ≥ 120 s, dos sesiones bilaterales comparables, sincronización bilateral, H3 por sensor) actualiza 01, 04, 05 (cap. 7) y 06 cuando se ejecute.
- Entrevista al traumatólogo de rodilla y encuesta breve: actualizan 05 (caps. 2 y 7).
- Costos reales pagados: actualizan 05 (cap. 5).

## Agregado 6/11

- `09_Deudas_y_limitaciones.md`: deudas técnicas y limitaciones conocidas del código, con su estado (corregida / declarar / pendiente). Fuente para los capítulos 6, 7 y 8 y para la pregunta del jurado «¿qué no funcionó?».

## Actualización 11/11

La segunda placa llegó el **11/11** (no el 6/11, como preveían estos documentos). Toda mención anterior a «la prueba del 6/11» debe leerse como «la validación con dos placas», ejecutada el 11/11. Resumen (detalle y archivos en `04_Evidencia_y_pruebas.md` §3 bis):

- **Módulo derecho** `ESP32-68D1D8` / `ESP32-FSR-R-001`, firmware 0.3.1, con **su propia protoboard** (cada módulo tiene la suya). Por USB: 397 registros, 0 saltos, período 50,00 ms, 0 lecturas fallidas.
- **Primera sesión bilateral por BLE** `9befa503`: 714 registros por módulo, 20,03 reg/s en cada uno, 0 huecos.
- **Prueba de corte** `2523ea01`: pérdida detectada ≈ 4,5 s después del corte (**no cumple** el ≤ 3 s fijado; se declara), recuperación automática con nueva captura, tramo incompleto de 13 s, `complete_fraction` 75,5 %, izq./der. 60,4 / 39,6 % en tramos completos, desfase declarado 125 ms, 16 248 muestras válidas y 0 con error.
- **App 0.15.3**: tasa efectiva calculada por captura (antes promediaba el tramo sin un módulo), sesiones comparables sólo con el mismo conjunto de configuraciones, capturas del Detalle rotuladas por pie.
- **Sigue pendiente**: sesión de ≥ 120 s con el pie y la consigna de cargas; su repetición para Comparación y el PDF de comparación; sincronización verificada de una sesión bilateral; H3 por sensor (opcional); corrida USB de 60 s del módulo derecho; confirmar medial/lateral del derecho; saturación puntual de `R_MEDIAL`/`R_LATERAL` con 4,7 kΩ al apretar con la mano.

## Cierre 13/11

Validación con hardware cerrada; sin cambios de código desde 0.15.3. Lo incorporado (detalle en `04` §3 ter y §3 quater; síntesis en `10_Cierre_del_prototipo.md`):

- **Sesión bilateral de 90 s** `d3367518`: 1802 + 1803 registros, 20,0 reg/s, 0 huecos, 0 errores, 99,9 % con ambos módulos, sin saturación; reparto izq./der. coherente con la carga aplicada.
- **Comparación entre dos sesiones bilaterales** (`f66ec0f5` y `d3367518`): comparables; diferencia izq./der. de 4,6 puntos; PDF de comparación generado.
- **Sincronización bilateral**: ambas sesiones en Supabase con las mismas cantidades que en el teléfono.
- **No ejecutado, se declara**: sesión de ≥ 120 s con consigna de seis fases; H3 por sensor; corrida USB de 60 s del derecho; orden medial/lateral del derecho; saturación del antepié con el pie; asistente sobre la comparación bilateral. La lista «Sigue pendiente» de la actualización del 11/11 debe leerse como «no ejecutado» salvo comparación y sincronización, que se hicieron.
- Pendientes que ya no son de desarrollo sino del autor: entrevista y encuesta, costos reales, video de demo, acceso al repositorio para la cátedra, tag `entrega-final`.
