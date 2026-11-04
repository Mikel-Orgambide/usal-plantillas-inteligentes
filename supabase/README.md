# Esquema remoto (Supabase)

- `migrations/`: se aplican en orden, una sola vez cada una, en el *SQL Editor* del proyecto (o con `supabase db push`).
  - `0001_remote_schema.sql`: tablas con titular, RLS, funciones de sincronización, vista `session_summary`.
  - `0002_grants_authenticated.sql`: privilegios de tabla para el rol `authenticated` (sin ellos la app recibe `permission denied`).
  - `0003_session_configurations.sql`: configuraciones de todos los módulos de una sesión (etapa 13, ADR 0011); `sync_session_finish` devuelve `configurations` y la app la exige para confirmar.
  - `0004_assistant_usage.sql`: registro de uso de la función del asistente (etapa 14, ADR 0012): límite por hora y evidencia; sólo el rol de servicio escribe.
- `functions/assistant/`: Edge Function del asistente explicativo (modo nube). Verifica la cuenta, aplica el prompt, limita y reenvía al proveedor compatible con OpenAI de los secretos. **La clave del proveedor vive en los secretos del proyecto, nunca en el repo ni en la app.** Despliegue, desde la raíz del repo con la CLI de Supabase (`supabase login`, `supabase link --project-ref <ref>`):

  ```
  supabase secrets set ASSISTANT_API_KEY=sk-or-... ASSISTANT_BASE_URL=https://openrouter.ai/api/v1 ASSISTANT_MODEL=qwen/qwen3-14b
  supabase functions deploy assistant
  ```

  Alternativa por panel: Project Settings → Edge Functions → Secrets, y Edge Functions → Deploy (pegar `index.ts`). Variables opcionales: `ASSISTANT_HOURLY_LIMIT` (30), `ASSISTANT_REFERER`, `ASSISTANT_TITLE`. Prueba con `curl` en `docs/incrementos/etapa-14-asistente.md`.
- `tests/`: verificación en un PostgreSQL local sin Supabase. `auth-shim.sql` imita `auth.uid()` y los roles; `check-rls.sql` ejercita dos cuentas, repetición y acceso anónimo. Resultado guardado en `test-data/remote/`.

```bash
createdb t && psql -d t -v ON_ERROR_STOP=1 -f tests/auth-shim.sql -f migrations/0001_remote_schema.sql -f migrations/0002_grants_authenticated.sql -f migrations/0003_session_configurations.sql -f migrations/0004_assistant_usage.sql
psql -d t -f tests/check-rls.sql
psql -d t -f tests/check-bilateral.sql
```

Contra el proyecto real, con dos cuentas de prueba: `node scripts/remote-check.mjs` (ver `docs/guia-arranque-y-pruebas.md` §5b).
