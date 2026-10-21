# Etapa 11 - Complemento remoto (autenticación y sincronización)

- Fecha de implementación: 2026-10-21
- Fecha de cierre: pendiente (falta la verificación en el teléfono y contra el proyecto real)
- Tag: -
- Especificación: `docs/especificacion/03` §14, `02` §12, `05` §5. Decisión: ADR 0008 (y ADR 0003).

## Qué se implementó

- **Esquema remoto** en Supabase (`supabase/migrations/0001_remote_schema.sql`): tablas con titular y RLS, `anon` sin acceso, tres funciones RPC de sincronización con `security invoker`, vista `session_summary`.
- **Base local, migración 3**: `user.email`, índice único por `remote_id`, tabla `sync_state` (estado, intentos, cantidades confirmadas, último error).
- **`@plantillas/sync`**: `syncSession` / `syncPendingSessions` sobre una interfaz `RemoteGateway`; lotes de 250 registros; reintentos (3, espera creciente) sólo ante fallas transitorias; confirmación únicamente si las cantidades del servidor coinciden con las locales.
- **App**: cliente de Supabase con sesión persistida; `authStore` (correo y contraseña: iniciar sesión, crear cuenta, cerrar sesión; vinculación del usuario local); `syncStore` (pendientes, progreso, última corrida); Ajustes → **Cuenta** (iniciar sesión / crear cuenta, sincronizar ahora, cerrar sesión); chip de sincronización en el detalle de la sesión («Sincronizada», «Sincronizar», «Reintentar sincronización», «Sólo en este teléfono»); sincronización automática al cerrar una sesión cuando hay cuenta.
- **Titularidad**: las sesiones nuevas se atribuyen al usuario local vinculado a la cuenta activa; sin cuenta, a `local`. La primera cuenta adopta `local`; una segunda obtiene usuario propio; cambiar de cuenta no reasigna pendientes.
- **Verificación reproducible**: `supabase/tests/check-rls.sql` (PostgreSQL local) y `scripts/remote-check.mjs` (proyecto real, dos cuentas).

## Pruebas

`npm test`: 115 (12 nuevas: `storage/test/sync-state.test.ts` ×4, `sync/test/sync.test.ts` ×8). Casos de 05 §5 cubiertos con el remoto falso: transferencia confirmada por cantidades y en lotes; repetida sin duplicar; reintento con los mismos identificadores; agotamiento de reintentos → `failed` y sigue pendiente, la sesión local sigue disponible; confirmación con cantidades distintas → `pending`; dos cuentas (cada una ve lo suyo, el id de la otra se rechaza y no se reintenta); cambio de cuenta no reasigna; no se transfieren sesiones abiertas, sin cuenta ni sin capturas.

**Esquema real en PostgreSQL 16 local** (`test-data/remote/check-rls-2026-10-21-postgres16-local.txt`): anónimo sin lectura ni RPC; cuenta A transfiere (2 registros, 2 eventos, 1 resultado) y la repetición devuelve `inserted 0` y las mismas cantidades; cuenta B no ve filas de A, no puede reutilizar `S1` (violación de RLS), no puede escribir en la captura de A y sí transfiere `S2`; A sigue viendo sólo `S1`.

Typecheck sin errores; `npx expo export --platform android` sin errores con `@supabase/supabase-js` 2.118 y `react-native-url-polyfill` 4 (sin módulos nativos nuevos: no hace falta otra build).

## Verificación en dispositivo

Pendiente. Guion (ver `docs/guia-arranque-y-pruebas.md` § Complemento remoto):

1. Aplicar la migración en el proyecto de Supabase y desactivar la confirmación por correo.
2. `npm install`; iniciar Metro con el `.env`; en Ajustes → Cuenta crear la cuenta A.
3. Sincronizar ahora → N sesiones confirmadas; detalle muestra «Sincronizada»; en el panel de Supabase, `session_summary` con las mismas cantidades.
4. Repetir «Sincronizar ahora» → «Nada pendiente»; volver a sincronizar una desde el detalle → cantidades iguales.
5. Modo avión: grabar y cerrar una sesión → queda pendiente con el error; el historial y el detalle siguen accesibles; con red, reintentar → confirmada.
6. Cerrar sesión; crear la cuenta B; las sesiones de A no aparecen como pendientes; grabar una con B; `remote-check.mjs` confirma la separación.
7. Build preview nueva con las variables de EAS para que la demo no dependa de Metro.

## Limitaciones

- Inicio de sesión con Google no implementado (segunda fase, requiere cliente OAuth y build nueva).
- No hay recuperación de contraseña en la app.
- Sin consulta del historial remoto desde la app: la copia remota sirve para respaldo consultable y para un panel futuro.
- Sin detección de conectividad: se intenta y, si falla, queda registrado y pendiente.
- Plan gratuito de Supabase: el proyecto se pausa tras una semana sin uso; reactivarlo desde el panel antes de la demostración.
