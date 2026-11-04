# ADR 0012 - Asistente explicativo con un modelo de lenguaje local (LM Studio)

- Fecha: 2026-11-04
- Estado: aceptada (prototipo; validación con el servidor real pendiente)

## Contexto

El autor quiere, como WHOOP, un asistente que responda preguntas simples sobre los datos del usuario. La guía 03 §15 lo ubicó después del cierre funcional y el cierre del 27/10/2026 (§11) fijó las condiciones: deben existir antes registros, controles de calidad, cálculos verificables y criterios de comparación; la IA no es condición del núcleo ni su justificación; sus funciones son resumir indicadores ya calculados, explicar unidades y límites y preparar texto revisable; la salida distingue observación medida, interpretación y sugerencia generada; no se le atribuyen diagnósticos, recuperación ni instrucciones terapéuticas; se registran entradas, versión, salida y revisión, considerando los datos enviados al proveedor.

Al 4/11/2026 el núcleo está cerrado (etapas 0–13): sesiones físicas con FSR, métricas `desc-1.0`, `dist-1.0` y `bilateral-1.0`, historial, comparación e informe PDF. La PC del autor (Ryzen 9 9900X, 32 GB, RTX 5070 12 GB) puede servir un modelo de 14 B cuantizado con LM Studio.

## Decisión

- **Qué hace:** explica lo que la app ya calculó —sesiones, duración, calidad del registro, indicadores por posición y de reparto, eventos, comparaciones, unidades y límites— en lenguaje llano. **Qué no hace:** no calcula números nuevos, no convierte cuentas ADC a fuerza o presión, no diagnostica, no prescribe, no infiere fatiga, lesión ni rendimiento.
- **Contexto armado localmente.** Antes de cada pregunta la app construye un texto compacto (≈ 2.500 tokens) desde SQLite: las últimas sesiones del usuario activo con fecha, actividad, origen (`physical` / `simulated`, marcado), módulos y posiciones no disponibles, calidad, indicadores, reparto, bloque bilateral y eventos; la sesión que se está mirando, en detalle; la comparación si la hay. No se envían registros crudos ni el correo: la persona se identifica con un seudónimo (`usuario <8 caracteres>` o «usuario de la app»).
- **Filtro previo.** `classifyQuestion` separa lo clínico (diagnóstico, dolor, lesión, tratamiento, medicación, fatiga, rehabilitación…) y lo ajeno a la app; ambos reciben una respuesta fija **sin consultar al modelo**. Así el límite no depende de que el modelo obedezca la instrucción.
- **Servidor:** API compatible con OpenAI (`GET /v1/models`, `POST /v1/chat/completions`), sin streaming en esta versión, temperatura 0,2, 400 tokens de salida, tiempo máximo 60 s. LM Studio en la PC del autor, puerto 1234, con «Serve on Local Network»; la URL y el modelo se configuran en Ajustes. Condición de demostración: notebook y teléfono en la misma red (o el teléfono compartiendo su red). Los bloques `<think>` de los modelos con razonamiento se descartan.
- **Presentación.** Botón flotante en Hoy, Historial y Detalle (sólo si está activado en Ajustes); hoja de chat con la conversación en memoria, que se vacía al cerrar. Cada respuesta del modelo lleva el chip «Generado por IA · revisar»; las respuestas fijas no lo llevan porque no son generadas. Nada de esto entra en Grabación.
- **Registro.** Cada intercambio se guarda en SQLite (`assistant_exchange`: pregunta, clasificación, tamaño y resumen del contexto, servidor, modelo, respuesta o error, tiempo) como evidencia para la tesis. No se sincroniza con el servicio remoto.
- **Datos que salen del teléfono.** El contexto viaja al servidor que el usuario configure; Ajustes lo declara. Con LM Studio local no hay terceros; si se apuntara a un servicio en la nube, aplicaría su política.

## Alternativas descartadas

- Modelo embebido en el teléfono: los modelos que entran en un Pixel responden peor en español y el prototipo no necesita funcionar sin la PC para esta función.
- API comercial (OpenAI, Anthropic, Google): costo por uso y datos de sesiones en un tercero; posible como evolución futura con el mismo cliente, cambiando la URL y agregando la clave.
- Dejar que el modelo decida qué responder sin filtro previo: el límite clínico quedaría sujeto a la obediencia del modelo.

## Consecuencias

- `packages/assistant` (puro: contexto, clasificación, cliente); `apps/mobile`: `assistantStore`, `AssistantFab`, Ajustes → Asistente; `packages/storage` migración 4.
- La evaluación del asistente es independiente de la exactitud de los algoritmos numéricos: se mide si explica correctamente lo que figura en el contexto y si rechaza lo clínico, con el registro de intercambios como evidencia.
- Evolución futura: streaming de la respuesta, historial de chat persistente, servidor en la nube con autenticación, uso del informe PDF como contexto del profesional.
