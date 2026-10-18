import { SIMULATED_CONFIGURATION, normalizeRecord, validateSourceRecord, type NormalizedRecord } from "@plantillas/contract";
import { SCENARIOS, SimulatedGenerator, take, type Scenario } from "@plantillas/simulator";
import { NodeSqliteDriver } from "../src/node/index";
import { SessionRepository, migrate } from "../src/index";

export const RECEIVED_AT = "2026-10-18T22:00:00.000-03:00";

export async function openRepo(path = ":memory:") {
  const db = new NodeSqliteDriver(path);
  await migrate(db);
  const repo = new SessionRepository(db);
  await repo.ensureLocalUser();
  await repo.ensureConfiguration(SIMULATED_CONFIGURATION);
  return { db, repo };
}

/** Registros normalizados y válidos de una captura simulada. */
export function simulatedRecords(count: number, sessionId: string, scenario: Scenario = SCENARIOS.normal, seed = 1): NormalizedRecord[] {
  const gen = new SimulatedGenerator({ seed, scenario });
  const out: NormalizedRecord[] = [];
  for (const o of take(gen, count * 2)) {
    if (o.kind !== "payload") continue;
    const r = validateSourceRecord(o.payload, SIMULATED_CONFIGURATION);
    if (!r.ok) continue;
    out.push(normalizeRecord(r.record, { source: "simulated", session_id: sessionId, received_at: RECEIVED_AT }));
    if (out.length === count) break;
  }
  return out;
}

export async function seededSession(repo: SessionRepository, id = "S1") {
  const session = await repo.createSession({ id, user_id: "local", activity: "prueba", source: "simulated", started_at: RECEIVED_AT });
  const capture = await repo.openCapture(session.id, SIMULATED_CONFIGURATION, "SIM-CAPTURE-0001-001", RECEIVED_AT);
  return { session, capture };
}
