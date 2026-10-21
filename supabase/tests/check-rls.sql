\set ON_ERROR_STOP off
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set hdr '{"id":"S1","activity":"caminata","context":null,"source":"simulated","state":"completed","started_at":"2026-10-21T10:00:00Z","ended_at":"2026-10-21T10:01:00Z","duration_ms":60000,"created_at":"2026-10-21T10:00:00Z","updated_at":"2026-10-21T10:01:00Z","device_id":"SIM-001","configuration_id":"SIM-CONFIG-001","configuration":{"configuration_id":"SIM-CONFIG-001","channels":[]},"schema_version":3}'
\set caps '[{"external_capture_id":"C1","source":"simulated","started_at":"2026-10-21T10:00:00Z"}]'
\set recs '[{"sequence":0,"format_version":"1.0","received_at":"2026-10-21T10:00:00Z","samples":[{"channel_id":"L_HEEL","time_us":0,"raw_value":100,"unit":"adc_count","status":"ok"}]},{"sequence":1,"format_version":"1.0","received_at":"2026-10-21T10:00:00Z","samples":[]}]'
\set evs '[{"local_id":1,"capture_external_id":"C1","type":"capture_started","at_us":0,"received_at":"2026-10-21T10:00:00Z","detail":null},{"local_id":2,"capture_external_id":null,"type":"session_stopped","at_us":null,"received_at":"2026-10-21T10:01:00Z","detail":"state=completed"}]'
\set res '[{"capture_external_id":"C1","channel_code":"L_HEEL","metric_version":"desc-1.0","unit":"adc_count","n_received":2,"n_valid":1,"n_invalid":1,"sample_mean":100,"sample_max":100,"sample_sd_population":0,"calibration_id":null,"computed_at":"2026-10-21T10:01:00Z"}]'

\echo '--- 1. anónimo: sin acceso'
set role anon;
select count(*) from public.session;
select public.sync_session_begin(:'hdr'::jsonb, :'caps'::jsonb);
reset role;

\echo '--- 2. cuenta A: transferencia completa'
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.sync_session_begin(:'hdr'::jsonb, :'caps'::jsonb) as begin_a;
select public.sync_records((select id from public.capture where external_capture_id = 'C1'), :'recs'::jsonb) as inserted_first;
select public.sync_session_finish('S1', :'evs'::jsonb, :'res'::jsonb) as counts_first;

\echo '--- 3. cuenta A: transferencia repetida (no duplica)'
select public.sync_session_begin(:'hdr'::jsonb, :'caps'::jsonb) as begin_again;
select public.sync_records((select id from public.capture where external_capture_id = 'C1'), :'recs'::jsonb) as inserted_again;
select public.sync_session_finish('S1', :'evs'::jsonb, :'res'::jsonb) as counts_again;
select id, owner_id, record_count, event_count from public.session_summary;

\echo '--- 4. cuenta B: no ve nada de A y no puede reutilizar S1'
select set_config('request.jwt.claim.sub', :'B', false);
select count(*) as visible_to_b from public.session;
select count(*) as records_visible_to_b from public.record;
select public.sync_session_begin(:'hdr'::jsonb, :'caps'::jsonb);
select public.sync_records((select min(id) from public.capture), :'recs'::jsonb);
select public.sync_records(1, :'recs'::jsonb);
select public.sync_session_finish('S1', :'evs'::jsonb, :'res'::jsonb);

\echo '--- 5. cuenta B: su propia sesión'
select public.sync_session_begin(replace(:'hdr', '"S1"', '"S2"')::jsonb, :'caps'::jsonb) as begin_b;
select public.sync_session_finish('S2', '[]'::jsonb, '[]'::jsonb) as counts_b;
select id, owner_id from public.session_summary;

\echo '--- 6. A sigue viendo sólo lo suyo'
select set_config('request.jwt.claim.sub', :'A', false);
select id from public.session order by id;
reset role;
