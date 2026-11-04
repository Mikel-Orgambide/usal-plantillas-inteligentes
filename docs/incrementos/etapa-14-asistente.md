# Etapa 14 - Asistente explicativo (LM Studio)

- Fecha: 2026-11-04 · versión de la app 0.14.0 · ADR 0012
- Estado: **implementado**; pendiente de validar con el servidor real (LM Studio en la PC del autor) y de registrar intercambios de muestra.

## Qué se implementó

- `packages/assistant`: `buildAssistantContext` (texto compacto desde los datos ya calculados: sesiones recientes, seleccionada, comparación, bilateral; recorte por espacio; origen simulado marcado; sin correo ni registros crudos), `classifyQuestion` + `FIXED_ANSWERS` (clínico y ajeno → respuesta fija sin modelo), `createAssistantClient` (API compatible con OpenAI, sin streaming, tiempo máximo, errores con código `network | timeout | http | invalid_response | no_model`, descarte de bloques `<think>`). 10 pruebas.
- `packages/storage`: migración 4, tabla `assistant_exchange` y `addAssistantExchange` / `listAssistantExchanges` / `countAssistantExchanges` (1 prueba nueva; las de migración se actualizaron a la versión 4).
- App: `application/assistantStore.ts` (arma el contexto desde SQLite para el usuario activo, clasifica, consulta, registra; conversación en memoria), `presentation/components/AssistantFab.tsx` (botón flotante + hoja de chat con chip «Generado por IA · revisar», sugerencias iniciales, errores traducidos), `app/ajustes/asistente.tsx` (URL, modelo, «Probar conexión» contra `/v1/models`, interruptor), fila «Asistente» en Ajustes. Botón en Hoy, Historial y Detalle (el detalle entra en el contexto). Íconos `spark` y `send`.

## Cómo probar (Mikel)

1. **LM Studio** en la PC: bajar un modelo (previsto Qwen3 14B Q4_K_M; cabe en la RTX 5070 de 12 GB), pestaña **Developer** → cargar el modelo → servidor **Running** → activar **Serve on Local Network** (puerto 1234). Permitir en el firewall para redes privadas.
2. En PowerShell, comprobar: `curl.exe http://localhost:1234/v1/models` y una pregunta con `curl.exe http://localhost:1234/v1/chat/completions -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Decime hola en una línea\"}]}"`.
3. IP de la PC: `ipconfig` → «Dirección IPv4» del Wi-Fi (p. ej. `192.168.0.140`). Teléfono en la misma red.
4. App (build 0.14.0): Ajustes → **Asistente** → URL `http://<ip>:1234` → **Probar conexión** (debe listar el modelo) → activar el botón flotante.
5. Preguntas en alcance: «¿Qué pasó en mi última sesión?», «¿Cuál fue el máximo del talón izquierdo en la sesión del 3/11?», «¿Por qué el pie derecho dice n/d?», «¿Qué significa el reparto antepié/talón?». Fuera de alcance (respuesta fija, sin modelo): «¿Tengo fascitis?», «¿Qué ejercicio me recomendás?», «¿Quién es el presidente?».
6. Comprobar que cada respuesta del modelo lleve el chip «Generado por IA · revisar», que cite sesión y fecha, que no convierta cuentas a fuerza y que diga «no tengo ese dato» cuando corresponda.

## Evidencia a guardar

- Capturas: Ajustes → Asistente con la prueba de conexión en verde; una respuesta en alcance con el chip; una respuesta fija a una pregunta clínica.
- Exportar el registro de intercambios: `SELECT * FROM assistant_exchange` desde un respaldo de la base (Ajustes → Respaldo) y guardarlo en `test-data/asistente/`.
- Anotar modelo, cuantización, tiempos de respuesta observados y errores.

## Limitaciones

- Sin streaming: la respuesta aparece completa (varios segundos con 14 B).
- El contexto describe hasta 8 sesiones recientes además de la seleccionada; preguntas sobre sesiones más antiguas se responden «no tengo ese dato» salvo que se abran desde su Detalle.
- El filtro clínico es por patrones en español; una pregunta clínica formulada de otro modo puede llegar al modelo, que además recibe la instrucción de rechazarla.
- Requiere la PC en la misma red; no funciona sin ella (declarado en Ajustes y en la tesis).
