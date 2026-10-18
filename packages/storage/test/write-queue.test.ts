import { describe, expect, it, vi } from "vitest";
import { WriteQueue } from "../src/index";
import { openRepo, seededSession, simulatedRecords } from "./helpers";

describe("cola de escritura", () => {
  it("guarda en lotes acotados y flush confirma todo lo pendiente", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const batches: number[] = [];
    const queue = new WriteQueue(repo, capture.id, { batchSize: 10, maxLatencyMs: 50, onBatch: (o) => batches.push(o.length) });
    const records = simulatedRecords(33, "S1");
    for (const r of records) queue.enqueue(r);
    expect(queue.stats.pending).toBeGreaterThan(0);
    await queue.flush();
    expect(queue.stats).toMatchObject({ enqueued: 33, committed: 33, pending: 0, failedBatches: 0 });
    expect(batches.every((n) => n <= 10)).toBe(true);
    expect(await repo.countRecords(capture.id)).toBe(33);
    await queue.close();
    expect(() => queue.enqueue(records[0]!)).toThrow();
    await db.close();
  });

  it("vacía por latencia máxima sin llegar al tamaño de lote", async () => {
    vi.useFakeTimers();
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const queue = new WriteQueue(repo, capture.id, { batchSize: 100, maxLatencyMs: 200 });
    for (const r of simulatedRecords(3, "S1")) queue.enqueue(r);
    expect(await repo.countRecords(capture.id)).toBe(0);
    await vi.advanceTimersByTimeAsync(250);
    await queue.flush();
    expect(await repo.countRecords(capture.id)).toBe(3);
    vi.useRealTimers();
    await db.close();
  });

  it("un lote fallido se cuenta y no detiene los siguientes", async () => {
    const { db, repo } = await openRepo();
    const { capture } = await seededSession(repo);
    const errors: unknown[] = [];
    const queue = new WriteQueue(repo, 9999, { batchSize: 5, onError: (e) => errors.push(e) });
    for (const r of simulatedRecords(5, "S1")) queue.enqueue(r);
    await queue.flush();
    expect(errors).toHaveLength(1);
    expect(queue.stats.failedBatches).toBe(1);
    expect(await repo.countRecords(capture.id)).toBe(0);
    await db.close();
  });
});
