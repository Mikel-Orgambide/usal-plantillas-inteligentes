# ADR 0008 - Complemento remoto: autenticación, titularidad y sincronización

- Fecha: 2026-10-21
- Estado: aceptada (ADR 0003 pasa de «propuesta» a aplicada en lo que respecta a Supabase)

## Contexto

La guía (03 §14) pide, una vez cerrada la ejecución local, un complemento remoto con autenticación, políticas por titularidad y sincronización con confirmación y reintentos, sin que la pérdida de Internet quite acceso a lo local. El autor pidió autenticación con correo y contraseña y, si es viable, con Google.

## Decisión

**Servicio.** Supabase (ADR 0003): PostgreSQL con RLS, Auth y PostgREST. La app sólo lleva la URL y la clave publicable (`EXPO_PUBLIC_*`); la clave secreta no existe en el repositorio ni en el paquete.

**Autenticación.** Correo y contraseña con Supabase Auth, desde la app (`apps/mobile/src/application/authStore.ts`). La sesión se guarda en el almacén clave-valor local y el token se renueva en primer plano. Google queda como segunda fase: en Android exige un cliente OAuth en Google Cloud con el SHA-1 del keystore de EAS y una build de desarrollo nueva; se documenta en la etapa 11 como pendiente y no bloquea el cierre.

**Titularidad local.** La primera cuenta que inicia sesión en un teléfono adopta al usuario local `local` y, con él, las sesiones grabadas antes de tener cuenta. Una segunda cuenta obtiene un usuario local propio. Una sesión conserva su titular aunque se cambie de cuenta: sólo se sincronizan las sesiones cuyo usuario local está vinculado a la cuenta activa (`SessionRepository.linkRemoteUser`, `listSessionsPendingSync`).

**Una cuenta por vez en la app.** Inicio, Historial y comparación muestran únicamente las sesiones del usuario local activo (la cuenta con sesión iniciada o `local` sin cuenta). Las sesiones de otras cuentas no se borran ni se reasignan: siguen en el teléfono, se indican como «De otra cuenta» si se abren por enlace y reaparecen al volver a entrar con su cuenta. Así la cuenta se comporta como un perfil de usuario sin que la app deje de ser local primero.

**Esquema remoto** (`supabase/migrations/0001_remote_schema.sql`). Tablas `session`, `capture`, `record`, `event`, `result`, todas con `owner_id = auth.uid()` y RLS para `authenticated`; `anon` sin privilegios. Mismas claves que la base local: sesión por su uuid; captura por sesión + id externo; registro por captura + secuencia; evento por sesión + id local; resultado por captura + canal + versión de métrica. La configuración viaja completa en JSON dentro de la sesión y las seis muestras de cada registro van como JSON dentro del registro: la copia remota es una copia para consulta e historial, no reemplaza a la base local como fuente de análisis. Sin borrados remotos ni resolución automática de conflictos (02 §12).

**Protocolo de transferencia** (`packages/sync`). Tres funciones RPC con `security invoker` (las políticas se aplican con los permisos de quien llama): `sync_session_begin` (sesión y capturas; devuelve los ids remotos de las capturas), `sync_records` (lotes de 250 registros, `on conflict do nothing`), `sync_session_finish` (eventos y resultados; devuelve las cantidades que el servidor tiene realmente). Cada llamada se reintenta hasta tres veces con espera creciente ante fallas transitorias; un rechazo del servidor (titularidad, datos inválidos) no se reintenta.

**Confirmación.** Una sesión se marca `confirmed` únicamente si las cantidades informadas por `sync_session_finish` coinciden con las locales (capturas, registros, eventos, resultados). Un HTTP 200 no confirma nada; una diferencia deja la sesión `pending` con el detalle. El estado vive en la tabla local `sync_state` (migración 3) con intentos y último error.

**Cuándo se sincroniza.** Al cerrar una sesión, si hay cuenta, en segundo plano; además, a pedido desde Ajustes («Sincronizar ahora», todas las pendientes) y desde el detalle de la sesión. Sin cuenta o sin red la app funciona igual y lo pendiente espera.

## Consecuencias

- Verificable sin servidor: `packages/sync/test` reproduce con un remoto falso las reglas del esquema (idempotencia, reintentos, confirmación incierta, dos cuentas, cambio de cuenta); `supabase/tests/check-rls.sql` ejercita la migración real en un PostgreSQL local con una imitación mínima de `auth.uid()`; `scripts/remote-check.mjs` repite el guion contra el proyecto real con dos cuentas de prueba.
- El tamaño de cada sesión remota es del orden del paquete de respaldo (unos 400 bytes por registro): una sesión de diez minutos a 20 reg/s ocupa unos 5 MB en PostgreSQL. El plan gratuito (500 MB) alcanza para la tesis; el límite se documenta.
- La cuenta no se usa para nada más: no hay perfil, ni roles, ni compartir sesiones entre cuentas.
- Evolución futura: descarga inversa (al iniciar sesión en un teléfono nuevo, traer del servidor las sesiones de la cuenta que no estén en la base local). Requiere definir la semántica de conflictos entre copia local y remota (02 §12); hasta entonces la copia remota se consulta desde el panel y el respaldo por archivo (ADR 0007) cubre el cambio de teléfono.
- Pendiente: inicio de sesión con Google (ver etapa 11), recuperación de contraseña (se hace desde el panel de Supabase mientras tanto) y un historial remoto consultable fuera del teléfono (vista `session_summary` ya creada para un panel futuro).
