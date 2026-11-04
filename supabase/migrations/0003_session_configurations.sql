-- Sesión bilateral (etapa 13, ADR 0011) — configuraciones de todos los módulos.
-- Ejecutar una vez en el SQL Editor del proyecto, después de 0001 y 0002.
--
-- Hasta aquí `session` guardaba una sola configuración (la del primer
-- módulo). Con dos ESP32 (uno por pie) cada captura pertenece a un módulo
-- distinto y el servidor debe conservar las dos configuraciones para
-- interpretar los registros sin la base local. `session.configuration`
-- sigue existiendo (primer módulo, compatibilidad con lo ya subido);
-- `session_configuration` lista todas, con el pie y el orden.
--
-- Mismos principios que 0001/0002: titular por fila, RLS, privilegios de
-- tabla para `authenticated`, sin borrados, funciones SECURITY INVOKER.
-- `sync_session_finish` ahora devuelve también `configurations`, y la app
-- sólo confirma la sesión si esa cantidad coincide con la local.

create table public.session_configuration (
  id                bigint generated always as identity primary key,
  session_id        text not null references public.session (id) on delete cascade,
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position          integer not null check (position >= 0),
  device_id         text not null,
  configuration_id  text not null,
  foot              text check (foot in ('left', 'right', 'both')),
  source            text not null check (source in ('simulated', 'physical')),
  channels          jsonb not null,
  configuration     jsonb not null,
  unique (session_id, device_id),
  unique (session_id, position)
);
create index session_configuration_session_idx on public.session_configuration (session_id, position);

alter table public.session_configuration enable row level security;
create policy session_configuration_owner on public.session_configuration for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.session_configuration from anon;
grant select, insert, update on public.session_configuration to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke delete on public.session_configuration from authenticated;

-- Pie que instrumenta una configuración, deducido de sus códigos de canal.
create or replace function public.configuration_foot(p_configuration jsonb)
returns text
language sql
immutable
as $$
  select case
    when bool_and(c->>'code' like 'L\_%') then 'left'
    when bool_and(c->>'code' like 'R\_%') then 'right'
    else 'both'
  end
  from jsonb_array_elements(coalesce(p_configuration->'channels', '[]'::jsonb)) as c;
$$;

-- Las sesiones ya subidas pasan a tener su único módulo listado.
insert into public.session_configuration (session_id, owner_id, position, device_id, configuration_id, foot, source, channels, configuration)
select s.id, s.owner_id, 0, s.device_id, s.configuration_id, public.configuration_foot(s.configuration), s.source,
       coalesce((select jsonb_agg(c->>'code') from jsonb_array_elements(s.configuration->'channels') as c), '[]'::jsonb), s.configuration
from public.session s
on conflict (session_id, device_id) do nothing;

