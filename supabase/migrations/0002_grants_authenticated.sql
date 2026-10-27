-- Complemento remoto (etapa 11) — permisos del rol `authenticated`.
--
-- La migración 0001 definió las políticas de titularidad (RLS) pero asumió
-- que las tablas nuevas recibían los privilegios de tabla para
-- `authenticated` por defecto. En el proyecto real no fue así: la app
-- recibía «permission denied for table session» (2026-10-27). RLS filtra
-- filas; los privilegios de tabla se conceden aparte y ambos hacen falta.
-- Las funciones de sincronización son SECURITY INVOKER, así que corren con
-- estos privilegios y con las políticas de quien llama.

grant usage on schema public to authenticated;

grant select, insert, update on public.session to authenticated;
grant select, insert, update on public.capture to authenticated;
grant select, insert, update on public.record  to authenticated;
grant select, insert, update on public.event   to authenticated;
grant select, insert, update on public.result  to authenticated;
grant select on public.session_summary to authenticated;

-- Las claves `generated always as identity` usan secuencias: insertar exige USAGE sobre ellas.
grant usage, select on all sequences in schema public to authenticated;

-- Sin DELETE: no hay borrados remotos (02 §12). `anon` sigue sin privilegios (0001).
revoke delete on all tables in schema public from authenticated;
