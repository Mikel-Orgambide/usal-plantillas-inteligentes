-- Etapa 13 / migración 0003: configuraciones de todos los módulos en el servidor.
-- Ejecutar después de auth-shim.sql y las migraciones 0001..0003 (ver README).
\set ON_ERROR_STOP off
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set left '{"configuration_id":"ESP32-FSR-L-001","device_id":"ESP32-9E7EE4","source":"physical","raw_range":{"min":0,"max":4095,"resolution_bits":12},"channels":[{"code":"L_HEEL","installation_id":"a","model":"FSR406","unit":"adc_count"},{"code":"L_MEDIAL","installation_id":"b","model":"FSR402","unit":"adc_count"},{"code":"L_LATERAL","installation_id":"c","model":"FSR402","unit":"adc_count"}]}'
\set right '{"configuration_id":"ESP32-FSR-R-001","device_id":"ESP32-AAAAAA","source":"physical","raw_range":{"min":0,"max":4095,"resolution_bits":12},"channels":[{"code":"R_HEEL","installation_id":"d","model":"FSR406","unit":"adc_count"},{"code":"R_MEDIAL","installation_id":"e","model":"FSR402","unit":"adc_count"},{"code":"R_LATERAL","installation_id":"f","model":"FSR402","unit":"adc_count"}]}'
\set caps '[{"external_capture_id":"ESP32-9E7EE4-B1-C1","source":"physical","started_at":"2026-11-06T10:00:00Z"},{"external_capture_id":"ESP32-AAAAAA-B1-C1","source":"physical","started_at":"2026-11-06T10:00:00Z"}]'

\echo '--- 1. cuenta A: sesión bilateral con dos configuraciones'
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.sync_session_begin(
  ('{"id":"BIL1","activity":"caminata","context":null,"source":"physical","state":"completed","started_at":"2026-11-06T10:00:00Z","ended_at":"2026-11-06T10:01:00Z","duration_ms":60000,"created_at":"2026-11-06T10:00:00Z","updated_at":"2026-11-06T10:01:00Z","device_id":"ESP32-9E7EE4","configuration_id":"ESP32-FSR-L-001","schema_version":4,"configuration":' || :'left' || ',"configurations":[' || :'left' || ',' || :'right' || ']}')::jsonb,
  :'caps'::jsonb) as begin_bilateral;
select position, device_id, configuration_id, foot, source, channels from public.session_configuration where session_id = 'BIL1' order by position;
select public.sync_session_finish('BIL1', '[]'::jsonb, '[]'::jsonb) as counts_bilateral;

\echo '--- 2. repetir la cabecera no duplica configuraciones'
select public.sync_session_begin(
  ('{"id":"BIL1","activity":"caminata","context":null,"source":"physical","state":"completed","started_at":"2026-11-06T10:00:00Z","ended_at":"2026-11-06T10:01:00Z","duration_ms":60000,"created_at":"2026-11-06T10:00:00Z","updated_at":"2026-11-06T10:01:00Z","device_id":"ESP32-9E7EE4","configuration_id":"ESP32-FSR-L-001","schema_version":4,"configuration":' || :'left' || ',"configurations":[' || :'left' || ',' || :'right' || ']}')::jsonb,
  :'caps'::jsonb) as begin_again;
select count(*) as configurations_after_repeat from public.session_configuration where session_id = 'BIL1';

\echo '--- 3. cabecera de una app anterior (sin "configurations"): un módulo'
select public.sync_session_begin(
  ('{"id":"UNI1","activity":"otra","context":null,"source":"physical","state":"completed","started_at":"2026-11-03T20:44:30Z","ended_at":"2026-11-03T20:45:02Z","duration_ms":31953,"created_at":"2026-11-03T20:44:30Z","updated_at":"2026-11-03T20:45:02Z","device_id":"ESP32-9E7EE4","configuration_id":"ESP32-FSR-L-001","schema_version":3,"configuration":' || :'left' || '}')::jsonb,
  '[{"external_capture_id":"ESP32-9E7EE4-B51-C1","source":"physical","started_at":"2026-11-03T20:44:30Z"}]'::jsonb) as begin_legacy;
select position, device_id, foot from public.session_configuration where session_id = 'UNI1';
select public.sync_session_finish('UNI1', '[]'::jsonb, '[]'::jsonb) as counts_legacy;
select id, module_count, capture_count from public.session_summary order by id;

\echo '--- 4. cuenta B no ve las configuraciones de A'
select set_config('request.jwt.claim.sub', :'B', false);
select count(*) as configurations_visible_to_b from public.session_configuration;

\echo '--- 5. anónimo: sin acceso'
reset role;
set role anon;
select count(*) from public.session_configuration;
reset role;
