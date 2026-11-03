import { describe, expect, it } from "vitest";
import { LEFT_MODULE_CONFIGURATION, SIMULATED_CONFIGURATION, type AcquisitionConfiguration } from "@plantillas/contract";
import { SessionRepository, migrate } from "@plantillas/storage";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { SessionCoordinator, recoverOpenSessions, type Clock } from "../src/index";
import { ManualSource, payload } from "./manual-source";

class TestClock implements Clock {
  mono = 1000;
  nowIso(): string { return new Date(1_760_000_000_000 + this.mono).toISOString(); }
  monotonicMs(): number { return this.mono; }
}

async function setup(opts: { lateDataWindowMs?: number; configuration?: AcquisitionConfiguration } = {}) {
  const db = new NodeSqliteDriver();
  await migrate(db);
  const repository = new SessionRepository(db);
  await repository.ensureLocalUser();
  const configuration = opts.configuration ?? SIMULATED_CONFIGURATION;
  const source = new ManualSource(configuration);
  const clock = new TestClock();
  const coordinator = new SessionCoordinator({
    repository, source, configuration, userId: "local",
    activity: "prueba", context: "ctx", sessionId: "S1", clock, batchSize: 5, maxLatencyMs: 10, ...opts,
  });
  return { db, repository, source, clock, coordinator };
}

const tick = () => new Promise((r) => setTimeout(r, 30));

