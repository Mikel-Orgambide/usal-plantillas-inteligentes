do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $$;
-- Imitación mínima del entorno de Supabase para probar la migración en un Postgres local.
create schema auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on auth.users to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@ejemplo.com'), ('22222222-2222-2222-2222-222222222222', 'b@ejemplo.com');
