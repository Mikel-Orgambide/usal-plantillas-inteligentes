#!/usr/bin/env node
/**
 * Verificación del complemento remoto contra el proyecto real de Supabase
 * (docs/especificacion/05 §5): dos cuentas, transferencia repetida sin
 * duplicados, acceso anónimo denegado y separación entre cuentas. Usa sólo la
 * clave publicable y dos cuentas de prueba con contraseña.
 *
 *   node scripts/remote-check.mjs
 *
 * Variables (en el entorno o en apps/mobile/.env):
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   REMOTE_CHECK_EMAIL_A, REMOTE_CHECK_PASSWORD_A, REMOTE_CHECK_EMAIL_B, REMOTE_CHECK_PASSWORD_B
 * Las cuentas se crean si no existen (requiere confirmación de correo
 * desactivada en Auth → Providers → Email, o cuentas ya confirmadas).
 * Deja en el servidor las sesiones REMOTE-CHECK-A y REMOTE-CHECK-B, una por cuenta.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* sin .env */ }
}
loadDotEnv(new URL("../apps/mobile/.env", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const A = { email: process.env.REMOTE_CHECK_EMAIL_A, password: process.env.REMOTE_CHECK_PASSWORD_A };
const B = { email: process.env.REMOTE_CHECK_EMAIL_B, password: process.env.REMOTE_CHECK_PASSWORD_B };
if (!url || !key || !A.email || !A.password || !B.email || !B.password) {
  console.error("faltan variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, REMOTE_CHECK_EMAIL_A/B, REMOTE_CHECK_PASSWORD_A/B");
  process.exit(2);
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function header(id) {
  const t = "2026-10-21T10:00:00.000Z";
  return {
    id, activity: "caminata", context: "verificación remota", source: "simulated", state: "completed",
    started_at: t, ended_at: "2026-10-21T10:00:30.000Z", duration_ms: 30000, created_at: t, updated_at: t,
    device_id: "SIM-001", configuration_id: "SIM-CONFIG-001", schema_version: 3,
    configuration: { configuration_id: "SIM-CONFIG-001", device_id: "SIM-001", source: "simulated", raw_range: { min: 0, max: 4095, resolution_bits: 12 }, channels: [] },
  };
}
const captures = [{ external_capture_id: "SIM-CAPTURE-CHECK-001", source: "simulated", started_at: "2026-10-21T10:00:00.000Z" }];
const records = Array.from({ length: 50 }, (_, i) => ({
  sequence: i, format_version: "1.0", received_at: "2026-10-21T10:00:00.000Z",
  samples: ["L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"].map((c, k) => ({ channel_id: c, time_us: i * 50000 + k * 400, raw_value: 1000 + i + k, unit: "adc_count", status: "ok" })),
}));
const events = [{ local_id: 1, capture_external_id: "SIM-CAPTURE-CHECK-001", type: "capture_started", at_us: 0, received_at: "2026-10-21T10:00:00.000Z", detail: null }];
const resultsPayload = [{ capture_external_id: "SIM-CAPTURE-CHECK-001", channel_code: "L_HEEL", metric_version: "desc-1.0", unit: "adc_count", n_received: 50, n_valid: 50, n_invalid: 0, sample_mean: 1000, sample_max: 1049, sample_sd_population: 14.4, calibration_id: null, computed_at: "2026-10-21T10:00:30.000Z" }];

async function signIn(creds) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let { error } = await client.auth.signInWithPassword(creds);
  if (error && /invalid login/i.test(error.message)) {
    const up = await client.auth.signUp(creds);
    if (up.error) throw new Error(`no se pudo crear ${creds.email}: ${up.error.message}`);
    if (!up.data.session) throw new Error(`${creds.email} necesita confirmación por correo; desactivarla en Auth → Providers → Email o confirmar la cuenta`);
    error = null;
  }
  if (error) throw new Error(`${creds.email}: ${error.message}`);
  return client;
}

async function transfer(client, sessionId) {
  const begin = await client.rpc("sync_session_begin", { p_session: header(sessionId), p_captures: captures });
  if (begin.error) throw begin.error;
  const capId = begin.data.captures["SIM-CAPTURE-CHECK-001"];
  const a = await client.rpc("sync_records", { p_capture_id: capId, p_records: records.slice(0, 30) });
  const b = await client.rpc("sync_records", { p_capture_id: capId, p_records: records.slice(30) });
  if (a.error || b.error) throw a.error ?? b.error;
  const fin = await client.rpc("sync_session_finish", { p_session_id: sessionId, p_events: events, p_results: resultsPayload });
  if (fin.error) throw fin.error;
  return { inserted: a.data + b.data, counts: fin.data };
}

const anon = createClient(url, key, { auth: { persistSession: false } });
const anonRead = await anon.from("session").select("id");
check("anónimo: sin lectura de sesiones", (anonRead.data?.length ?? 0) === 0, anonRead.error ? anonRead.error.message : `${anonRead.data?.length} filas`);
const anonRpc = await anon.rpc("sync_session_begin", { p_session: header("ANON"), p_captures: [] });
check("anónimo: RPC rechazada", !!anonRpc.error, anonRpc.error?.message);

const ca = await signIn(A);
const first = await transfer(ca, "REMOTE-CHECK-A");
check("cuenta A: transferencia confirmada por cantidades", first.counts.records === 50 && first.counts.captures === 1 && first.counts.events === 1 && first.counts.results === 1, JSON.stringify(first.counts));
const again = await transfer(ca, "REMOTE-CHECK-A");
check("cuenta A: transferencia repetida no duplica", again.inserted === 0 && JSON.stringify(again.counts) === JSON.stringify(first.counts), `insertados ${again.inserted}, ${JSON.stringify(again.counts)}`);
const listA = await ca.from("session_summary").select("id,record_count");
check("cuenta A: ve su sesión", listA.data?.some((s) => s.id === "REMOTE-CHECK-A") ?? false, JSON.stringify(listA.data));

const cb = await signIn(B);
const listB0 = await cb.from("session").select("id");
check("cuenta B: no ve sesiones de A", !(listB0.data ?? []).some((s) => s.id === "REMOTE-CHECK-A"), JSON.stringify(listB0.data));
const steal = await cb.rpc("sync_session_begin", { p_session: header("REMOTE-CHECK-A"), p_captures: captures });
check("cuenta B: no puede reutilizar el id de A", !!steal.error, steal.error?.message);
const recB = await cb.from("record").select("id", { count: "exact", head: true });
check("cuenta B: no lee registros de A", (recB.count ?? 0) === 0 || !listB0.data?.length, `count=${recB.count}`);
const own = await transfer(cb, "REMOTE-CHECK-B");
check("cuenta B: transfiere su propia sesión", own.counts.records === 50, JSON.stringify(own.counts));
const listA2 = await ca.from("session").select("id");
check("cuenta A: sigue sin ver la sesión de B", !(listA2.data ?? []).some((s) => s.id === "REMOTE-CHECK-B"), JSON.stringify(listA2.data));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} comprobaciones correctas`);
process.exit(failed ? 1 : 0);
