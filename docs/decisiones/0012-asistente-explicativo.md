# ADR 0012 - Asistente explicativo con un modelo de lenguaje (nube gestionada o servidor propio)

- Fecha: 2026-11-04
- Estado: aceptada (prototipo; actualizada el 4/11/2026 con el modo nube; validación con el servicio desplegado pendiente)

## Contexto

El autor quiere, como WHOOP, un asistente que responda preguntas simples sobre los datos del usuario. La guía 03 §15 lo ubicó después del cierre funcional y el cierre del 27/10/2026 (§11) fijó las condiciones: deben existir antes registros, controles de calidad, cálculos verificables y criterios de comparación; la IA no es condición del núcleo ni su justificación; sus funciones son resumir indicadores ya calculados, explicar unidades y límites y preparar texto revisable; la salida distingue observación medida, interpretación y sugerencia generada; no se le atribuyen diagnósticos, recuperación ni instrucciones terapéuticas; se registran entradas, versión, salida y revisión, considerando los datos enviados al proveedor.

Al 4/11/2026 el núcleo está cerrado (etapas 0–13): sesiones físicas con FSR, métricas `desc-1.0`, `dist-1.0` y `bilateral-1.0`, historial, comparación e informe PDF. La PC del autor (Ryzen 9 9900X, 32 GB, RTX 5070 12 GB) puede servir un modelo de 14 B cuantizado con LM Studio.

## Decisión

- **Qué hace:** explica lo que la app ya calculó —sesiones, duración, calidad del registro, indicadores por posición y de reparto, eventos, comparaciones, unidades y límites— en lenguaje llano. **Qué no hace:** no calcula números nuevos, no convierte cuentas ADC a fuerza o presión, no diagnostica, no prescribe, no infiere fatiga, lesión ni rendimiento.
- **Contexto armado localmente.** Antes de cada pregunta la app construye un texto compacto (≈ 2.500 tokens) desde SQLite: las últimas sesiones del usuario activo con fecha, actividad, origen (`physical` / `simulated`, marcado), módulos y posiciones no disponibles, calidad, indicadores, reparto, bloque bilateral y eventos; la sesión que se está mirando, en detalle; la comparación si la hay. No se envían registros crudos ni el correo: la persona se identifica con un seudónimo (`usuario <8 caracteres>` o «usuario de la app»).
- **Filtro previo.** `classifyQuestion` separa lo clínico (diagnóstico, dolor, lesión, tratamiento, medicación, fatiga, rehabilitación…) y lo ajeno a la app; ambos reciben una respuesta fija **sin consultar al modelo**. Así el límite no depende de que el modelo obedezca la instrucción.
- **Dos modos, misma interfaz de cliente** (`createAssistantClient`, transportes `proxy` y `direct`), mismo prompt de sistema y mismos parámetros (temperatura 0,2, 400 tokens de salida, `/no_think`, sin streaming, 60 s de espera). Los bloques `<think>` de los modelos con razonamiento se descartan.
  - **Nube (gestionado), por defecto.** La decisión del 4/11/2026: el asistente tiene que funcionar para cualquier usuario sin configurar nada, y la demostración ocurre en la facultad mientras la PC del autor (de escritorio) queda en su casa. La app llama a la función `assistant` del proyecto de Supabase (`/functions/v1/assistant`) con el token de la cuenta iniciada; la función verifica la cuenta, aplica el prompt de sistema, limita tamaños (1 kB de pregunta, 12 kB de contexto) y cantidad (30 preguntas por usuario y hora, tabla `assistant_usage`, migración 0004) y reenvía a un proveedor compatible con OpenAI definido por secretos del proyecto (`ASSISTANT_BASE_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL`). **La clave del proveedor vive en el backend y nunca en la app.** Proveedor elegido: OpenRouter con `qwen/qwen3-14b`, el mismo modelo que las pruebas locales, para que las respuestas sean comparables; alternativa documentada: OpenAI «mini» (`gpt-4.1-mini` o equivalente) cambiando sólo los secretos. Sin cuenta iniciada, el asistente lo dice y no consulta.
  - **Servidor propio.** API compatible con OpenAI (`GET /v1/models`, `POST /v1/chat/completions`): LM Studio en la PC del autor (Qwen3 14B Q4_K_M, puerto 1234, «Serve on Local Network»), con URL y modelo en Ajustes. Sirve para desarrollo, para comparar respuestas con el modo nube y como opción «los datos no salen de mi red». Requiere teléfono y PC en la misma red.
- **Sin entrenamiento.** El modelo no se entrena ni se ajusta con datos del proyecto: todo lo que sabe de la persona va en el contexto de cada consulta, armado en el teléfono desde SQLite. Es suficiente para explicar lo ya calculado y evita mover datos de usuarios a un proceso de entrenamiento.
- **Presentación.** Botón flotante en Hoy, Historial y Detalle (sólo si está activado en Ajustes); hoja de chat con la conversación en memoria, que se vacía al cerrar. Cada respuesta del modelo lleva el chip «Generado por IA · revisar»; las respuestas fijas no lo llevan porque no son generadas. Nada de esto entra en Grabación.
- **Registro.** Cada intercambio se guarda en SQLite (`assistant_exchange`: pregunta, clasificación, tamaño y resumen del contexto, servidor, modelo, respuesta o error, tiempo) como evidencia para la tesis. No se sincroniza con el servicio remoto.
- **Datos que salen del teléfono.** En ambos modos: la pregunta, el historial corto de la conversación y el contexto (resumen de sesiones con fechas, duración, calidad, indicadores; seudónimo; nunca el correo ni los registros crudos). En el modo nube pasan por la función del proyecto (que registra sólo fecha, cuenta, modelo, tamaños, tiempo y tokens, nunca el texto) y de ahí al proveedor, que aplica su propia política de retención; en el modo servidor propio van al servidor que el usuario configure y no hay terceros. Ajustes lo declara en cada modo.

## Alternativas descartadas

- Modelo embebido en el teléfono: los modelos que entran en un Pixel responden peor en español y el prototipo no necesita funcionar sin la PC para esta función.
- Clave del proveedor en la app (cada usuario pega su clave en Ajustes): obliga a configurar, expone la clave en el teléfono y no sirve para la demostración con profesores. Se descartó el 4/11/2026 a favor de la función gestionada.
- Sólo servidor propio (decisión original del 4/11 por la mañana): no funciona fuera de la red de la PC del autor ni sin su PC; queda como segundo modo.
- Dejar que el modelo decida qué responder sin filtro previo: el límite clínico quedaría sujeto a la obediencia del modelo.

## Consecuencias

- `packages/assistant` (puro: contexto, clasificación, cliente con dos transportes); `supabase/functions/assistant` (función gestionada) y migración 0004 (`assistant_usage`); `apps/mobile`: `assistantStore`, `AssistantFab`, Ajustes → Asistente (selector de modo); `packages/storage` migraciones 4 y 5 (`assistant_exchange` con `mode`).
- Costo del modo nube: pago por uso en el proveedor (del orden de centavos por pregunta con `qwen/qwen3-14b`); el límite por hora acota el gasto. La clave se rota desde los secretos del proyecto sin tocar la app.
- La evaluación del asistente es independiente de la exactitud de los algoritmos numéricos: se mide si explica correctamente lo que figura en el contexto y si rechaza lo clínico, con el registro de intercambios como evidencia.
- Evolución futura: streaming de la respuesta, historial de chat persistente, herramientas de consulta a la base (que el modelo pida datos puntuales en lugar de recibir un resumen fijo), uso del informe PDF como contexto del profesional.
