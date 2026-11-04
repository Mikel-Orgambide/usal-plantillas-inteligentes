# Etapa 14 - Asistente explicativo (nube gestionada o servidor propio)

- Fecha: 2026-11-04 · versión de la app 0.14.1 · ADR 0012
- Estado: **implementado** en dos modos; pendiente de desplegar la función y validar con el servicio real y con LM Studio, y de registrar intercambios de muestra.

## Qué se implementó

- `packages/assistant`: `buildAssistantContext` (texto compacto desde los datos ya calculados: sesiones recientes, seleccionada, comparación, bilateral; recorte por espacio; origen simulado marcado; sin correo ni registros crudos), `classifyQuestion` + `FIXED_ANSWERS` (clínico y ajeno → respuesta fija sin modelo), `createAssistantClient` (API compatible con OpenAI, sin streaming, tiempo máximo, errores con código `network | timeout | http | invalid_response | no_model`, descarte de bloques `<think>`). 10 pruebas.
- `packages/storage`: migración 4, tabla `assistant_exchange` y `addAssistantExchange` / `listAssistantExchanges` / `countAssistantExchanges` (1 prueba nueva; las de migración se actualizaron a la versión 4).
- **Modo nube (4/11, tarde).** Decisión de Mikel: el asistente debe funcionar para cualquier usuario sin configurar nada, con la clave del proveedor en el backend (la PC con LM Studio queda en su casa; la demo es en la facultad).
  - `supabase/functions/assistant/index.ts` (Edge Function, Deno): verifica el token de la cuenta (`auth.getUser`; anónimos 401), aplica el mismo prompt de sistema, limita pregunta (1 kB), contexto (12 kB) e historial (8 turnos), límite de 30 preguntas por usuario y hora (configurable), reenvía al proveedor compatible con OpenAI de los secretos (`ASSISTANT_BASE_URL` → OpenRouter, `ASSISTANT_MODEL` → `qwen/qwen3-14b`, `ASSISTANT_API_KEY`), descarta `<think>`, devuelve `{ answer, model, elapsed_ms, prompt_tokens?, completion_tokens? }` y errores `{ error: { code, message } }` (400/401/413/429/502/504). `GET` devuelve el modelo configurado (prueba de conexión). Registra en `assistant_usage` fecha, cuenta, modelo, tamaños, tiempo y tokens; nunca el texto.
  - `supabase/migrations/0004_assistant_usage.sql`: tabla `assistant_usage` (sólo el rol de servicio escribe; el usuario lee las suyas; anónimos sin acceso) y función `assistant_usage_last_hour()`.
  - `packages/assistant`: `createAssistantClient` con dos transportes: `direct` (el anterior, LM Studio) y `proxy` (`/functions/v1/assistant` con `Authorization: Bearer <token>` y `apikey`); mismos `ask` / `listModels`; códigos nuevos `unauthorized` y `rate_limited`. 13 pruebas (3 nuevas con fetch falso para el proxy).
  - `packages/storage`: migración 5, columna `assistant_exchange.mode` (`cloud` | `local`).
  - App: `assistantMode` en Ajustes (por defecto `cloud`; el botón flotante viene activado); el modo nube usa la cuenta iniciada (sin cuenta, lo dice); «Probar conexión» funciona en ambos; errores traducidos por modo; `mas.tsx` muestra el modo.
- App: `application/assistantStore.ts` (arma el contexto desde SQLite para el usuario activo, clasifica, consulta, registra; conversación en memoria), `presentation/components/AssistantFab.tsx` (botón flotante + hoja de chat con chip «Generado por IA · revisar», sugerencias iniciales, errores traducidos), `app/ajustes/asistente.tsx` (URL, modelo, «Probar conexión» contra `/v1/models`, interruptor), fila «Asistente» en Ajustes. Botón en Hoy, Historial y Detalle (el detalle entra en el contexto). Íconos `spark` y `send`.

## Cómo desplegar el modo nube (Mikel, una vez)

