-- Imitación mínima del entorno de Supabase para probar la migración en un Postgres local.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on auth.users to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@ejemplo.com'), ('22222222-2222-2222-2222-222222222222', 'b@ejemplo.com');
