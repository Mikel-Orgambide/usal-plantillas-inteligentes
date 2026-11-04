# Esquema remoto (Supabase)

- `migrations/`: se aplican en orden, una sola vez cada una, en el *SQL Editor* del proyecto (o con `supabase db push`).
  - `0001_remote_schema.sql`: tablas con titular, RLS, funciones de sincronización, vista `session_summary`.
  - `0002_grants_authenticated.sql`: privilegios de tabla para el rol `authenticated` (sin ellos la app recibe `permission denied`).
  - `0003_session_configurations.sql`: configuraciones de todos los módulos de una sesión (etapa 13, ADR 0011); `sync_session_finish` devuelve `configurations` y la app la exige para confirmar.
- `tests/`: verificación en un PostgreSQL local sin Supabase. `auth-shim.sql` imita `auth.uid()` y los roles; `check-rls.sql` ejercita dos cuentas, repetición y acceso anónimo. Resultado guardado en `test-data/remote/`.

```bash
createdb t && psql -d t -v ON_ERROR_STOP=1 -f tests/auth-shim.sql -f migrations/0001_remote_schema.sql -f migrations/0002_grants_authenticated.sql -f migrations/0003_session_configurations.sql
psql -d t -f tests/check-rls.sql
psql -d t -f tests/check-bilateral.sql
```

Contra el proyecto real, con dos cuentas de prueba: `node scripts/remote-check.mjs` (ver `docs/guia-arranque-y-pruebas.md` §5b).