1. **OpenRouter**: crear cuenta en openrouter.ai, cargar el crédito mínimo (USD 5 alcanza para cientos de preguntas con `qwen/qwen3-14b`), **Keys → Create key** y copiarla (empieza con `sk-or-`). Alternativa: OpenAI con `ASSISTANT_BASE_URL=https://api.openai.com/v1` y `ASSISTANT_MODEL=gpt-4.1-mini`.
2. **Supabase**, SQL Editor: ejecutar `supabase\migrations\0004_assistant_usage.sql` (después de 0003).
3. **CLI de Supabase** en la PC (una vez): `npm install -g supabase` (o `scoop install supabase`), `supabase login` (abre el navegador), y en `C:\Proyecto Final Tesis\repo`: `supabase link --project-ref lvctmafqmrngqwxcidjw`.
4. **Secretos** (la clave nunca va al repo ni a la app):
   ```
   supabase secrets set ASSISTANT_API_KEY=sk-or-... ASSISTANT_BASE_URL=https://openrouter.ai/api/v1 ASSISTANT_MODEL=qwen/qwen3-14b
   ```
   Alternativa por panel: Project Settings → Edge Functions → Secrets.
5. **Desplegar**: `supabase functions deploy assistant`. Debe aparecer en el panel, sección Edge Functions. (La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta sola.)
6. **Probar con curl** (PowerShell) con el token de un usuario. Obtener el token iniciando sesión por la API:
   ```
   curl.exe -s -X POST "https://lvctmafqmrngqwxcidjw.supabase.co/auth/v1/token?grant_type=password" -H "apikey: <PUBLISHABLE_KEY>" -H "Content-Type: application/json" -d "{\"email\":\"<tu mail>\",\"password\":\"<tu clave>\"}"
   ```
   Copiar `access_token` de la respuesta y:
   ```
   curl.exe -s "https://lvctmafqmrngqwxcidjw.supabase.co/functions/v1/assistant" -H "apikey: <PUBLISHABLE_KEY>" -H "Authorization: Bearer <ACCESS_TOKEN>"
   curl.exe -s -X POST "https://lvctmafqmrngqwxcidjw.supabase.co/functions/v1/assistant" -H "apikey: <PUBLISHABLE_KEY>" -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"question\":\"¿Qué pasó en mi última sesión?\",\"context\":\"Sesiones registradas: 1. Sesión del 3/11 17:44, caminata, señal física, talón izquierdo máximo 3909 cuentas.\"}"
   ```
   El GET devuelve `{"model":"qwen/qwen3-14b",...}`; el POST, `{"answer":"...","model":...}`. Sin `Authorization` → 401; 31 preguntas en una hora → 429.
7. **Build** preview 0.14.1 (`cd apps\mobile; eas build --profile preview --platform android`), `adb install -r`. En la app, con la cuenta iniciada: Ajustes → Asistente → modo **Nube** → **Probar conexión** → debe mostrar el modelo. Nadie más tiene que configurar nada.

## Cómo probar el modo servidor propio (Mikel)

1. **LM Studio** en la PC: bajar un modelo (previsto Qwen3 14B Q4_K_M; cabe en la RTX 5070 de 12 GB), pestaña **Developer** → cargar el modelo → servidor **Running** → activar **Serve on Local Network** (puerto 1234). Permitir en el firewall para redes privadas.
2. En PowerShell, comprobar: `curl.exe http://localhost:1234/v1/models` y una pregunta con `curl.exe http://localhost:1234/v1/chat/completions -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Decime hola en una línea\"}]}"`.
3. IP de la PC: `ipconfig` → «Dirección IPv4» del Wi-Fi (p. ej. `192.168.0.140`). Teléfono en la misma red.
4. App: Ajustes → **Asistente** → modo **Servidor propio** → URL `http://<ip>:1234` → **Probar conexión** (debe listar el modelo).
5. Preguntas en alcance: «¿Qué pasó en mi última sesión?», «¿Cuál fue el máximo del talón izquierdo en la sesión del 3/11?», «¿Por qué el pie derecho dice n/d?», «¿Qué significa el reparto antepié/talón?». Fuera de alcance (respuesta fija, sin modelo): «¿Tengo fascitis?», «¿Qué ejercicio me recomendás?», «¿Quién es el presidente?».
6. Comprobar que cada respuesta del modelo lleve el chip «Generado por IA · revisar», que cite sesión y fecha, que no convierta cuentas a fuerza y que diga «no tengo ese dato» cuando corresponda.

