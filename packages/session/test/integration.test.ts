import { describe, expect, it } from "vitest";
import { SIMULATED_CONFIGURATION, simulatedModuleConfiguration } from "@plantillas/contract";
import { computeBilateral } from "@plantillas/metrics";
import { SCENARIOS, SimulatedDataSource } from "@plantillas/simulator";
import { SessionRepository, exportSessionBundle, migrate } from "@plantillas/storage";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { SessionCoordinator } from "../src/index";

describe("coordinador + simulador + SQLite", () => {
  it("una sesión simulada con reinicio de captura termina completa y recuperable", async () => {
    const db = new NodeSqliteDriver();
    await migrate(db);
    const repository = new SessionRepository(db);
    await repository.ensureLocalUser();
    const source = new SimulatedDataSource({ seed: 4, scenario: SCENARIOS.capture_restart, emit_interval_ms: 2 });
    const coordinator = new SessionCoordinator({
      repository, source, configuration: SIMULATED_CONFIGURATION, userId: "local", activity: "integración", sessionId: "INT-1",
    });
    await coordinator.start();
    await new Promise((r) => setTimeout(r, 120));
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    expect(result.stats.captures).toBe(2);
    expect(result.stats.accepted).toBeGreaterThan(10);
    expect(result.stats.committed).toBe(result.stats.accepted);
    const summary = (await repository.listSessions())[0]!;
    expect(summary.record_count).toBe(result.stats.accepted);
    expect(summary.capture_count).toBe(2);
    await db.close();
  });

  it("dos fuentes simuladas (una por pie, relojes distintos): sesión bilateral completa con métricas izquierda/derecha", async () => {
    const db = new NodeSqliteDriver();
    await migrate(db);
    const repository = new SessionRepository(db);
    await repository.ensureLocalUser();
    const left = simulatedModuleConfiguration("left"), right = simulatedModuleConfiguration("right");
    const modules = [
      { configuration: left, source: new SimulatedDataSource({ seed: 1, scenario: SCENARIOS.normal, emit_interval_ms: 2, configuration: left }) },
      { configuration: right, source: new SimulatedDataSource({ seed: 2, scenario: SCENARIOS.normal, emit_interval_ms: 2, configuration: right, clock_drift_ppm: 20_000 }) },
    ];
    const coordinator = new SessionCoordinator({ repository, modules, userId: "local", activity: "integración", sessionId: "INT-2" });
    await coordinator.start();
    await new Promise((r) => setTimeout(r, 150));
    const snap = coordinator.snapshot();
    expect(snap.bilateral).toBe(true);
    expect(snap.modules.map((m) => m.status)).toEqual(["connected", "connected"]);
    const result = await coordinator.stop();
    expect(result.state).toBe("completed");
    expect(result.stats.captures).toBe(2);
    expect(result.stats.committed).toBe(result.stats.accepted);
    const captures = await repository.getCaptures("INT-2");
    expect(captures.map((c) => c.device_id).sort()).toEqual(["SIM-L", "SIM-R"]);
    const bundle = (await exportSessionBundle(db, "INT-2"))!;
    const devByCapture = new Map(bundle.captures.map((c) => [c.external_capture_id, c.device_id]));
    const bil = computeBilateral(bundle.records.map((r) => ({ device_id: devByCapture.get(r.capture_id)!, received_at: r.received_at, samples: r.samples })));
    expect(bil.distribution?.left_share).not.toBeNull();
    expect(bil.complete_fraction).toBeGreaterThan(0.8);
    expect(typeof bil.offset_ms).toBe("number");
    await db.close();
  });
});
