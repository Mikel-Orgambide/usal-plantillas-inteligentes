import { describe, expect, it } from "vitest";
import { SIMULATED_CONFIGURATION, normalizeRecord, validateSourceRecord, type NormalizedRecord } from "@plantillas/contract";
import { SCENARIOS, SimulatedGenerator, take } from "@plantillas/simulator";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { SessionRepository, migrate } from "@plantillas/storage";
import { localCounts, syncPendingSessions, syncSession } from "../src/index";
import { FakeRemote } from "./fake-remote";

const RECEIVED_AT = "2026-10-21T10:00:00.000-03:00";
const noSleep = async (): Promise<void> => {};

function records(count: number, sessionId: string, captureId: string, seed = 1): NormalizedRecord[] {
  const gen = new SimulatedGenerator({ seed, scenario: SCENARIOS.normal });
  const out: NormalizedRecord[] = [];
  for (const o of take(gen, count * 2)) {
    if (o.kind !== "payload") continue;
    const r = validateSourceRecord(o.payload, SIMULATED_CONFIGURATION);
    if (!r.ok) continue;
    out.push({ ...normalizeRecord(r.record, { source: "simulated", session_id: sessionId, received_at: RECEIVED_AT }), capture_id: captureId });
    if (out.length === count) break;
  }
  return out;
}

async function phone(opts: { remoteId?: string; sessions?: number; records?: number } = {}) {
  const db = new NodeSqliteDriver();
  await migrate(db);
  const repo = new SessionRepository(db);
  await repo.ensureLocalUser();
  await repo.ensureConfiguration(SIMULATED_CONFIGURATION);
  if (opts.remoteId) await repo.linkRemoteUser(opts.remoteId, `${opts.remoteId}@ejemplo.com`);
  const ids: string[] = [];
  for (let i = 1; i <= (opts.sessions ?? 1); i++) {
    const id = `S${i}`;
    await repo.createSession({ id, user_id: "local", activity: "caminata", source: "simulated", started_at: RECEIVED_AT });
    const cap = await repo.openCapture(id, SIMULATED_CONFIGURATION, `SIM-CAPTURE-${i}`, RECEIVED_AT);
    await repo.insertRecords(cap.id, records(opts.records ?? 30, id, `SIM-CAPTURE-${i}`, i));
    await repo.addEvent(id, cap.id, { type: "capture_started", at_us: 0 }, RECEIVED_AT);
    await repo.addEvent(id, null, { type: "session_stopped", state: "completed" }, RECEIVED_AT);
    await repo.saveResults(cap.id, [
      { channel_code: "L_HEEL", metric_version: "desc-1.0", unit: "adc_count", n_received: 30, n_valid: 30, n_invalid: 0, sample_mean: 100, sample_max: 200, sample_sd_population: 10, computed_at: RECEIVED_AT },
      { channel_code: "R_HEEL", metric_version: "desc-1.0", unit: "adc_count", n_received: 30, n_valid: 0, n_invalid: 30, sample_mean: null, sample_max: null, sample_sd_population: null, computed_at: RECEIVED_AT },
    ]);
    await repo.closeSession(id, RECEIVED_AT, 1500, "completed");
    ids.push(id);
  }
  return { db, repo, ids };
}