-- Paso 1 (reemplaza al de 0001): la cabecera trae `configurations` (todas, el primer módulo primero).
-- Si falta (app anterior), se usa `configuration` como único módulo.
create or replace function public.sync_session_begin(p_session jsonb, p_captures jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id text := p_session->>'id';
  v_out jsonb := '{}'::jsonb;
  v_cap jsonb;
  v_cap_id bigint;
  v_cfg jsonb;
  v_pos integer := 0;
  v_cfgs jsonb;
begin
  if auth.uid() is null then
    raise exception 'sin sesión autenticada' using errcode = '42501';
  end if;
  if v_id is null or p_session->>'configuration' is null then
    raise exception 'cabecera incompleta: faltan id o configuración' using errcode = '22023';
  end if;

  insert into session (id, activity, context, source, state, started_at, ended_at, duration_ms, created_at, updated_at,
                       device_id, configuration_id, configuration, schema_version)
  values (v_id, p_session->>'activity', p_session->>'context', p_session->>'source', p_session->>'state',
          (p_session->>'started_at')::timestamptz, (p_session->>'ended_at')::timestamptz, (p_session->>'duration_ms')::integer,
          (p_session->>'created_at')::timestamptz, (p_session->>'updated_at')::timestamptz,
          p_session->>'device_id', p_session->>'configuration_id', p_session->'configuration', (p_session->>'schema_version')::integer)
  on conflict (id) do update set
    state = excluded.state, ended_at = excluded.ended_at, duration_ms = excluded.duration_ms, updated_at = excluded.updated_at,
    context = excluded.context, configuration = excluded.configuration, schema_version = excluded.schema_version;

  v_cfgs := coalesce(p_session->'configurations', jsonb_build_array(p_session->'configuration'));
  for v_cfg in select * from jsonb_array_elements(v_cfgs) loop
    insert into session_configuration (session_id, position, device_id, configuration_id, foot, source, channels, configuration)
    values (v_id, v_pos, v_cfg->>'device_id', v_cfg->>'configuration_id', public.configuration_foot(v_cfg),
            coalesce(v_cfg->>'source', p_session->>'source'),
            coalesce((select jsonb_agg(c->>'code') from jsonb_array_elements(v_cfg->'channels') as c), '[]'::jsonb), v_cfg)
    on conflict (session_id, device_id) do update set
      position = excluded.position, configuration_id = excluded.configuration_id, foot = excluded.foot,
      source = excluded.source, channels = excluded.channels, configuration = excluded.configuration;
    v_pos := v_pos + 1;
  end loop;

  for v_cap in select * from jsonb_array_elements(p_captures) loop
    insert into capture (session_id, external_capture_id, source, started_at)
    values (v_id, v_cap->>'external_capture_id', v_cap->>'source', (v_cap->>'started_at')::timestamptz)
    on conflict (session_id, external_capture_id) do nothing;
    select id into v_cap_id from capture where session_id = v_id and external_capture_id = v_cap->>'external_capture_id';
    v_out := v_out || jsonb_build_object(v_cap->>'external_capture_id', v_cap_id::text);
  end loop;

  return jsonb_build_object('captures', v_out);
end;
$$;

-- Paso 3 (reemplaza al de 0001): devuelve también la cantidad de configuraciones.
create or replace function public.sync_session_finish(p_session_id text, p_events jsonb, p_results jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_counts jsonb;
begin
  if not exists (select 1 from session where id = p_session_id) then
    raise exception 'sesión % inexistente o de otra cuenta', p_session_id using errcode = '42501';
  end if;

  insert into event (session_id, local_id, capture_external_id, type, at_us, received_at, detail)
  select p_session_id, (e->>'local_id')::integer, e->>'capture_external_id', e->>'type', (e->>'at_us')::bigint,
         (e->>'received_at')::timestamptz, e->>'detail'
  from jsonb_array_elements(p_events) as e
  on conflict (session_id, local_id) do nothing;

  insert into result (capture_id, channel_code, metric_version, unit, n_received, n_valid, n_invalid,
                      sample_mean, sample_max, sample_sd_population, calibration_id, computed_at)
  select c.id, r->>'channel_code', r->>'metric_version', r->>'unit', (r->>'n_received')::integer, (r->>'n_valid')::integer,
         (r->>'n_invalid')::integer, (r->>'sample_mean')::double precision, (r->>'sample_max')::double precision,
         (r->>'sample_sd_population')::double precision, r->>'calibration_id', (r->>'computed_at')::timestamptz
  from jsonb_array_elements(p_results) as r
  join capture c on c.session_id = p_session_id and c.external_capture_id = r->>'capture_external_id'
  on conflict (capture_id, channel_code, metric_version) do update set
    unit = excluded.unit, n_received = excluded.n_received, n_valid = excluded.n_valid, n_invalid = excluded.n_invalid,
    sample_mean = excluded.sample_mean, sample_max = excluded.sample_max, sample_sd_population = excluded.sample_sd_population,
    calibration_id = excluded.calibration_id, computed_at = excluded.computed_at;

  update session set last_synced_at = now() where id = p_session_id;

  select jsonb_build_object(
    'configurations', (select count(*) from session_configuration where session_id = p_session_id),
    'captures', (select count(*) from capture where session_id = p_session_id),
    'records',  (select count(*) from record x join capture c on c.id = x.capture_id where c.session_id = p_session_id),
    'events',   (select count(*) from event where session_id = p_session_id),
    'results',  (select count(*) from result x join capture c on c.id = x.capture_id where c.session_id = p_session_id)
  ) into v_counts;
  return v_counts;
end;
$$;

revoke all on function public.configuration_foot(jsonb) from public, anon;
grant execute on function public.configuration_foot(jsonb) to authenticated;

-- Resumen por cuenta: agrega la cantidad de módulos (la vista se recrea: PostgreSQL no permite insertar columnas en medio).
drop view if exists public.session_summary;
create view public.session_summary
with (security_invoker = true)
as
select s.id, s.owner_id, s.activity, s.context, s.source, s.state, s.started_at, s.ended_at, s.duration_ms,
       s.device_id, s.configuration_id, s.last_synced_at,
       (select count(*) from session_configuration m where m.session_id = s.id) as module_count,
       (select count(*) from capture c where c.session_id = s.id) as capture_count,
       (select count(*) from record r join capture c on c.id = r.capture_id where c.session_id = s.id) as record_count,
       (select count(*) from event e where e.session_id = s.id) as event_count
from session s;
revoke all on public.session_summary from anon;
grant select on public.session_summary to authenticated;
