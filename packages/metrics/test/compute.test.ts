import { describe, expect, it } from "vitest";
import { CHANNEL_CODES, SIMULATED_CONFIGURATION, normalizeRecord, validateSourceRecord, type NormalizedRecord } from "@plantillas/contract";
import { SCENARIOS, SimulatedGenerator, take, type Scenario } from "@plantillas/simulator";
import { SessionRepository, migrate } from "@plantillas/storage";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { METRIC_VERSION, computeCaptureMetrics, describeValues } from "../src/index";

const AT = "2026-10-18T22:00:00.000-03:00";

async function seeded(count: number, scenario: Scenario = SCENARIOS.normal) {
  const db = new NodeSqliteDriver();
  await migrate(db);
  const repo = new SessionRepository(db);
  await repo.ensureLocalUser();
  await repo.ensureConfiguration(SIMULATED_CONFIGURATION);
  const session = await repo.createSession({ id: "S1", user_id: "local", activity: "prueba", source: "simulated", started_at: AT });
  const records: NormalizedRecord[] = [];
  for (const o of take(new SimulatedGenerator({ seed: 7, scenario }), count * 2)) {
    if (o.kind !== "payload") continue;
    const r = validateSourceRecord(o.payload, SIMULATED_CONFIGURATION);
    if (!r.ok) continue;
    records.push(normalizeRecord(r.record, { source: "simulated", session_id: "S1", received_at: AT }));
    if (records.length === count) break;
  }
  const capture = await repo.openCapture(session.id, SIMULATED_CONFIGURATION, records[0]?.capture_id ?? "CAP-VACIA", AT);
  const outcomes = await repo.insertRecords(capture.id, records);
  if (outcomes.some((o) => o.outcome !== "inserted")) throw new Error("fixture inválido: " + JSON.stringify(outcomes.find((o) => o.outcome !== "inserted")));
  return { db, repo, capture, records };
}

describe("computeCaptureMetrics", () => {
  it("calcula las seis posiciones desde SQLite y coincide con el cálculo directo sobre las muestras", async () => {
    const { db, repo, capture, records } = await seeded(60, SCENARIOS.read_error);
    const metrics = await computeCaptureMetrics(repo, capture.id, () => AT);
    for (const code of CHANNEL_CODES) {
      const readings = records.map((r) => r.samples.find((s) => s.channel_id === code)!);
      const expected = describeValues(readings);
      expect(metrics[code].n_received).toBe(60);
      expect(metrics[code].n_valid).toBe(expected.n_valid);
      expect(metrics[code].n_invalid).toBe(expected.n_invalid);
      expect(metrics[code].sample_max).toBe(expected.sample_max);
      expect(metrics[code].sample_mean).toBeCloseTo(expected.sample_mean!, 9);
      expect(metrics[code].sample_sd_population).toBeCloseTo(expected.sample_sd_population!, 6);
    }
    expect(CHANNEL_CODES.some((c) => metrics[c].n_invalid > 0)).toBe(true);
    await db.close();
  });

  it("persiste los resultados con versión y los reutiliza en la segunda llamada", async () => {
    const { db, repo, capture } = await seeded(20);
    let calls = 0;
    const first = await computeCaptureMetrics(repo, capture.id, () => { calls += 1; return AT; });
    expect(calls).toBe(6);
    const rows = await repo.getResults(capture.id, METRIC_VERSION);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.channel_code)).toEqual([...CHANNEL_CODES].sort());
    const again = await computeCaptureMetrics(repo, capture.id, () => { calls += 1; return AT; });
    expect(calls).toBe(6);
    expect(again).toEqual(first);
    await db.close();
  });

  it("una captura sin registros devuelve 'sin lecturas' en las seis posiciones y lo guarda así", async () => {
    const { db, repo, capture } = await seeded(0);
    const metrics = await computeCaptureMetrics(repo, capture.id, () => AT);
    for (const code of CHANNEL_CODES) {
      expect(metrics[code]).toMatchObject({ n_received: 0, n_valid: 0, sample_mean: null, unavailable_reason: "sin lecturas" });
    }
    const rows = await repo.getResults(capture.id);
    expect(rows.every((r) => r.sample_mean === null && r.n_valid === 0)).toBe(true);
    await db.close();
  });

  it("la tabla result rechaza cantidades incoherentes o descriptores sin lecturas válidas", async () => {
    const { db, repo, capture } = await seeded(0);
    await expect(repo.saveResults(capture.id, [{ channel_code: "L_HEEL", metric_version: "x", unit: "adc_count", n_received: 2, n_valid: 3, n_invalid: -1, sample_mean: 1, sample_max: 1, sample_sd_population: 0, computed_at: AT }])).rejects.toThrow();
    await expect(repo.saveResults(capture.id, [{ channel_code: "L_HEEL", metric_version: "x", unit: "adc_count", n_received: 2, n_valid: 0, n_invalid: 2, sample_mean: 0, sample_max: 0, sample_sd_population: 0, computed_at: AT }])).rejects.toThrow();
    await db.close();
  });
});
