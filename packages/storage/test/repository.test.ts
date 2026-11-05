import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SIMULATED_CONFIGURATION, type NormalizedRecord } from "@plantillas/contract";
import { NodeSqliteDriver } from "../src/node/index";
import { CURRENT_SCHEMA_VERSION, SessionRepository, getSchemaVersion, migrate, type Migration } from "../src/index";
import { MIGRATIONS } from "../src/schema";
import { RECEIVED_AT, openRepo, seededSession, simulatedRecords } from "./helpers";

const tmpDirs: string[] = [];
function tmpDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "plantillas-"));
  tmpDirs.push(dir);
  return join(dir, "sesiones.db");
}
afterEach(() => { for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("migraciones", () => {
  it("aplica el esquema inicial y fija user_version", async () => {
    const db = new NodeSqliteDriver();
    const report = await migrate(db);
    expect(report).toEqual({ from: 0, to: CURRENT_SCHEMA_VERSION, applied: [1, 2, 3, 4, 5, 6, 7] });
    expect(await getSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
    const again = await migrate(db);
    expect(again.applied).toEqual([]);
    await db.close();
  });

  it("habilita claves foráneas en la conexión", async () => {
    const db = new NodeSqliteDriver();
    await migrate(db);
    await expect(db.run("INSERT INTO configuration (id, device_id, source, raw_min, raw_max, resolution_bits, created_at) VALUES ('X','NO-EXISTE','simulated',0,1,1,'t')")).rejects.toThrow();
    await db.close();
  });

  it("la migración 2 se aplica sobre una base en versión 1 sin perder datos", async () => {
    const path = tmpDb();
    const db1 = new NodeSqliteDriver(path);
    await migrate(db1, MIGRATIONS.slice(0, 1));
    const repo1 = new SessionRepository(db1);
    await repo1.ensureLocalUser();
    await repo1.ensureConfiguration(SIMULATED_CONFIGURATION);
    const { capture } = await seededSession(repo1);
    await repo1.insertRecords(capture.id, simulatedRecords(5, "S1"));
    await db1.close();

    const db2 = new NodeSqliteDriver(path);
    expect(await migrate(db2)).toEqual({ from: 1, to: CURRENT_SCHEMA_VERSION, applied: [2, 3, 4, 5, 6, 7] });
    const repo2 = new SessionRepository(db2);
    expect(await repo2.countRecords(capture.id)).toBe(5);
    expect(await repo2.getResults(capture.id)).toEqual([]);
    await db2.close();
  });

  it("P04 - una migración posterior conserva los datos previos", async () => {
    const path = tmpDb();
    const { db, repo } = await openRepo(path);
    const { capture } = await seededSession(repo);
    await repo.insertRecords(capture.id, simulatedRecords(5, "S1"));
    await db.close();

    const next = CURRENT_SCHEMA_VERSION + 1;
    const vNext: Migration = { version: next, description: "prueba", sql: "ALTER TABLE session ADD COLUMN notes TEXT" };
    const db2 = new NodeSqliteDriver(path);
    const report = await migrate(db2, [...MIGRATIONS, vNext]);
    expect(report).toEqual({ from: CURRENT_SCHEMA_VERSION, to: next, applied: [next] });
    const repo2 = new SessionRepository(db2);
    expect(await repo2.countRecords(capture.id)).toBe(5);
    expect(await db2.get("SELECT notes FROM session WHERE id = 'S1'")).toEqual({ notes: null });
    await db2.close();
  });
});

describe("configuración", () => {
  it("registra los seis canales y rechaza una redefinición distinta con el mismo id", async () => {
    const { db, repo } = await openRepo();
    const rows = await db.all("SELECT code, foot, zone, model FROM channel WHERE configuration_id = 'SIM-CONFIG-001' ORDER BY code");
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ code: "L_HEEL", foot: "left", zone: "heel", model: "FSR406" });
    await expect(repo.ensureConfiguration({ ...SIMULATED_CONFIGURATION, raw_range: { min: 0, max: 1023, resolution_bits: 10 } })).rejects.toThrow(/nueva versión/);
    await repo.ensureConfiguration(SIMULATED_CONFIGURATION); // idéntica: no falla
    await db.close();
  });
});

describe("sesiones, capturas y registros", () => {
  it("P01 - guardar, cerrar la base, reabrir y recuperar lo mismo", async () => {
    const path = tmpDb();
    const { db, repo } = await openRepo(path);
    const { session, capture } = await seededSession(repo);
    const records = simulatedRecords(20, session.id);
    await repo.setSessionState(session.id, "recording");
    const outcomes = await repo.insertRecords(capture.id, records);
    expect(outcomes.every((o) => o.outcome === "inserted")).toBe(true);
    await repo.addEvent(session.id, capture.id, { type: "capture_started", at_us: 0, capture_id: "SIM-CAPTURE-0001-001" }, RECEIVED_AT);
    await repo.closeSession(session.id, RECEIVED_AT, 400, "completed");
    await db.close();

    const db2 = new NodeSqliteDriver(path);
    await migrate(db2);
    const repo2 = new SessionRepository(db2);
    const sessions = await repo2.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: "S1", state: "completed", duration_ms: 400, capture_count: 1, record_count: 20, event_count: 1, configuration_id: "SIM-CONFIG-001", source: "simulated" });

    const captures = await repo2.getCaptures("S1");
    expect(captures).toHaveLength(1);
    const stored = await repo2.getRecords(captures[0]!.id);
    expect(stored.map((r) => r.sequence)).toEqual(records.map((r) => r.sequence));
    const samples = await repo2.getSamples(captures[0]!.id);
    expect(samples).toHaveLength(120);
    const heel = await repo2.getSamples(captures[0]!.id, "L_HEEL");
    expect(heel.map((s) => s.raw_value)).toEqual(records.map((r) => r.samples.find((s) => s.channel_id === "L_HEEL")!.raw_value));
    expect(heel.map((s) => s.time_us)).toEqual(records.map((r) => r.samples.find((s) => s.channel_id === "L_HEEL")!.time_us));
    const events = await repo2.getEvents("S1");
    expect(events[0]).toMatchObject({ type: "capture_started", at_us: 0, detail: JSON.stringify({ capture_id: "SIM-CAPTURE-0001-001" }) });
    await db2.close();
  });

  it("P02 - un registro defectuoso dentro del lote se revierte solo; el resto se confirma", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const records = simulatedRecords(5, "S1");
    const broken: NormalizedRecord = {
      ...records[2]!,
      samples: records[2]!.samples.map((s, i) => (i === 3 ? { ...s, channel_id: "R_HEEL", time_us: -5 } : s)),
    };
    const outcomes = await repo.insertRecords(capture.id, [records[0]!, records[1]!, broken, records[3]!, records[4]!]);
    expect(outcomes.map((o) => o.outcome)).toEqual(["inserted", "inserted", "rejected", "inserted", "inserted"]);
    expect(await repo.countRecords(capture.id)).toBe(4);
    // Ninguna muestra huérfana del registro revertido.
    expect(await db.get("SELECT COUNT(*) AS n FROM sample WHERE time_us < 0")).toEqual({ n: 0 });
    const diag = await repo.getDiagnostics("S1");
    expect(diag).toHaveLength(1);
    expect(diag[0]!.reason).toMatch(/rechazado al guardar/);
    await db.close();
  });

  it("P03 - una muestra con canal de otra configuración es rechazada por la base", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    // Segunda configuración con otros installation_id.
    const other = { ...SIMULATED_CONFIGURATION, configuration_id: "SIM-CONFIG-002", channels: SIMULATED_CONFIGURATION.channels.map((c) => ({ ...c, installation_id: `OTRO-${c.code}` })) };
    await repo.ensureConfiguration(other);
    await db.run("INSERT INTO record (capture_id, sequence, format_version, received_at) VALUES (?, 999, '1.0', ?)", [capture.id, RECEIVED_AT]);
    const rec = await db.get<{ id: number }>("SELECT id FROM record WHERE sequence = 999");
    await expect(
      db.run("INSERT INTO sample (record_id, channel_installation_id, channel_code, time_us, raw_value, unit, status) VALUES (?, 'OTRO-L_HEEL', 'L_HEEL', 0, 1, 'adc_count', 'ok')", [rec!.id]),
    ).rejects.toThrow(/no pertenece a la configuración/);
    // Y la coherencia estado/valor también la vigila la base.
    await expect(
      db.run("INSERT INTO sample (record_id, channel_installation_id, channel_code, time_us, raw_value, unit, status) VALUES (?, 'SIM-L_HEEL', 'L_HEEL', 0, NULL, 'adc_count', 'ok')", [rec!.id]),
    ).rejects.toThrow();
    await db.close();
  });

  it("C08 - una retransmisión idéntica no crea otro registro", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const records = simulatedRecords(3, "S1");
    await repo.insertRecords(capture.id, records);
    const again = await repo.insertRecords(capture.id, [records[1]!]);
    expect(again[0]!.outcome).toBe("duplicate");
    expect(await repo.countRecords(capture.id)).toBe(3);
    expect(await repo.getDiagnostics("S1")).toHaveLength(0);
    await db.close();
  });

  it("C09 - misma secuencia con contenido distinto: se conserva el original y el conflicto queda en diagnóstico", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const records = simulatedRecords(3, "S1");
    await repo.insertRecords(capture.id, records);
    const altered: NormalizedRecord = { ...records[1]!, samples: records[1]!.samples.map((s, i) => (i === 0 ? { ...s, raw_value: (s.raw_value ?? 0) + 1 } : s)) };
    const res = await repo.insertRecords(capture.id, [altered]);
    expect(res[0]!.outcome).toBe("conflict");
    const original = await repo.getSamples(capture.id, "L_HEEL");
    expect(original[1]!.raw_value).toBe(records[1]!.samples[0]!.raw_value);
    const diag = await repo.getDiagnostics("S1");
    expect(diag).toHaveLength(1);
    expect(JSON.parse(diag[0]!.payload).sequence).toBe(1);
    await db.close();
  });

  it("C11 - una captura nueva tras reinicio no mezcla secuencias ni tiempos con la anterior", async () => {
    const { db, repo } = await openRepo();
    const { session, capture } = await seededSession(repo);
    await repo.insertRecords(capture.id, simulatedRecords(4, session.id));
    const second = await repo.openCapture(session.id, SIMULATED_CONFIGURATION, "SIM-CAPTURE-0001-002", RECEIVED_AT);
    expect(second.id).not.toBe(capture.id);
    const restarted = simulatedRecords(3, session.id).map((r) => ({ ...r, capture_id: "SIM-CAPTURE-0001-002" }));
    const res = await repo.insertRecords(second.id, restarted);
    expect(res.every((o) => o.outcome === "inserted")).toBe(true);
    expect((await repo.getRecords(capture.id)).map((r) => r.sequence)).toEqual([0, 1, 2, 3]);
    expect((await repo.getRecords(second.id)).map((r) => r.sequence)).toEqual([0, 1, 2]);
    expect(await repo.getCaptures(session.id)).toHaveLength(2);
    // Un registro de la captura 1 enviado a la captura 2 se rechaza.
    const wrong = await repo.insertRecords(second.id, simulatedRecords(1, session.id));
    expect(wrong[0]!.outcome).toBe("rejected");
    await db.close();
  });

  it("no mezcla procedencias ni reutiliza capture_id entre sesiones", async () => {
    const { db, repo } = await openRepo();
    const { session } = await seededSession(repo);
    await expect(repo.openCapture(session.id, { ...SIMULATED_CONFIGURATION, source: "physical" }, "X", RECEIVED_AT)).rejects.toThrow(/procedencias/);
    await repo.createSession({ id: "S2", user_id: "local", activity: "otra", source: "simulated", started_at: RECEIVED_AT });
    await expect(repo.openCapture("S2", SIMULATED_CONFIGURATION, "SIM-CAPTURE-0001-001", RECEIVED_AT)).rejects.toThrow(/otra sesión/);
    await db.close();
  });

  it("S02 - las sesiones abiertas se reconocen al reabrir", async () => {
    const { db, repo } = await openRepo();
    const { session } = await seededSession(repo);
    await repo.setSessionState(session.id, "recording");
    expect((await repo.listOpenSessions()).map((s) => s.id)).toEqual(["S1"]);
    await repo.closeSession(session.id, RECEIVED_AT, 0, "incomplete");
    expect(await repo.listOpenSessions()).toEqual([]);
    await db.close();
  });
});