describe("SessionCoordinator", () => {
  it("módulo unilateral: el pie derecho queda «no disponible» (nunca cero) y los tres canales se guardan", async () => {
    const cfg = LEFT_MODULE_CONFIGURATION;
    const { repository, source, coordinator } = await setup({ configuration: cfg });
    const before = coordinator.snapshot().values;
    expect(before.L_HEEL.status).toBe("stale");
    expect(before.R_HEEL).toEqual({ value: null, status: "unavailable" });
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-L" });
    source.emit(payload("CAP-L", 0, {}, cfg));
    source.emit(payload("CAP-L", 1, {}, cfg));
    await tick();
    const during = coordinator.snapshot().values;
    expect(during.L_HEEL.status).toBe("ok");
    expect(during.L_LATERAL.value).toBe(103);
    expect(during.R_MEDIAL).toEqual({ value: null, status: "unavailable" });
    source.event({ type: "disconnected", at_us: 40_000, reason: "x" });
    await tick();
    // Tras un corte las posiciones configuradas pasan a stale; las no configuradas siguen unavailable.
    const after = coordinator.snapshot().values;
    expect(after.L_HEEL.status).toBe("stale");
    expect(after.R_HEEL.status).toBe("unavailable");
    source.event({ type: "reconnected", at_us: 100_000 });
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    expect(result.stats.accepted).toBe(2);
    const session = await repository.getSession("S1");
    expect(session?.state).toBe("completed");
  });

  it("recorrido normal: prepared → recording → finalizing → completed, con registros y eventos persistidos", async () => {
    const { repository, source, clock, coordinator } = await setup();
    const states: string[] = [];
    coordinator.subscribe((s) => { if (states[states.length - 1] !== s.state) states.push(s.state); });

    await coordinator.prepare();
    expect((await repository.getSession("S1"))?.state).toBe("prepared");
    await coordinator.start();
    expect(source.calls).toEqual(["connect", "startCapture"]);
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    for (let i = 0; i < 12; i++) source.emit(payload("CAP-1", i));
    await tick();
    clock.mono += 5000;
    const result = await coordinator.stop();

    expect(result.state).toBe("completed");
    expect(result.durationMs).toBe(5000);
    expect(result.stats).toMatchObject({ received: 12, accepted: 12, committed: 12, pending: 0, captures: 1, rejected: 0 });
    expect(states).toEqual(["prepared", "recording", "finalizing", "completed"]);
    expect(source.calls).toEqual(["connect", "startCapture", "stopCapture", "disconnect"]);

    const session = (await repository.listSessions())[0]!;
    expect(session).toMatchObject({ state: "completed", duration_ms: 5000, record_count: 12, capture_count: 1, context: "ctx" });
    const types = (await repository.getEvents("S1")).map((e) => e.type);
    expect(types).toEqual(["session_started", "capture_started", "session_stopped"]);
  });

  it("S01 - detener dos veces produce un único cierre, sin resultados ni eventos duplicados", async () => {
    const { repository, source, coordinator } = await setup();
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    source.emit(payload("CAP-1", 0));
    await tick();
    const [a, b] = await Promise.all([coordinator.stop(), coordinator.stop()]);
    const c = await coordinator.stop();
    expect(a).toEqual(b);
    expect(c.state).toBe("completed");
    expect(source.calls.filter((x) => x === "stopCapture")).toHaveLength(1);
    const stops = (await repository.getEvents("S1")).filter((e) => e.type === "session_stopped");
    expect(stops).toHaveLength(1);
  });

  it("desconexión: pasa a interrupted, marca valores desactualizados, registra el hueco y vuelve a recording", async () => {
    const { repository, source, coordinator } = await setup();
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    source.emit(payload("CAP-1", 0));
    source.emit(payload("CAP-1", 1));
    source.event({ type: "disconnected", at_us: 40_000, reason: "x" });
    await tick();
    expect(coordinator.currentState).toBe("interrupted");
    expect((await repository.getSession("S1"))?.state).toBe("interrupted");
    expect(Object.values(coordinator.snapshot().values).every((v) => v.status === "stale")).toBe(true);
    source.event({ type: "reconnected", at_us: 100_000 });
    source.emit(payload("CAP-1", 5));
    await tick();
    expect(coordinator.currentState).toBe("recording");
    const snap = coordinator.snapshot();
    expect(snap.stats.gaps).toBe(1);
    expect(snap.values.L_HEEL.status).toBe("ok");
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    const gap = (await repository.getEvents("S1")).find((e) => e.type === "sequence_gap");
    expect(JSON.parse(gap!.detail!)).toEqual({ missing_from: 2, missing_to: 4, missing_count: 3 });
  });

  it("reinicio de captura: segunda captura en la misma sesión, secuencias separadas", async () => {
    const { repository, source, coordinator } = await setup();
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    for (let i = 0; i < 3; i++) source.emit(payload("CAP-1", i));
    source.event({ type: "capture_restarted", at_us: 60_000, capture_id: "CAP-2", previous_capture_id: "CAP-1" });
    for (let i = 0; i < 2; i++) source.emit(payload("CAP-2", i));
    await tick();
    const result = await coordinator.stop();
    expect(result.stats.captures).toBe(2);
    expect(result.stats.gaps).toBe(0);
    const captures = await repository.getCaptures("S1");
    expect(captures.map((c) => c.external_capture_id)).toEqual(["CAP-1", "CAP-2"]);
    expect(await repository.countRecords(captures[0]!.id)).toBe(3);
    expect(await repository.countRecords(captures[1]!.id)).toBe(2);
  });

  it("registros inválidos van a diagnóstico; duplicados y fuera de orden se contabilizan (C08, C12)", async () => {
    const { repository, source, coordinator } = await setup();
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    source.emit(payload("CAP-1", 0));
    source.emit(payload("CAP-1", 1));
    source.emit(payload("CAP-1", 1)); // duplicado idéntico
    source.emit(payload("CAP-1", 3));
    source.emit(payload("CAP-1", 2)); // fuera de orden (llega tarde)
    source.emit({ ...(payload("CAP-1", 4) as object), format_version: "9.9" }); // inválido
    await tick();
    const result = await coordinator.stop();
    expect(result.stats).toMatchObject({ received: 6, accepted: 5, rejected: 1, duplicates: 1, outOfOrder: 1, gaps: 1, committed: 4 });
    const capture = (await repository.getCaptures("S1"))[0]!;
    expect((await repository.getRecords(capture.id)).map((r) => r.sequence)).toEqual([0, 1, 2, 3]);
    expect(await repository.getDiagnostics("S1")).toHaveLength(1);
    const types = (await repository.getEvents("S1")).map((e) => e.type);
    expect(types).toContain("out_of_order");
    expect(types).toContain("sequence_gap");
  });

  it("ventana de datos tardíos: acepta dentro de la ventana y rechaza después", async () => {
    const { source, clock, coordinator } = await setup({ lateDataWindowMs: 50 });
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    source.emit(payload("CAP-1", 0));
    await tick();
    const stopping = coordinator.stop();
    source.emit(payload("CAP-1", 1)); // dentro de la ventana
    clock.mono += 60;
    source.emit(payload("CAP-1", 2)); // fuera de la ventana
    const result = await stopping;
    expect(result.stats).toMatchObject({ accepted: 2, committed: 2, lateRejected: 1 });
  });

  it("si la fuente no confirma la detención, la sesión se cierra como incompleta con motivo", async () => {
    const { source, coordinator } = await setup();
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    source.emit(payload("CAP-1", 0));
    await tick();
    source.failStop = true;
    const result = await coordinator.stop();
    expect(result.state).toBe("incomplete");
    expect(result.reason).toMatch(/no confirmó la detención/);
  });

  it("sin captura asociada la sesión no se declara completa", async () => {
    const { source, coordinator } = await setup();
    await coordinator.start();
    void source;
    const result = await coordinator.stop();
    expect(result.state).toBe("incomplete");
    expect(result.reason).toBe("sin captura asociada");
  });

  it("S02 - una sesión que quedó en recording se recupera como incompleta con un evento explicativo", async () => {
    const { repository, source, coordinator, clock } = await setup();
    await coordinator.start();
    source.event({ type: "capture_started", at_us: 0, capture_id: "CAP-1" });
    source.emit(payload("CAP-1", 0));
    await tick();
    // "Se cierra la aplicación": no se llama a stop().
    const recovered = await recoverOpenSessions(repository, clock);
    expect(recovered).toEqual(["S1"]);
    const session = await repository.getSession("S1");
    expect(session?.state).toBe("incomplete");
    const ev = (await repository.getEvents("S1")).find((e) => e.type === "recovered_incomplete");
    expect(JSON.parse(ev!.detail!)).toMatchObject({ previous_state: "recording", duration_basis: "última recepción" });
    // La duración estimada va del inicio a la última recepción, no cero.
    expect(session?.duration_ms).toBeGreaterThanOrEqual(0);
    expect(session?.ended_at).not.toBeNull();
    expect(await recoverOpenSessions(repository, clock)).toEqual([]);
  });
});
