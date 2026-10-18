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
