-- Complemento remoto (etapa 11) — esquema de Supabase (PostgreSQL).
-- Ejecutar una vez en el SQL Editor del proyecto (o con `supabase db push`).
--
-- Principios (docs/especificacion/02 §12, 03 §14, 05 §5; ADR 0008):
--   * Cada fila tiene titular (`owner_id` = auth.uid()). RLS activo en todas
--     las tablas: una cuenta sólo ve y escribe lo suyo; `anon` no accede.
--   * Mismos identificadores que la base local: sesión (uuid de la app),
--     captura (sesión + id externo), registro (captura + secuencia), evento
--     (sesión + id local), resultado (captura + canal + versión de métrica).
--     Reinsertar lo que ya existe no duplica nada.
--   * Las funciones de sincronización son SECURITY INVOKER: corren con los
--     permisos de la cuenta que llama y las políticas se aplican igual.
--   * `sync_session_finish` devuelve las cantidades que el servidor tiene
--     realmente; la app sólo confirma si coinciden con las locales.
--   * Sin borrados remotos ni resolución de conflictos (02 §12): la copia
--     local sigue siendo la fuente primaria.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tablas

create table public.session (
  id                text primary key,
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity          text not null,
  context           text,
  source            text not null check (source in ('simulated', 'physical')),
  state             text not null check (state in ('completed', 'incomplete')),
  started_at        timestamptz not null,
  ended_at          timestamptz,
  duration_ms       integer,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  device_id         text not null,
  configuration_id  text not null,
  configuration     jsonb not null,
  schema_version    integer not null,
  first_synced_at   timestamptz not null default now(),
  last_synced_at    timestamptz
);
create index session_owner_idx on public.session (owner_id, started_at desc);

create table public.capture (
  id                   bigint generated always as identity primary key,
  session_id           text not null references public.session (id) on delete cascade,
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_capture_id  text not null,
  source               text not null check (source in ('simulated', 'physical')),
  started_at           timestamptz not null,
  unique (session_id, external_capture_id)
);

create table public.record (
  id              bigint generated always as identity primary key,
  capture_id      bigint not null references public.capture (id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sequence        integer not null check (sequence >= 0),
  format_version  text not null,
  received_at     timestamptz not null,
  -- Seis muestras por registro: [{channel_id, time_us, raw_value, unit, status}].
  samples         jsonb not null,
  unique (capture_id, sequence)
);

create table public.event (
  id                   bigint generated always as identity primary key,
  session_id           text not null references public.session (id) on delete cascade,
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_id             integer not null,
  capture_external_id  text,
  type                 text not null,
  at_us                bigint,
  received_at          timestamptz not null,
  detail               text,
  unique (session_id, local_id)
);

create table public.result (
  id                    bigint generated always as identity primary key,
  capture_id            bigint not null references public.capture (id) on delete cascade,
  owner_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  channel_code          text not null,
  metric_version        text not null,
  unit                  text not null,
  n_received            integer not null check (n_received >= 0),
  n_valid               integer not null check (n_valid >= 0 and n_valid <= n_received),
  n_invalid             integer not null check (n_invalid = n_received - n_valid),
  sample_mean           double precision,
  sample_max            double precision,
  sample_sd_population  double precision,
  calibration_id        text,
  computed_at           timestamptz not null,
  unique (capture_id, channel_code, metric_version),
  check ((n_valid > 0 and sample_mean is not null and sample_max is not null and sample_sd_population is not null)
      or (n_valid = 0 and sample_mean is null and sample_max is null and sample_sd_population is null))
);

-- ------------------------------------------------- titularidad (RLS)

alter table public.session enable row level security;
alter table public.capture enable row level security;
alter table public.record  enable row level security;
alter table public.event   enable row level security;
alter table public.result  enable row level security;

create policy session_owner on public.session for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy capture_owner on public.capture for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy record_owner  on public.record  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy event_owner   on public.event   for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy result_owner  on public.result  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Una solicitud sin autenticar no accede a nada, ni por tabla ni por función.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ------------------------------------------------ funciones de sincronización

-- Paso 1: cabecera. Crea o actualiza la sesión y sus capturas; devuelve el id remoto de cada captura.
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
  -- Si el id pertenece a otra cuenta, la fila existente es invisible para esta política
  -- y PostgreSQL rechaza el upsert con una violación de RLS: la app no reintenta.

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

-- Paso 2: registros por lotes. Devuelve cuántos se insertaron (los repetidos se ignoran).
create or replace function public.sync_records(p_capture_id bigint, p_records jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if not exists (select 1 from capture where id = p_capture_id) then
    raise exception 'captura % inexistente o de otra cuenta', p_capture_id using errcode = '42501';
  end if;
  insert into record (capture_id, sequence, format_version, received_at, samples)
  select p_capture_id, (r->>'sequence')::integer, r->>'format_version', (r->>'received_at')::timestamptz, r->'samples'
  from jsonb_array_elements(p_records) as r
  on conflict (capture_id, sequence) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Paso 3: eventos y resultados; devuelve lo que el servidor tiene de la sesión.
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
    'captures', (select count(*) from capture where session_id = p_session_id),
    'records',  (select count(*) from record x join capture c on c.id = x.capture_id where c.session_id = p_session_id),
    'events',   (select count(*) from event where session_id = p_session_id),
    'results',  (select count(*) from result x join capture c on c.id = x.capture_id where c.session_id = p_session_id)
  ) into v_counts;
  return v_counts;
end;
$$;

revoke all on function public.sync_session_begin(jsonb, jsonb) from public, anon;
revoke all on function public.sync_records(bigint, jsonb) from public, anon;
revoke all on function public.sync_session_finish(text, jsonb, jsonb) from public, anon;
grant execute on function public.sync_session_begin(jsonb, jsonb) to authenticated;
grant execute on function public.sync_records(bigint, jsonb) to authenticated;
grant execute on function public.sync_session_finish(text, jsonb, jsonb) to authenticated;

-- Resumen por cuenta para el historial remoto (lectura; RLS filtra por titular).
create or replace view public.session_summary
with (security_invoker = true)
as
select s.id, s.owner_id, s.activity, s.context, s.source, s.state, s.started_at, s.ended_at, s.duration_ms,
       s.device_id, s.configuration_id, s.last_synced_at,
       (select count(*) from capture c where c.session_id = s.id) as capture_count,
       (select count(*) from record r join capture c on c.id = r.capture_id where c.session_id = s.id) as record_count,
       (select count(*) from event e where e.session_id = s.id) as event_count
from session s;
revoke all on public.session_summary from anon;
grant select on public.session_summary to authenticated;