describe("sincronización de sesiones (etapa 11, 03 §14 y 05 §5)", () => {
  it("transfiere una sesión con sus identificadores y la confirma por cantidades, en lotes", async () => {
    const { db, repo } = await phone({ remoteId: "uuid-A", records: 30 });
    const remote = new FakeRemote();
    const progress: number[] = [];
    const o = await syncSession({ db, gateway: remote, ownerRemoteId: "uuid-A", chunkSize: 8, sleep: noSleep, onProgress: (p) => progress.push(p.recordsSent) }, "S1");
    expect(o.status).toBe("confirmed");
    if (o.status !== "confirmed") return;
    expect(o.counts).toEqual({ captures: 1, records: 30, events: 2, results: 2 });
    expect(o.counts).toEqual(await localCounts(repo, "S1"));
    expect(remote.calls.filter((c) => c === "records")).toHaveLength(4);
    expect(progress.at(-1)).toBe(30);
    expect(remote.sessions.get("S1")?.header.configuration.channels).toHaveLength(6);
    expect(remote.records.get("1")?.get(5)?.samples).toHaveLength(6);
    expect((await repo.getSyncState("S1"))).toMatchObject({ status: "confirmed", attempts: 1, owner_remote_id: "uuid-A" });
    await db.close();
  });

  it("una transferencia repetida no duplica datos", async () => {
    const { db } = await phone({ remoteId: "uuid-A" });
    const remote = new FakeRemote();
    const opts = { db, gateway: remote, ownerRemoteId: "uuid-A", sleep: noSleep };
    await syncSession(opts, "S1");
    const before = remote.countsOf("S1");
    const again = await syncSession(opts, "S1");
    expect(again.status).toBe("confirmed");
    expect(remote.countsOf("S1")).toEqual(before);
    expect((await new SessionRepository(db).getSyncState("S1"))?.attempts).toBe(2);
    await db.close();
  });

  it("reintenta ante fallas de red con los mismos identificadores y no duplica", async () => {
    const { db } = await phone({ remoteId: "uuid-A", records: 20 });
    const remote = new FakeRemote();
    remote.failNext = 2; // falla el begin dos veces
    const o = await syncSession({ db, gateway: remote, ownerRemoteId: "uuid-A", chunkSize: 5, attempts: 3, sleep: noSleep }, "S1");
    expect(o.status).toBe("confirmed");
    expect(remote.countsOf("S1").records).toBe(20);
    expect(remote.calls.filter((c) => c === "begin")).toHaveLength(3);
    await db.close();
  });

  it("si se agotan los reintentos la sesión queda fallida y sigue pendiente, con el error registrado", async () => {
    const { db, repo } = await phone({ remoteId: "uuid-A" });
    const remote = new FakeRemote();
    remote.failNext = 10;
    const o = await syncSession({ db, gateway: remote, ownerRemoteId: "uuid-A", attempts: 2, sleep: noSleep }, "S1");
    expect(o).toMatchObject({ status: "failed", error: "falla de red simulada" });
    expect((await repo.listSessionsPendingSync("uuid-A")).map((s) => s.id)).toEqual(["S1"]);
    expect((await repo.getSyncState("S1"))).toMatchObject({ status: "failed", attempts: 1, last_error: "falla de red simulada" });
    // Y la sesión local sigue disponible sin red.
    expect((await repo.getSession("S1"))?.state).toBe("completed");
    await db.close();
  });

  it("una confirmación con cantidades distintas conserva la sesión pendiente", async () => {
    const { db, repo } = await phone({ remoteId: "uuid-A" });
    const remote = new FakeRemote();
    remote.reportOverride = { records: 29 };
    const o = await syncSession({ db, gateway: remote, ownerRemoteId: "uuid-A", sleep: noSleep }, "S1");
    expect(o).toMatchObject({ status: "pending", error: "el servidor informa registros 29 de 30" });
    expect((await repo.getSyncState("S1"))?.status).toBe("pending");
    expect((await repo.listSessionsPendingSync("uuid-A")).map((s) => s.id)).toEqual(["S1"]);
    await db.close();
  });

  it("dos cuentas: cada una ve sólo sus sesiones y una no puede reutilizar el id de la otra", async () => {
    const a = await phone({ remoteId: "uuid-A", sessions: 2 });
    const remote = new FakeRemote();
    remote.owner = "uuid-A";
    const ra = await syncPendingSessions({ db: a.db, gateway: remote, ownerRemoteId: "uuid-A", sleep: noSleep });
    expect(ra).toMatchObject({ confirmed: 2, pending: 0, failed: 0 });

    const b = await phone({ remoteId: "uuid-B", sessions: 1 });
    remote.owner = "uuid-B";
    const rb = await syncPendingSessions({ db: b.db, gateway: remote, ownerRemoteId: "uuid-B", sleep: noSleep });
    // S1 de B colisiona con S1 de A: el servidor lo rechaza y no se reintenta.
    expect(rb).toMatchObject({ confirmed: 0, failed: 1 });
    expect(rb.outcomes["S1"]).toMatchObject({ status: "failed", error: expect.stringContaining("row-level security") });
    expect(remote.calls.filter((c) => c === "begin")).toHaveLength(3);
    expect(remote.visibleSessions("uuid-A")).toEqual(["S1", "S2"]);
    expect(remote.visibleSessions("uuid-B")).toEqual([]);
    await a.db.close();
    await b.db.close();
  });

  it("un cambio de cuenta no reasigna la sincronización pendiente", async () => {
    const { db, repo } = await phone({ remoteId: "uuid-A" });
    await repo.linkRemoteUser("uuid-B", "b@ejemplo.com");
    const remote = new FakeRemote();
    remote.owner = "uuid-B";
    expect(await syncSession({ db, gateway: remote, ownerRemoteId: "uuid-B", sleep: noSleep }, "S1")).toEqual({ status: "skipped", reason: "la sesión pertenece a otra cuenta" });
    expect(await syncPendingSessions({ db, gateway: remote, ownerRemoteId: "uuid-B", sleep: noSleep })).toMatchObject({ confirmed: 0, pending: 0, failed: 0 });
    expect(remote.calls).toEqual([]);
    await db.close();
  });

  it("no transfiere sesiones abiertas, sin cuenta ni sin capturas", async () => {
    const { db, repo } = await phone({ records: 5 });
    const remote = new FakeRemote();
    const opts = { db, gateway: remote, ownerRemoteId: "uuid-A", sleep: noSleep };
    expect(await syncSession(opts, "S1")).toEqual({ status: "skipped", reason: "la sesión no pertenece a ninguna cuenta" });
    await repo.linkRemoteUser("uuid-A", "a@ejemplo.com");
    await repo.createSession({ id: "S9", user_id: "local", activity: "caminata", source: "simulated", started_at: RECEIVED_AT });
    expect(await syncSession(opts, "S9")).toEqual({ status: "skipped", reason: "la sesión todavía no está cerrada" });
    await repo.closeSession("S9", RECEIVED_AT, 0, "incomplete");
    expect(await syncSession(opts, "S9")).toEqual({ status: "skipped", reason: "la sesión no tiene capturas" });
    expect(await syncSession(opts, "NO")).toEqual({ status: "skipped", reason: "la sesión no existe" });
    expect(remote.calls).toEqual([]);
    await db.close();
  });
});
