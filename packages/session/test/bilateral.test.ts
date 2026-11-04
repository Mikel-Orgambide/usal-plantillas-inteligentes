import { describe, expect, it } from "vitest";
import { LEFT_MODULE_CONFIGURATION, RIGHT_MODULE_CONFIGURATION, SIMULATED_CONFIGURATION, simulatedModuleConfiguration } from "@plantillas/contract";
import { SessionRepository, exportSessionBundle, migrate, restoreSessionBundle } from "@plantillas/storage";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { computeBilateral } from "@plantillas/metrics";
import { SessionCoordinator, type Clock } from "../src/index";
import { ManualSource, payload } from "./manual-source";

/**
 * Comprobación de la preparación bilateral con dos fuentes simuladas (cierre del
 * 27/10 §6.5, ADR 0011). No acredita la conexión real de dos placas.
 */

class TestClock implements Clock {
  mono = 1000;
  nowIso(): string { return new Date(1_760_000_000_000 + this.mono).toISOString(); }
  monotonicMs(): number { return this.mono; }
}

const L = LEFT_MODULE_CONFIGURATION, R = RIGHT_MODULE_CONFIGURATION;
const tick = () => new Promise((r) => setTimeout(r, 30));

async function setup(mods: { config: typeof L; fail?: boolean }[] = [{ config: L }, { config: R }]) {
  const db = new NodeSqliteDriver();
  await migrate(db);
  const repository = new SessionRepository(db);
  await repository.ensureLocalUser();
  const sources = mods.map((m) => { const s = new ManualSource(m.config); if (m.fail) s.failConnect = true; return s; });
  const clock = new TestClock();
  const coordinator = new SessionCoordinator({
    repository, modules: sources.map((source, i) => ({ source, configuration: mods[i]!.config })),
    userId: "local", activity: "prueba", sessionId: "B1", clock, batchSize: 5, maxLatencyMs: 10,
  });
  return { db, repository, sources, clock, coordinator };
}

/** Emite n registros del módulo, avanzando el reloj del teléfono `periodMs` por registro. */
function emitRun(src: ManualSource, cfg: typeof L, cap: string, clock: TestClock, from: number, n: number, periodMs = 50, timeOffsetUs = 0) {
  for (let i = 0; i < n; i++) {
    const seq = from + i;
    const p = payload(cap, seq, {}, cfg) as { samples: { time_us: number }[] };
    for (const s of p.samples) s.time_us += timeOffsetUs;
    src.emit(p);
    clock.mono += periodMs;
  }
}