describe("consultas para visualización", () => {
  it("la serie reducida promedia por tramo y deja null en los huecos", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const records = simulatedRecords(20, "S1");
    // Saltar las secuencias 8..11: hueco en el medio.
    await repo.insertRecords(capture.id, records.filter((r) => r.sequence < 8 || r.sequence > 11));
    const series = await repo.getChannelSeries(capture.id, "L_HEEL", 5);
    expect(series).toHaveLength(5);
    expect(series[2]).toBeNull(); // tramo 8..11
    expect(series.filter((v) => v !== null)).toHaveLength(4);
    const full = await repo.getChannelSeries(capture.id, "L_HEEL", 100);
    expect(full).toHaveLength(20);
    expect(full.slice(8, 12)).toEqual([null, null, null, null]);
    expect(full[0]).toBe(records[0]!.samples[0]!.raw_value);
    expect(await repo.getChannelSeries(999, "L_HEEL", 5)).toEqual([]);
    const q = await repo.getCaptureQuality(capture.id);
    expect(q).toEqual({ records: 16, max_sequence: 19, read_errors: 0 });
    await db.close();
  });
});

describe("asistente (ADR 0012): registro local de intercambios", () => {
  it("guarda pregunta, resumen del contexto y respuesta o error, por usuario", async () => {
    const db = new NodeSqliteDriver();
    await migrate(db);
    const repo = new SessionRepository(db);
    await repo.ensureLocalUser();
    const base = { user_id: "local", session_id: null, asked_at: "2026-11-04T18:00:00.000Z", context_chars: 1200, context_summary: "2 sesiones; seleccionada ninguna", server_url: "http://192.168.0.140:1234", model: "qwen3-14b", mode: "local" as const };
    await repo.addAssistantExchange({ ...base, question: "¿Qué pasó ayer?", scope: "in_scope", answer: "En la sesión del 3/11…", error: null, elapsed_ms: 1800 });
    await repo.addAssistantExchange({ ...base, asked_at: "2026-11-04T18:01:00.000Z", question: "¿Tengo fascitis?", scope: "out_of_scope_clinical", answer: "Eso no lo puedo responder…", error: null, elapsed_ms: 0, model: null });
    await repo.addAssistantExchange({ ...base, asked_at: "2026-11-04T18:02:00.000Z", question: "¿Y el máximo?", scope: "in_scope", answer: null, error: "no se pudo contactar al asistente", elapsed_ms: 60000, mode: "cloud" });
    await expect(repo.addAssistantExchange({ ...base, question: "sin nada", scope: "in_scope", answer: null, error: null, elapsed_ms: null })).rejects.toThrow();
    const rows = await repo.listAssistantExchanges("local");
    expect(rows.map((r) => r.question)).toEqual(["¿Y el máximo?", "¿Tengo fascitis?", "¿Qué pasó ayer?"]);
    expect(rows[2]).toMatchObject({ scope: "in_scope", model: "qwen3-14b", answer: "En la sesión del 3/11…", error: null, mode: "local" });
    expect(rows[0]!.mode).toBe("cloud");
    expect(await repo.countAssistantExchanges("local")).toBe(3);
    expect(await repo.countAssistantExchanges("otro")).toBe(0);
    await db.close();
  });
});