## Ajustes del 4/11 (versión 0.14.3)

Tras las primeras pruebas de Mikel (modo servidor propio con Qwen3 14B en LM Studio):

- **Respuestas demasiado restrictivas** («¿Esto qué significa?» → «no interpreto significados»): prompt en tres niveles y ficha de conocimiento (ADR 0012, ajuste del 4/11). La clasificación previa deja pasar las preguntas de lectura y los consejos sobre el registro.
- **Horas**: las sesiones citadas como «3/11 22:57» y «23:06» se revisaron. El formato usaba la hora local del motor, no UTC; lo que faltaba era declarar la zona y dar una forma corta para citar. Ahora el contexto usa explícitamente la zona del teléfono (`Intl`, con respaldo a la hora local) y la dice. Si esas horas no corresponden a sesiones reales, revisar en Historial qué sesiones hay después de las 17:45 del 3/11 (las de prueba de la noche, con la app 0.12/0.13).
- **«media 0» en un canal**: el contexto ya separaba «no disponible» (no instrumentado). Una media 0 con máximo 0 es una lectura real (el sensor no recibió carga); ahora se dice así explícitamente.
- **Comparación**: el contexto trae una comparación precalculada con la anterior comparable (misma configuración y origen), o el motivo por el que no lo es.
- **Chat**: pantalla completa como modal (ruta `/asistente`), por encima de la barra inferior, con fondo propio, teclado sin tapar la barra de texto, cabecera con la sesión y el modo, sugerencias, indicador de escritura y «Reintentar».
- **Prompt compartido** con la función gestionada (`scripts/sync-assistant-prompt.mjs` → `supabase/functions/_shared/assistant-prompt.ts`): hay que **volver a desplegar** la función (`supabase functions deploy assistant`).

Preguntas de prueba para la evidencia (en los dos modos, desde el Detalle de la sesión `ca49daed` y desde Hoy):

| Nivel | Pregunta | Esperado |
|---|---|---|
| 1 | «¿Cuál fue el máximo del talón?» | número y sesión con hora local («3/11 17:44») |
| 2 | «¿Qué cambió respecto de la anterior?» y luego «¿Esto qué significa?» | diferencias precalculadas y una lectura en términos del apoyo, con posibles causas no clínicas |
| 2 | «¿Qué puedo mejorar para comparar las sesiones?» | sugerencias de protocolo (misma tarea, configuración, duración) |
| 2 | «¿Por qué el pie derecho dice n/d?» | no instrumentado en esa configuración |
| 3 | «¿Tengo una lesión en el talón?», «¿Es normal este valor?» | respuesta fija, sin consultar al modelo (no aparece en los logs de LM Studio) |

## Evidencia a guardar

- Capturas: Ajustes → Asistente con la prueba de conexión en verde en cada modo; una respuesta en alcance con el chip; una respuesta fija a una pregunta clínica; la misma pregunta respondida en los dos modos (mismo modelo, Qwen3 14B) para comparar.
- Uso del servicio: `select * from assistant_usage order by asked_at desc` en el SQL Editor; guardar el CSV en `test-data/asistente/`.
- Exportar el registro de intercambios: `SELECT * FROM assistant_exchange` desde un respaldo de la base (Ajustes → Respaldo) y guardarlo en `test-data/asistente/`.
- Anotar modelo, cuantización, tiempos de respuesta observados y errores.

## Limitaciones

- Sin streaming: la respuesta aparece completa (varios segundos con 14 B).
- El contexto describe hasta 8 sesiones recientes además de la seleccionada; preguntas sobre sesiones más antiguas se responden «no tengo ese dato» salvo que se abran desde su Detalle.
- El filtro clínico es por patrones en español; una pregunta clínica formulada de otro modo puede llegar al modelo, que además recibe la instrucción de rechazarla.
- Modo servidor propio: requiere la PC en la misma red. Modo nube: requiere cuenta iniciada e internet; el contexto pasa por un proveedor externo (declarado en Ajustes y en la tesis); costo por uso acotado por el límite de 30 preguntas por hora.
- La función y el paquete comparten el prompt de sistema por copia (`supabase/functions/assistant/index.ts` y `packages/assistant/src/prompt.ts`): si cambia uno, cambiar el otro.
