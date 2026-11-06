# docs/tesis — material base para redactar la tesis

- Fecha de corte: 5/11/2026. App 0.15.2, firmware 0.3.1.
- Propósito: reunir en un solo lugar, en forma de puntos y tablas, todo lo que la tesis puede afirmar sobre el prototipo, con la ruta de la evidencia en el repositorio. **No es prosa académica**: es la materia prima para redactar en Google Docs y luego pasar a LaTeX (template de la cátedra: `https://github.com/Noorman999/usal-proyecto-final-template`).
- Regla: si algo no figura acá o en los documentos enlazados, no se afirma en la tesis sin verificarlo primero en el código o en los registros.

## Índice

| Archivo | Para qué sirve | Capítulos que alimenta |
|---|---|---|
| `00_LEEME.md` | Este índice, convención de estados y forma de uso | — |
| `01_Especificacion_final.md` | Alcance congelado al 5/11/2026; objetivo general y específicos propuestos; requisitos funcionales (RF-xx) y no funcionales (RNF-xx) con estado y evidencia; qué NO hace; supuestos y restricciones | 1 (objetivos, alcance), 2 (metodología), 4 (requisitos), 7 (contraste) |
| `02_Arquitectura_y_codigo.md` | Arquitectura en capas, paquetes del monorepo, firmware, protocolo, persistencia, sincronización, asistente; qué hace cada módulo y qué conceptos teóricos toca (lo escribe otro agente) | 3 (marco teórico), 4 (diseño), apéndices técnicos |
| `03_Funcionalidades_por_pantalla.md` | Cada pantalla de la app: qué muestra, qué permite hacer, qué datos usa, estado (lo escribe otro agente) | 4 (diseño de interfaz), 7 (resultados), defensa |
| `04_Evidencia_y_pruebas.md` | Pruebas automáticas por paquete; evidencia de hardware con números; evidencia remota; asistente; protocolos pendientes del 6/11 con criterios de aceptación y tablas vacías | 4 (plan de pruebas), 7 (resultados) |
| `05_Mapa_tesis.md` | Recorrido por cada parte del documento: qué pide la cátedra, qué conservar de la Entrega 5, qué cambiar, qué agregar y de qué archivo del repo sale | Todos |
| `06_Defensa.md` | Guion de demo (< 4 min), carga de datos de demostración, plan de respaldo, checklist del día, video, preguntas del jurado con datos | Defensa del 17/11 (o la fecha que fije la cátedra) |
| `07_Glosario_y_siglas.md` | Glosario, siglas y símbolos (lo escribe otro agente) | Preliminares (glosario/siglas/símbolos) |
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
- Una función puede tener estados distintos por parte: p. ej., bilateral = [S] en lógica y métricas, [H] pendiente hasta la prueba del 6/11 (ver `04_Evidencia_y_pruebas.md`).
- Las magnitudes son **cuentas ADC (0–4095)** sin calibración: nunca escribir «presión», «fuerza», «kg» o «N» como salida del prototipo.
- Diferenciar siempre medición → lectura descriptiva → patrón → recomendación → diagnóstico (el prototipo llega hasta lectura descriptiva; no diagnostica).
- Diferenciar lo demostrado por la literatura, lo demostrado por el prototipo, lo diseñado y lo futuro (instrucciones del proyecto).

## Cómo usar este material para redactar

1. Abrir `05_Mapa_tesis.md` en el apartado a redactar: indica qué pide la cátedra, qué conservar/cambiar de la Entrega 5 y qué archivo consultar.
2. Tomar los datos del archivo fuente indicado (01, 02, 03 o 04) con su estado [H]/[S]/[D]/[F].
3. Para el marco teórico (cap. 3), usar la lista de temas de `05_Mapa_tesis.md` §Cap. 3: cada tema indica qué parte del código lo justifica y qué referencias de la base bibliográfica de Drive existen o faltan.
4. Redactar en primera persona del plural para decisiones propias y en tercera persona/impersonal para literatura (instrucciones del proyecto). Las tesis de referencia sirven de guía de tono, no de fuente.
5. Al terminar un capítulo, revisar contra `01_Especificacion_final.md` (alcance y «qué NO hace») para no prometer funciones no implementadas.
6. Después del 6/11, completar las tablas vacías de `04_Evidencia_y_pruebas.md` y actualizar los estados en 01 y en `08_Alcance_Final_del_Prototipo.md`.

## Pendientes que afectan a estos documentos

- Resultados del 6/11 (H3 de 6 sensores, segundo módulo, bilateral BLE, dos sesiones comparables): actualizan 01, 04, 05 (cap. 7) y 06.
- Entrevista al traumatólogo de rodilla y encuesta breve: actualizan 05 (caps. 2 y 7).
- Costos reales pagados: actualizan 05 (cap. 5).

## Agregado 6/11

- `09_Deudas_y_limitaciones.md`: deudas técnicas y limitaciones conocidas del código, con su estado (corregida / declarar / pendiente). Fuente para los capítulos 6, 7 y 8 y para la pregunta del jurado «¿qué no funcionó?».
