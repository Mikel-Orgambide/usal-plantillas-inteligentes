import { describe, expect, it } from "vitest";
import { RECEIVED_AT, openRepo, seededSession, simulatedRecords } from "./helpers";

describe("usuarios vinculados a una cuenta (etapa 11)", () => {
  it("la primera cuenta adopta al usuario local y sus sesiones previas", async () => {
    const { db, repo } = await openRepo();
    await seededSession(repo, "S1");
    const u = await repo.linkRemoteUser("uuid-A", "a@ejemplo.com");
    expect(u).toMatchObject({ id: "local", remote_id: "uuid-A", email: "a@ejemplo.com" });
    expect((await repo.getSession("S1"))?.user_id).toBe("local");
    expect((await repo.getUserByRemoteId("uuid-A"))?.id).toBe("local");
    await db.close();
  });

  it("una segunda cuenta obtiene un usuario propio y no se reasignan las sesiones de la primera", async () => {
    const { db, repo } = await openRepo();
    await repo.linkRemoteUser("uuid-A", "a@ejemplo.com");
    await seededSession(repo, "S1");
    const b = await repo.linkRemoteUser("uuid-B", "b@ejemplo.com");
    expect(b.id).toBe("uuid-B");
    expect((await repo.getUser("local"))?.remote_id).toBe("uuid-A");
    expect((await repo.getSession("S1"))?.user_id).toBe("local");
    // Volver a iniciar sesión con A devuelve el mismo usuario local.
    expect((await repo.linkRemoteUser("uuid-A", "a@ejemplo.com")).id).toBe("local");
    await db.close();
  });

  it("solo las sesiones cerradas, con capturas y de la cuenta activa quedan pendientes de sincronizar", async () => {
    const { db, repo } = await openRepo();
    await repo.linkRemoteUser("uuid-A", "a@ejemplo.com");
    const { capture } = await seededSession(repo, "S1");
    await repo.insertRecords(capture.id, simulatedRecords(3, "S1"));
    await repo.closeSession("S1", RECEIVED_AT, 1000, "completed");
    await repo.createSession({ id: "S2", user_id: "local", activity: "prueba", source: "simulated", started_at: RECEIVED_AT }); // sigue abierta
    await repo.createSession({ id: "S3", user_id: "local", activity: "prueba", source: "simulated", started_at: RECEIVED_AT });
    await repo.closeSession("S3", RECEIVED_AT, 0, "incomplete"); // sin capturas

    expect((await repo.listSessionsPendingSync("uuid-A")).map((s) => s.id)).toEqual(["S1"]);
    expect(await repo.listSessionsPendingSync("uuid-B")).toEqual([]);

    const pending = await repo.recordSyncAttempt("S1", "uuid-A", { status: "failed", error: "sin red" });
    expect(pending).toMatchObject({ status: "failed", attempts: 1, last_error: "sin red", confirmed_at: null });
    expect((await repo.listSessionsPendingSync("uuid-A")).map((s) => s.id)).toEqual(["S1"]);

    const confirmed = await repo.recordSyncAttempt("S1", "uuid-A", { status: "confirmed", remoteCounts: { captures: 1, records: 3, events: 0, results: 0 } });
    expect(confirmed).toMatchObject({ status: "confirmed", attempts: 2, last_error: null });
    expect(JSON.parse(confirmed.remote_counts!)).toEqual({ captures: 1, records: 3, events: 0, results: 0 });
    expect(confirmed.confirmed_at).not.toBeNull();
    expect(await repo.listSessionsPendingSync("uuid-A")).toEqual([]);
    await db.close();
  });

  it("una confirmación sin cantidades no es válida", async () => {
    const { db } = await openRepo();
    await expect(db.run("INSERT INTO sync_state (session_id, owner_remote_id, status, updated_at) VALUES ('X', 'u', 'confirmed', 't')")).rejects.toThrow();
    await db.close();
  });
});
