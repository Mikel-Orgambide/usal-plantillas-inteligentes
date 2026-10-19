import { describe, expect, it } from "vitest";
import type { SourceEvent } from "@plantillas/contract";
import { SessionRepository, migrate } from "@plantillas/storage";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { SessionCoordinator } from "@plantillas/session";
import { BleDataSource, ProtocolError, parseDeviceInfo } from "../src/index";
import { FIRMWARE_INFO, FakeBoard } from "./fake-board";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const { info, configuration } = parseDeviceInfo(Array.from(new TextEncoder().encode(JSON.stringify(FIRMWARE_INFO))));

function collect(source: BleDataSource) {
  const payloads: unknown[] = [];
  const events: SourceEvent[] = [];
  source.subscribe({ onPayload: (p) => payloads.push(p), onEvent: (e) => events.push(e) });
  return { payloads, events };
}

describe("BleDataSource", () => {
  it("start espera la confirmación de la placa y anuncia el capture_id real; stop también", async () => {
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info);
    const { payloads, events } = collect(src);
    await src.connect();
    await src.startCapture();
    board.emit(); board.emit();
    await src.stopCapture();
    expect(board.writes).toEqual([[0x01], [0x02]]);
    expect(events.map((e) => e.type)).toEqual(["connected", "capture_started", "capture_stopped"]);
    expect(events[1]).toMatchObject({ capture_id: "ESP32-9E7EE4-B8-C1" });
    expect(payloads).toHaveLength(2);
  });

  it("sin confirmación de la placa, startCapture falla (una orden enviada no acredita captura iniciada)", async () => {
    const board = new FakeBoard();
    board.ackStart = false;
    const src = new BleDataSource(board, configuration, info, { ackTimeoutMs: 30 });
    await src.connect();
    await expect(src.startCapture()).rejects.toThrow(/sin confirmación/);
  });

  it("rechaza conectar si el MTU negociado no alcanza para un registro", async () => {
    const src = new BleDataSource(new FakeBoard(23), configuration, info);
    await expect(src.connect()).rejects.toThrow(ProtocolError);
  });

  it("corte del enlace: disconnected, reconexión y reconnected; las notificaciones siguen llegando", async () => {
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info, { reconnect: async () => board, reconnectDelayMs: 5 });
    const { payloads, events } = collect(src);
    await src.connect();
    await src.startCapture();
    board.emit();
    board.cut();
    board.emit(undefined, false); // generado durante el corte, no llega
    await tick(30);
    board.emit();
    expect(events.map((e) => e.type)).toEqual(["connected", "capture_started", "disconnected", "reconnected"]);
    expect(payloads.map((p) => (p as { sequence: number }).sequence)).toEqual([0, 2]);
  });

  it("notificaciones malformadas se cuentan y no llegan al coordinador", async () => {
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info);
    const { payloads } = collect(src);
    await src.connect();
    // @ts-expect-error acceso de prueba al monitor registrado
    board.monitors.get("7a0e0005-5d3f-4b1a-9f4c-2e6b8c1d0001")([1, 2, 3]);
    expect(payloads).toHaveLength(0);
    expect(src.decodeErrors).toBe(1);
  });
});

describe("integración con el coordinador y SQLite", () => {
  it("sesión física: registros guardados con procedencia physical, hueco por notificación perdida, reconexión", async () => {
    const db = new NodeSqliteDriver();
    await migrate(db);
    const repo = new SessionRepository(db);
    await repo.ensureLocalUser();
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info, { reconnect: async () => board, reconnectDelayMs: 5 });
    const coord = new SessionCoordinator({ repository: repo, source: src, configuration, userId: "local", activity: "caminata", sessionId: "P1", batchSize: 2, maxLatencyMs: 5 });
    await coord.start();
    board.emit(); board.emit([0, 0, 0, 0, 0, null]);
    board.cut();
    board.emit(undefined, false);
    await tick(30);
    board.emit(); board.emit();
    const result = await coord.stop();
    expect(result.state).toBe("completed");
    const session = await repo.getSession("P1");
    expect(session?.source).toBe("physical");
    const [capture] = await repo.getCaptures("P1");
    expect(capture?.external_capture_id).toBe("ESP32-9E7EE4-B8-C1");
    expect(await repo.countRecords(capture!.id)).toBe(4);
    const types = (await repo.getEvents("P1")).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["connected", "capture_started", "disconnected", "reconnected", "sequence_gap", "capture_stopped", "session_stopped"]));
    const q = await repo.getCaptureQuality(capture!.id);
    expect(q).toMatchObject({ records: 4, max_sequence: 4, read_errors: 1 });
    await db.close();
  });
});
