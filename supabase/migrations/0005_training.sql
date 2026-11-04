-- Rutinas y entrenamiento (etapa 15, ADR 0013) — esquema remoto.
-- Ejecutar una vez en el SQL Editor del proyecto, después de 0001–0004.
--
-- Lo declarado por la persona (rutinas, ejercicios objetivo, entrenamientos,
-- series hechas) se guarda separado de lo medido (session/capture/record);
-- `session_link` es el único nexo. Mismos principios que 0001/0002: titular
-- por fila, RLS, privilegios de tabla para `authenticated`, sin borrados
-- remotos (archivar en vez de borrar). La transferencia desde la app
-- (`packages/sync`) queda pendiente: este esquema la prepara.

create table public.routine (
  id                text primary key,
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,
  goal              text,
  origin            text not null check (origin in ('own', 'professional')),
  professional_note text,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  archived          boolean not null default false
);
create index routine_owner_idx on public.routine (owner_id, archived, updated_at desc);

create table public.routine_item (
  id            text primary key,
  routine_id    text not null references public.routine (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_order    integer not null check (item_order >= 0),
  kind          text not null check (kind in ('strength', 'walk_run', 'other')),
  name          text not null,
  target        jsonb not null,
  instructions  text,
  rest_sec      integer check (rest_sec is null or rest_sec >= 0)
);
create index routine_item_routine_idx on public.routine_item (routine_id, item_order);

create table public.workout (
  id          text primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id  text references public.routine (id) on delete set null,
  date        date not null,
  started_at  timestamptz,
  ended_at    timestamptz,
  state       text not null check (state in ('planned', 'in_progress', 'completed')),
  notes       text
);
create index workout_owner_date_idx on public.workout (owner_id, date desc);

create table public.workout_entry (
  id              text primary key,
  workout_id      text not null references public.workout (id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id         text references public.routine_item (id) on delete set null,
  item_name       text not null,
  kind            text not null check (kind in ('strength', 'walk_run', 'other')),
  set_index       integer check (set_index is null or set_index >= 1),
  reps            integer check (reps is null or reps >= 0),
  weight_kg       numeric check (weight_kg is null or weight_kg >= 0),
  duration_s      integer check (duration_s is null or duration_s >= 0),
  distance_m      numeric check (distance_m is null or distance_m >= 0),
  rpe             integer check (rpe is null or rpe between 1 and 10),
  discomfort_note text,
  notes           text,
  recorded_at     timestamptz not null
);
create index workout_entry_workout_idx on public.workout_entry (workout_id, recorded_at);

create table public.session_link (
  session_id  text primary key references public.session (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id  text not null references public.workout (id) on delete cascade,
  entry_id    text references public.workout_entry (id) on delete set null
);
create index session_link_workout_idx on public.session_link (workout_id);

do $$
declare t text;
begin
  foreach t in array array['routine', 'routine_item', 'workout', 'workout_entry', 'session_link'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_owner on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('revoke delete on public.%I from authenticated', t);
  end loop;
end $$;

-- Confirmación por cantidades (misma regla que las sesiones): la app compara con lo local.
create or replace function public.training_counts()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'routines', (select count(*) from public.routine where owner_id = auth.uid()),
    'items', (select count(*) from public.routine_item where owner_id = auth.uid()),
    'workouts', (select count(*) from public.workout where owner_id = auth.uid()),
    'entries', (select count(*) from public.workout_entry where owner_id = auth.uid()),
    'links', (select count(*) from public.session_link where owner_id = auth.uid())
  );
$$;
