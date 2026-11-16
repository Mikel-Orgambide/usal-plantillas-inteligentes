# docs/tesis — documentación de evaluación del prototipo

- Cerrado el 13/11/2026. App 0.15.3; firmware 0.3.1 en la placa derecha y 0.3.0 en la izquierda (no se recargó; 0.3.1 sólo agrega el entorno del pie derecho).
- Reúne, en puntos y tablas, lo que se puede afirmar sobre el prototipo, con la ruta de la evidencia en el repositorio.
- Regla: lo que no figura acá o en los documentos enlazados no se afirma sin verificarlo antes en el código o en los registros.

## Índice

| Archivo | Contenido |
|---|---|
| [`10_Cierre_del_prototipo.md`](10_Cierre_del_prototipo.md) | **Empezar por acá.** Qué hace el sistema y cómo, qué quedó demostrado con hardware, qué no y qué se puede afirmar |
| [`01_Especificacion_final.md`](01_Especificacion_final.md) | Alcance congelado al 5/11/2026, objetivos, requisitos funcionales (RF) y no funcionales (RNF) con estado y evidencia, qué no hace, supuestos y restricciones |
| [`02_Arquitectura_y_codigo.md`](02_Arquitectura_y_codigo.md) | Arquitectura en capas, paquetes del monorepo, firmware, protocolo, persistencia, sincronización y asistente |
| [`03_Funcionalidades_por_pantalla.md`](03_Funcionalidades_por_pantalla.md) | Cada pantalla de la app: qué muestra, qué permite hacer, qué datos usa y su estado |
| [`04_Evidencia_y_pruebas.md`](04_Evidencia_y_pruebas.md) | Pruebas automáticas por paquete, evidencia de hardware y remota con números, protocolos con criterios de aceptación fijados antes de ejecutar (§3) y resultados con dos placas (§3 bis a §3 quater) |
| [`06_Defensa.md`](06_Defensa.md) | Recorrido reproducible de la demostración, datos a cargar y plan de respaldo |
| [`07_Glosario_y_siglas.md`](07_Glosario_y_siglas.md) | Glosario, siglas y símbolos |
| [`08_Uso_de_IA.md`](08_Uso_de_IA.md) | Declaración de uso de inteligencia artificial: herramientas, tareas, qué hizo el autor y cómo se verificó |
| [`09_Deudas_y_limitaciones.md`](09_Deudas_y_limitaciones.md) | Deudas técnicas y limitaciones conocidas, con su estado |

El número 05 correspondía al mapa de redacción de la tesis, capítulo por capítulo. Era una guía editorial; se retiró de la rama principal el 16/11/2026 y puede consultarse en la etiqueta `entrega-final`: [`05_Mapa_tesis.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/tesis/05_Mapa_tesis.md).

Documentos del repositorio que estos archivos citan con frecuencia:

| Ruta | Contenido |
|---|---|
| `docs/especificacion/08_Alcance_Final_del_Prototipo.md` | Alcance del prototipo con estados por función |
| `docs/decisiones/0001…0013-*.md` | Decisiones de arquitectura (ADR), cada una con contexto, alternativas y consecuencias |
| `docs/incrementos/etapa-00…15-*.md` | Bitácora por etapa: qué se hizo, cómo se probó y qué quedó pendiente |
| `test-data/` | Datos de prueba y registros: `firmware/` (registros USB), `fisico/` (sesiones con FSR, informes y registros del monitor serie), `remote/` (Supabase, reglas de acceso, capturas), `backup/`, `simulator/` y `contract/` |
| `docs/capturas/` | Capturas de pantalla por versión (`0.11.0/`, `0.12.0-fsr/`, `0.15.3/`) |

## Convención de estados

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
- Diferenciar lo demostrado por la literatura, lo demostrado por el prototipo, lo diseñado y lo futuro.

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
