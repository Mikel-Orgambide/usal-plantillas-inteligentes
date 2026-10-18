import { describe, expect, it } from "vitest";
import { SIMULATED_CONFIGURATION } from "@plantillas/contract";
import { SCENARIOS, SimulatedDataSource } from "@plantillas/simulator";
import { SessionRepository, migrate } from "@plantillas/storage";
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
});
