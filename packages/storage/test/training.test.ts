import { describe, expect, it } from "vitest";
import { NodeSqliteDriver } from "../src/node/index";
import { TrainingRepository, exportSessionBundle, migrate, restoreSessionBundle } from "../src/index";
import { openRepo, seededSession, simulatedRecords } from "./helpers";

const NOW = "2026-11-04T20:00:00.000Z";

describe("rutinas y entrenamiento (ADR 0013)", () => {
  it("guarda una rutina con ejercicios, un entrenamiento con entradas y el vínculo con una sesión", async () => {
    const { db, repo } = await openRepo();
    const tr = new TrainingRepository(db);
    await tr.saveRoutine({ id: "R1", user_id: "local", name: "Pierna", goal: "fuerza", origin: "professional", professional_note: "3 × 10 sin dolor", created_at: NOW, updated_at: NOW, archived: false });
    await tr.replaceItems("R1", [
      { id: "I1", kind: "strength", name: "Sentadilla", target: { kind: "strength", sets: 3, reps: 10, weight_kg: 40 }, instructions: null, rest_sec: 90 },
      { id: "I2", kind: "walk_run", name: "Caminata", target: { kind: "walk_run", duration_min: 20, distance_km: null, pace_note: "suave" }, instructions: null, rest_sec: null },
    ]);
    expect((await tr.getItems("R1")).map((i) => [i.order, i.name])).toEqual([[0, "Sentadilla"], [1, "Caminata"]]);
    // Reordenar y quitar uno: la lista reemplaza.
    await tr.replaceItems("R1", [{ id: "I2", kind: "walk_run", name: "Caminata", target: { kind: "walk_run", duration_min: 20, distance_km: null, pace_note: null }, instructions: null, rest_sec: null }]);
    expect((await tr.getItems("R1")).map((i) => i.id)).toEqual(["I2"]);

    await tr.saveWorkout({ id: "W1", user_id: "local", routine_id: "R1", date: "2026-11-04", started_at: NOW, ended_at: null, state: "in_progress", notes: null });
    expect((await tr.openWorkout("local"))?.id).toBe("W1");
    await tr.saveEntry({ id: "E1", workout_id: "W1", item_id: null, item_name: "Sentadilla", kind: "strength", set_index: 1, reps: 10, weight_kg: 40, duration_s: null, distance_m: null, rpe: 7, discomfort_note: null, notes: null, recorded_at: NOW, session_id: null });
    const { session, capture } = await seededSession(repo, "S1");
    await repo.insertRecords(capture.id, simulatedRecords(5, session.id));
    await tr.linkSession({ session_id: "S1", workout_id: "W1", entry_id: "E1" });
    expect(await tr.getSessionLink("S1")).toEqual({ session_id: "S1", workout_id: "W1", entry_id: "E1" });
    expect(await tr.countTraining("local")).toEqual({ routines: 1, workouts: 1, entries: 1, links: 1 });
    // Borrar la entrada deja el vínculo sin serie; borrar el entrenamiento borra el vínculo.
    await tr.deleteEntry("E1");
    expect((await tr.getSessionLink("S1"))?.entry_id).toBeNull();
    await tr.deleteWorkout("W1");
    expect(await tr.getSessionLink("S1")).toBeUndefined();
    await db.close();
  });

  it("el respaldo de una sesión vinculada lleva el entrenamiento y se restaura con el vínculo", async () => {
    const { db, repo } = await openRepo();
    const tr = new TrainingRepository(db);
    const { session, capture } = await seededSession(repo, "S2");
    await repo.insertRecords(capture.id, simulatedRecords(5, session.id));
    await repo.closeSession("S2", NOW, 1000);
    await tr.saveRoutine({ id: "R2", user_id: "local", name: "Pierna", goal: null, origin: "own", professional_note: null, created_at: NOW, updated_at: NOW, archived: false });
    await tr.saveWorkout({ id: "W2", user_id: "local", routine_id: "R2", date: "2026-11-04", started_at: NOW, ended_at: NOW, state: "completed", notes: null });
    await tr.saveEntry({ id: "E2", workout_id: "W2", item_id: null, item_name: "Sentadilla", kind: "strength", set_index: 3, reps: 8, weight_kg: 45, duration_s: null, distance_m: null, rpe: 8, discomfort_note: "molestia leve", notes: null, recorded_at: NOW, session_id: null });
    await tr.linkSession({ session_id: "S2", workout_id: "W2", entry_id: "E2" });
    const bundle = await exportSessionBundle(db, "S2");
    expect(bundle?.training?.routine_name).toBe("Pierna");
    expect(bundle?.training?.entry?.id).toBe("E2");

    const db2 = new NodeSqliteDriver();
    await migrate(db2);
    const report = await restoreSessionBundle(db2, bundle!);
    expect(report.training).toBe("linked");
    const tr2 = new TrainingRepository(db2);
    expect((await tr2.getWorkout("W2"))?.routine_id).toBeNull();
    expect((await tr2.getEntries("W2")).map((e) => e.discomfort_note)).toEqual(["molestia leve"]);
    expect(await tr2.getSessionLink("S2")).toEqual({ session_id: "S2", workout_id: "W2", entry_id: "E2" });
    // Un paquete sin entrenamiento sigue restaurando igual.
    const { training: _t, ...plain } = bundle!;
    const db3 = new NodeSqliteDriver();
    await migrate(db3);
    expect((await restoreSessionBundle(db3, plain)).training).toBe("none");
    await db.close(); await db2.close(); await db3.close();
  });
});
