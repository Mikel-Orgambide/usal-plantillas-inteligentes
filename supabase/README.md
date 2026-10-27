# Esquema remoto (Supabase)

- `migrations/`: se aplican en orden, una sola vez cada una, en el *SQL Editor* del proyecto (o con `supabase db push`).
  - `0001_remote_schema.sql`: tablas con titular, RLS, funciones de sincronización, vista `session_summary`.
  - `0002_grants_authenticated.sql`: privilegios de tabla para el rol `authenticated` (sin ellos la app recibe `permission denied`).
- `tests/`: verificación en un PostgreSQL local sin Supabase. `auth-shim.sql` imita `auth.uid()` y los roles; `check-rls.sql` ejercita dos cuentas, repetición y acceso anónimo. Resultado guardado en `test-data/remote/`.

```bash
createdb t && psql -d t -v ON_ERROR_STOP=1 -f tests/auth-shim.sql -f migrations/0001_remote_schema.sql -f migrations/0002_grants_authenticated.sql
psql -d t -f tests/check-rls.sql
```

Contra el proyecto real, con dos cuentas de prueba: `node scripts/remote-check.mjs` (ver `docs/guia-arranque-y-pruebas.md` §5b).