describe("sesión con dos módulos", () => {
  it("rechaza dos módulos del mismo pie, procedencias mezcladas y más de dos", async () => {
    const db = new NodeSqliteDriver(); await migrate(db);
    const repository = new SessionRepository(db);
    const mk = (cfgs: (typeof L)[]) => new SessionCoordinator({ repository, modules: cfgs.map((c) => ({ source: new ManualSource(c), configuration: c })), userId: "local", activity: "x", sessionId: "X" });
    expect(() => mk([L, L])).toThrow(/mismo pie/);
    expect(() => mk([L, simulatedModuleConfiguration("right")])).toThrow(/procedencias/);
    expect(() => mk([L, R, L])).toThrow(/máximo dos/);
    expect(() => mk([SIMULATED_CONFIGURATION, R])).toThrow(/un solo pie/);
    expect(() => mk([simulatedModuleConfiguration("left"), simulatedModuleConfiguration("right")])).not.toThrow();
  });

  it("dos módulos identificables: recepción independiente, una captura por dispositivo, valores de ambos pies", async () => {
    const { repository, sources, clock, coordinator } = await setup();
    const snap0 = coordinator.snapshot();
    expect(snap0.modules.map((m) => [m.device_id, m.foot, m.status])).toEqual([["ESP32-000000", "left", "identified"], ["ESP32-000001", "right", "identified"]]);
    expect(snap0.bilateral).toBe(true);
    await coordinator.start();
    const [sl, sr] = sources as [ManualSource, ManualSource];
    sl.event({ type: "capture_started", at_us: 0, capture_id: "CAP-L" });
    sr.event({ type: "capture_started", at_us: 0, capture_id: "CAP-R" });
    emitRun(sl, L, "CAP-L", clock, 0, 10);
    emitRun(sr, R, "CAP-R", clock, 0, 7);
    await tick();
    const snap = coordinator.snapshot();
    expect(snap.modules.map((m) => [m.captureId, m.stats.accepted, m.status])).toEqual([["CAP-L", 10, "connected"], ["CAP-R", 7, "connected"]]);
    expect(snap.stats.accepted).toBe(17);
    expect(snap.values.L_HEEL.status).toBe("ok");
    expect(snap.values.R_LATERAL.status).toBe("ok");
    expect(snap.values.R_LATERAL.value).toBe(100 + 6 + 2);
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    expect(result.stats.captures).toBe(2);
    const captures = await repository.getCaptures("B1");
    expect(captures.map((c) => [c.device_id, c.configuration_id, c.external_capture_id])).toEqual([
      ["ESP32-000000", "ESP32-FSR-L-001", "CAP-L"], ["ESP32-000001", "ESP32-FSR-R-001", "CAP-R"],
    ]);
    expect(await repository.countRecords(captures[0]!.id)).toBe(10);
    expect(await repository.countRecords(captures[1]!.id)).toBe(7);
    // Secuencias por dispositivo, sin secuencia global: sin huecos aunque los conteos difieran.
    expect(result.stats.gaps).toBe(0);
  });

  it("falta de un módulo al inicio: la sesión arranca con el otro y lo registra como perdido", async () => {
    const { repository, sources, clock, coordinator } = await setup([{ config: L }, { config: R, fail: true }]);
    await coordinator.start();
    const snap = coordinator.snapshot();
    expect(snap.state).toBe("recording");
    expect(snap.modules[1]!.status).toBe("disconnected");
    expect(snap.values.R_HEEL.status).toBe("stale");
    const sl = sources[0]!;
    sl.event({ type: "capture_started", at_us: 0, capture_id: "CAP-L" });
    emitRun(sl, L, "CAP-L", clock, 0, 4);
    await tick();
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    const events = await repository.getEvents("B1");
    const lost = events.find((e) => e.type === "module_lost");
    expect(JSON.parse(lost!.detail!)).toMatchObject({ device_id: "ESP32-000001", foot: "right" });
    expect((await repository.getCaptures("B1")).length).toBe(1);
  });

  it("pérdida y reconexión de un módulo: la sesión sigue, el tramo queda incompleto y las métricas bilaterales lo excluyen", async () => {
    const { db, repository, sources, clock, coordinator } = await setup();
    await coordinator.start();
    const [sl, sr] = sources as [ManualSource, ManualSource];
    sl.event({ type: "capture_started", at_us: 0, capture_id: "CAP-L" });
    sr.event({ type: "capture_started", at_us: 0, capture_id: "CAP-R" });
    // 2 s con ambos (intercalados), 2 s sólo izquierdo, 2 s con ambos.
    for (let i = 0; i < 40; i++) { emitRun(sl, L, "CAP-L", clock, i, 1, 0); emitRun(sr, R, "CAP-R", clock, i, 1, 50); }
    sr.event({ type: "disconnected", at_us: 2_000_000, reason: "simulated" });
    await tick();
    expect(coordinator.currentState).toBe("recording"); // el izquierdo sigue
    expect(coordinator.snapshot().modules[1]!.status).toBe("reconnecting");
    expect(coordinator.snapshot().values.R_HEEL.status).toBe("stale");
    emitRun(sl, L, "CAP-L", clock, 40, 40);
    sr.event({ type: "reconnected", at_us: 4_000_000 });
    for (let i = 80; i < 120; i++) { emitRun(sl, L, "CAP-L", clock, i, 1, 0); emitRun(sr, R, "CAP-R", clock, i, 1, 50); }
    await tick();
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    const events = await repository.getEvents("B1");
    expect(events.map((e) => e.type)).toContain("module_lost");
    const rec = events.find((e) => e.type === "module_recovered");
    expect(JSON.parse(rec!.detail!)).toMatchObject({ device_id: "ESP32-000001", foot: "right" });
    expect(JSON.parse(rec!.detail!).incomplete_ms).toBeGreaterThanOrEqual(2000);
    // El hueco de secuencia del derecho (40..79 no transmitidos) queda en su captura, no en la izquierda.
    expect(result.stats.gaps).toBe(1);
    expect(coordinator.snapshot().modules[1]!.stats.gaps).toBe(1);

    const bundle = (await exportSessionBundle(db, "B1"))!;
    expect(bundle.configurations!.map((c) => c.configuration_id)).toEqual(["ESP32-FSR-L-001", "ESP32-FSR-R-001"]);
    const devByCapture = new Map(bundle.captures.map((c) => [c.external_capture_id, c.device_id]));
    const bil = computeBilateral(bundle.records.map((r) => ({ device_id: devByCapture.get(r.capture_id)!, received_at: r.received_at, samples: r.samples })));
    expect(bil.modules).toEqual({ left: "ESP32-000000", right: "ESP32-000001" });
    expect(bil.complete_intervals.length).toBe(2);
    expect(bil.complete_fraction).toBeGreaterThan(0.5);
    expect(bil.complete_fraction).toBeLessThan(0.8);
    expect(bil.distribution!.bilateral).toBe(true);
    expect(bil.distribution!.left_share).not.toBeNull();
    // Dentro de los tramos completos entran 80 registros izquierdos y 80 derechos, no los 40 del tramo sin derecho.
    expect(bil.metrics!.L_HEEL.n_valid).toBe(80);
    expect(bil.metrics!.R_HEEL.n_valid).toBe(80);
  });

  it("relojes con distinto origen y deriva: el desfase se estima y se declara, no se corrige", async () => {
    const { db, sources, clock, coordinator } = await setup();
    await coordinator.start();
    const [sl, sr] = sources as [ManualSource, ManualSource];
    sl.event({ type: "capture_started", at_us: 0, capture_id: "CAP-L" });
    sr.event({ type: "capture_started", at_us: 0, capture_id: "CAP-R" });
    // El derecho arrancó su reloj 700 ms antes (time_us mayor para la misma recepción) y deriva +1 %.
    for (let i = 0; i < 40; i++) {
      emitRun(sl, L, "CAP-L", clock, i, 1, 0);
      const p = payload("CAP-R", i, {}, R) as { samples: { time_us: number }[] };
      for (const s of p.samples) s.time_us = Math.round(s.time_us * 1.01) + 700_000;
      sr.emit(p);
      clock.mono += 50;
    }
    await tick();
    await coordinator.stop();
    const bundle = (await exportSessionBundle(db, "B1"))!;
    const devByCapture = new Map(bundle.captures.map((c) => [c.external_capture_id, c.device_id]));
    const bil = computeBilateral(bundle.records.map((r) => ({ device_id: devByCapture.get(r.capture_id)!, received_at: r.received_at, samples: r.samples })));
    expect(bil.offset_ms).toBeLessThan(-650);
    expect(bil.offset_ms).toBeGreaterThan(-760);
    expect(bil.complete_fraction).toBeCloseTo(1, 1);
  });

  it("sin ambos pies las métricas bilaterales quedan no disponibles", () => {
    const only = computeBilateral([{ device_id: "A", received_at: "2026-11-04T00:00:00.000Z", samples: [{ channel_id: "L_HEEL", time_us: 0, raw_value: 10, status: "ok" }] }]);
    expect(only.distribution).toBeNull();
    expect(only.unavailable_reason).toMatch(/ambos pies/);
    expect(computeBilateral([]).modules).toEqual({ left: null, right: null });
  });

  it("recuperación y restauración: sesiones guardadas con uno y con dos módulos se exportan e importan completas", async () => {
    const { db, repository, sources, clock, coordinator } = await setup();
    await coordinator.start();
    const [sl, sr] = sources as [ManualSource, ManualSource];
    sl.event({ type: "capture_started", at_us: 0, capture_id: "CAP-L" });
    sr.event({ type: "capture_started", at_us: 0, capture_id: "CAP-R" });
    emitRun(sl, L, "CAP-L", clock, 0, 6);
    emitRun(sr, R, "CAP-R", clock, 0, 5);
    await tick();
    await coordinator.stop();
    // Sesión unilateral en la misma base.
    const single = new ManualSource(L);
    const uni = new SessionCoordinator({ repository, source: single, configuration: L, userId: "local", activity: "prueba", sessionId: "U1", clock, batchSize: 5, maxLatencyMs: 10 });
    await uni.start();
    single.event({ type: "capture_started", at_us: 0, capture_id: "CAP-U" });
    emitRun(single, L, "CAP-U", clock, 0, 3);
    await tick();
    await uni.stop();

    const other = new NodeSqliteDriver(); await migrate(other);
    const b1 = (await exportSessionBundle(db, "B1"))!;
    const u1 = (await exportSessionBundle(db, "U1"))!;
    expect(u1.configurations!.length).toBe(1);
    const r1 = await restoreSessionBundle(other, JSON.parse(JSON.stringify(b1)));
    const r2 = await restoreSessionBundle(other, JSON.parse(JSON.stringify(u1)));
    expect(r1).toMatchObject({ session: "inserted", captures: 2, records_inserted: 11, records_rejected: 0 });
    expect(r2).toMatchObject({ session: "inserted", captures: 1, records_inserted: 3 });
    const repo2 = new SessionRepository(other);
    const caps = await repo2.getCaptures("B1");
    expect(caps.map((c) => c.device_id).sort()).toEqual(["ESP32-000000", "ESP32-000001"]);
    expect((await repo2.getConfiguration("ESP32-FSR-R-001"))?.channels.map((c) => c.code)).toEqual(["R_HEEL", "R_LATERAL", "R_MEDIAL"].sort());
    // Un paquete anterior (sin `configurations`) sigue restaurando.
    const { configurations: _c, ...legacy } = u1;
    const third = new NodeSqliteDriver(); await migrate(third);
    expect((await restoreSessionBundle(third, legacy as typeof u1)).session).toBe("inserted");
  });
});
