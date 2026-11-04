import { describe, expect, it } from "vitest";
import type { SourceEvent } from "@plantillas/contract";
import { SessionRepository, migrate } from "@plantillas/storage";
import { NodeSqliteDriver } from "@plantillas/storage/node";
import { SessionCoordinator } from "@plantillas/session";
import { BleDataSource, ProtocolError, parseDeviceInfo } from "../src/index";
import { FIRMWARE_INFO, LEFT_FIRMWARE_INFO, RIGHT_FIRMWARE_INFO, FakeBoard } from "./fake-board";

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

  it("corte sin reinicio: al reconectar la placa confirma la misma captura y no hay reinicio", async () => {
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info, { reconnect: async () => board, reconnectDelayMs: 5 });
    const { events } = collect(src);
    await src.connect();
    await src.startCapture();
    board.cut();
    await tick(30);
    expect(events.map((e) => e.type)).toEqual(["connected", "capture_started", "disconnected", "reconnected"]);
    expect(board.writes).toEqual([[0x01], [0x01]]);
  });

  it("reinicio de la placa durante la sesión: reconexión y captura nueva informada como reinicio", async () => {
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info, { reconnect: async () => board, reconnectDelayMs: 5 });
    const { payloads, events } = collect(src);
    await src.connect();
    await src.startCapture();
    board.emit();
    board.reboot();
    await tick(30);
    board.emit();
    expect(events.map((e) => e.type)).toEqual(["connected", "capture_started", "disconnected", "reconnected", "capture_restarted"]);
    expect(events[4]).toMatchObject({ capture_id: "ESP32-9E7EE4-B9-C1", previous_capture_id: "ESP32-9E7EE4-B8-C1" });
    expect(payloads.map((p) => (p as { capture_id: string }).capture_id)).toEqual(["ESP32-9E7EE4-B8-C1", "ESP32-9E7EE4-B9-C1"]);
  });

  it("detener sin enlace (reconexión agotada) informa el error sin promesas sin manejar", async () => {
    const board = new FakeBoard();
    const src = new BleDataSource(board, configuration, info, { reconnect: async () => { throw new Error("la placa no se anuncia"); }, reconnectAttempts: 2, reconnectDelayMs: 5 });
    const { events } = collect(src);
    await src.connect();
    await src.startCapture();
    board.cut();
    await tick(40);
    await src.stopCapture();
    await src.disconnect();
    const types = events.map((e) => e.type);
    // Agotados los intentos, la fuente ya se declaró caída: detener y desconectar no agregan eventos.
    expect(types).toEqual(["connected", "capture_started", "disconnected", "source_error"]);
    expect((events[3] as { message: string }).message).toMatch(/2 intentos: la placa no se anuncia/);
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

  it("dos placas a la vez (una por pie): dos fuentes BLE independientes, el corte de una no afecta a la otra (ADR 0011)", async () => {
    const db = new NodeSqliteDriver();
    await migrate(db);
    const repo = new SessionRepository(db);
    await repo.ensureLocalUser();
    const parse = (i: Record<string, unknown>) => parseDeviceInfo(Array.from(new TextEncoder().encode(JSON.stringify(i))));
    const L = parse(LEFT_FIRMWARE_INFO), R = parse(RIGHT_FIRMWARE_INFO);
    const bl = new FakeBoard(185, LEFT_FIRMWARE_INFO), br = new FakeBoard(185, RIGHT_FIRMWARE_INFO);
    const sl = new BleDataSource(bl, L.configuration, L.info, { reconnect: async () => bl, reconnectDelayMs: 5 });
    const sr = new BleDataSource(br, R.configuration, R.info, { reconnect: async () => br, reconnectDelayMs: 5 });
    const coord = new SessionCoordinator({
      repository: repo, modules: [{ source: sl, configuration: L.configuration }, { source: sr, configuration: R.configuration }],
      userId: "local", activity: "caminata", sessionId: "P2", batchSize: 2, maxLatencyMs: 5,
    });
    await coord.start();
    for (let i = 0; i < 3; i++) { bl.emit([100, 200, 300]); br.emit([110, 210, 310]); }
    br.cut();
    br.emit([0, 0, 0], false); // perdido durante el corte
    bl.emit([100, 200, 300]);
    await tick(30);
    const mid = coord.snapshot();
    expect(mid.state).toBe("recording");
    expect(mid.modules.map((m) => m.status)).toEqual(["connected", "connected"]); // el derecho ya reconectó
    br.emit([110, 210, 310]);
    await tick(10);
    const result = await coord.stop();
    expect(result.state).toBe("completed");
    const captures = await repo.getCaptures("P2");
    expect(captures.map((c) => [c.device_id, c.external_capture_id])).toEqual([["ESP32-9E7EE4", "ESP32-9E7EE4-B8-C1"], ["ESP32-A1B2C3", "ESP32-A1B2C3-B8-C1"]]);
    expect(await repo.countRecords(captures[0]!.id)).toBe(4);
    expect(await repo.countRecords(captures[1]!.id)).toBe(4);
    const events = await repo.getEvents("P2");
    const lost = events.find((e) => e.type === "module_lost");
    expect(JSON.parse(lost!.detail!)).toMatchObject({ device_id: "ESP32-A1B2C3", foot: "right" });
    expect(events.some((e) => e.type === "module_recovered")).toBe(true);
    // El hueco de secuencia está en la captura derecha, no en la izquierda.
    const gap = events.find((e) => e.type === "sequence_gap");
    expect(gap?.capture_id).toBe(captures[1]!.id);
    await db.close();
  });
});
