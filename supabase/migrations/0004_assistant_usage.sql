-- Asistente explicativo (etapa 14, ADR 0012) — registro de uso de la función gestionada.
-- Ejecutar una vez en el SQL Editor del proyecto, después de 0003.
--
-- La función `assistant` (supabase/functions/assistant) reenvía las preguntas
-- al proveedor de modelos con la clave guardada en los secretos del proyecto.
-- Esta tabla le sirve para limitar la cantidad de preguntas por usuario y hora
-- y para dejar evidencia de uso. Guarda fechas, modelo, longitudes y tiempos;
-- nunca el texto de la pregunta, del contexto ni de la respuesta (eso queda
-- sólo en el teléfono, en `assistant_exchange`).
--
-- Escribe únicamente la función (rol service_role, que no está sujeto a RLS).
-- El usuario autenticado puede leer sus propias filas; no inserta, no modifica
-- ni borra. Anónimos sin acceso.

create table public.assistant_usage (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users (id) on delete cascade,
  asked_at           timestamptz not null default now(),
  model              text not null,
  question_chars     integer not null check (question_chars >= 0),
  context_chars      integer not null check (context_chars >= 0),
  history_turns      integer not null default 0 check (history_turns >= 0),
  forwarded          boolean not null,
  status             text not null,
  elapsed_ms         integer check (elapsed_ms is null or elapsed_ms >= 0),
  prompt_tokens      integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens  integer check (completion_tokens is null or completion_tokens >= 0)
);
create index assistant_usage_user_time_idx on public.assistant_usage (user_id, asked_at desc);

alter table public.assistant_usage enable row level security;
create policy assistant_usage_owner_read on public.assistant_usage for select to authenticated
  using (user_id = auth.uid());

revoke all on public.assistant_usage from anon;
revoke all on public.assistant_usage from authenticated;
grant select on public.assistant_usage to authenticated;
-- service_role conserva todos los privilegios por defecto del esquema.

-- Resumen del uso propio (para la pantalla de Ajustes o la evidencia): preguntas en la última hora.
create or replace function public.assistant_usage_last_hour()
returns integer
language sql
security invoker
set search_path = public
stable
as $$
  select count(*)::integer
  from public.assistant_usage
  where user_id = auth.uid() and forwarded and asked_at >= now() - interval '1 hour';
$$;
grant execute on function public.assistant_usage_last_hour() to authenticated;
