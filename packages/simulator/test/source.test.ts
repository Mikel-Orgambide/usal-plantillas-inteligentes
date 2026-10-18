import { describe, expect, it, vi } from "vitest";
import type { SourceEvent } from "@plantillas/contract";
import { SimulatedDataSource } from "../src/index";

describe("SimulatedDataSource", () => {
  it("emite eventos de conexión y un payload por tick, y se detiene al pedirlo", async () => {
    vi.useFakeTimers();
    const source = new SimulatedDataSource({ seed: 9, emit_interval_ms: 10 });
    const payloads: unknown[] = [];
    const events: SourceEvent[] = [];
    source.subscribe({ onPayload: (p) => payloads.push(p), onEvent: (e) => events.push(e) });

    await expect(source.startCapture()).rejects.toThrow();
    await source.connect();
    await source.startCapture();
    expect(source.isCapturing).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(45);
    expect(payloads).toHaveLength(5);
    await source.stopCapture();
    await vi.advanceTimersByTimeAsync(100);
    expect(payloads).toHaveLength(5);
    await source.disconnect();

    expect(events.map((e) => e.type)).toEqual(["connected", "capture_started", "capture_stopped", "disconnected"]);
    expect(source.configuration.source).toBe("simulated");
    vi.useRealTimers();
  });
});

describe("identificadores de captura", () => {
  it("dos ejecuciones de la fuente no repiten capture_id, aunque la semilla sea la misma", async () => {
    vi.useFakeTimers();
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const source = new SimulatedDataSource({ seed: 1, emit_interval_ms: 10 });
      source.subscribe({ onPayload: (p) => ids.push((p as { capture_id: string }).capture_id), onEvent: () => undefined });
      await source.connect();
      await source.startCapture();
      await vi.advanceTimersByTimeAsync(5);
      await source.disconnect();
    }
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toMatch(/^SIM-CAPTURE-[0-9A-Z]+-0001-001$/);
    vi.useRealTimers();
  });

  it("un prefijo explícito se respeta (reproducibilidad en pruebas)", async () => {
    vi.useFakeTimers();
    const ids: string[] = [];
    const source = new SimulatedDataSource({ seed: 1, emit_interval_ms: 10, capture_prefix: "FIJO" });
    source.subscribe({ onPayload: (p) => ids.push((p as { capture_id: string }).capture_id), onEvent: () => undefined });
    await source.connect();
    await source.startCapture();
    await vi.advanceTimersByTimeAsync(5);
    await source.disconnect();
    expect(ids[0]).toBe("FIJO-0001-001");
    vi.useRealTimers();
  });
});
