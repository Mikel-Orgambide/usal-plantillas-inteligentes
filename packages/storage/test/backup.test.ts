import { describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/node/index";
import { SessionRepository, countEntities, exportSessionBundle, migrate, restoreSessionBundle, validateBundle } from "../src/index";
import { RECEIVED_AT, openRepo, seededSession, simulatedRecords } from "./helpers";

async function sessionWithData() {
  const { db, repo } = await openRepo();
  const { session, capture } = await seededSession(repo);
  await repo.insertRecords(capture.id, simulatedRecords(40, "S1"));
  await repo.addEvent("S1", capture.id, { type: "capture_started", at_us: 0, capture_id: capture.external_capture_id }, RECEIVED_AT);
  await repo.addEvent("S1", null, { type: "session_stopped", state: "completed" }, RECEIVED_AT);
  await repo.saveResults(capture.id, [{ channel_code: "L_HEEL", metric_version: "desc-1.0", unit: "adc_count", n_received: 40, n_valid: 40, n_invalid: 0, sample_mean: 100, sample_max: 200, sample_sd_population: 10, computed_at: RECEIVED_AT }]);
  await repo.closeSession("S1", RECEIVED_AT, 2000, "completed");
  return { db, repo, session, capture };
}

describe("respaldo por sesión (P05)", () => {
  it("exportar y restaurar en una base separada produce las mismas cantidades y el mismo contenido", async () => {
    const { db } = await sessionWithData();
    const bundle = await exportSessionBundle(db, "S1", () => RECEIVED_AT);
    expect(bundle).not.toBeNull();
    const json = JSON.parse(JSON.stringify(bundle)) as NonNullable<typeof bundle>;

    const other = new NodeSqliteDriver();
    await migrate(other);
    const report = await restoreSessionBundle(other, json);
    expect(report).toMatchObject({ session: "inserted", captures: 1, records_inserted: 40, records_duplicate: 0, records_rejected: 0, events: 2, results: 1 });

    const original = await countEntities(db, "S1");
    const restored = await countEntities(other, "S1");
    expect(restored).toEqual(original);
    expect(original.samples).toBe(240);

    const repo2 = new SessionRepository(other);
    const s = await repo2.getSession("S1");
    expect(s).toMatchObject({ activity: "prueba", state: "completed", duration_ms: 2000, source: "simulated" });
    const [cap] = await repo2.getCaptures("S1");
    expect(cap?.external_capture_id).toBe("SIM-CAPTURE-0001-001");
    expect((await repo2.getSamples(cap!.id, "L_HEEL")).map((x) => x.raw_value)).toEqual((await new SessionRepository(db).getSamples((await new SessionRepository(db).getCaptures("S1"))[0]!.id, "L_HEEL")).map((x) => x.raw_value));
    await db.close();
    await other.close();
  });

  it("restaurar dos veces no duplica nada", async () => {
    const { db } = await sessionWithData();
    const bundle = (await exportSessionBundle(db, "S1"))!;
    const other = new NodeSqliteDriver();
    await migrate(other);
    await restoreSessionBundle(other, bundle);
    const again = await restoreSessionBundle(other, bundle);
    expect(again.session).toBe("exists");
    expect(await countEntities(other, "S1")).toEqual(await countEntities(db, "S1"));
    await db.close();
    await other.close();
  });

  it("restaurar en la misma base donde ya existe la sesión no modifica nada", async () => {
    const { db } = await sessionWithData();
    const before = await countEntities(db);
    const bundle = (await exportSessionBundle(db, "S1"))!;
    expect((await restoreSessionBundle(db, bundle)).session).toBe("exists");
    expect(await countEntities(db)).toEqual(before);
    await db.close();
  });

  it("un archivo que no es un respaldo, o incompleto, se rechaza con motivo", () => {
    expect(() => validateBundle({ hola: 1 })).toThrow(/no es un respaldo/);
    expect(() => validateBundle({ format: "plantillas-session-bundle-1", session: { id: "x" } })).toThrow(/incompleto/);
  });

  it("una sesión sin capturas no se puede exportar; una inexistente devuelve null", async () => {
    const { db, repo } = await openRepo();
    await repo.createSession({ id: "VACIA", user_id: "local", activity: "prueba", source: "simulated", started_at: RECEIVED_AT });
    await expect(exportSessionBundle(db, "VACIA")).rejects.toThrow(/no tiene capturas/);
    expect(await exportSessionBundle(db, "NOPE")).toBeNull();
    await db.close();
  });
});
