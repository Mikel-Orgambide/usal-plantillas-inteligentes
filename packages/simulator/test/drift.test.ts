import { describe, expect, it } from "vitest";
import { simulatedModuleConfiguration } from "@plantillas/contract";
import { SimulatedGenerator } from "../src/index";

describe("deriva de reloj simulada (ADR 0011)", () => {
  it("con clock_drift_ppm el tiempo de adquisición avanza más rápido que el período nominal", () => {
    const cfg = simulatedModuleConfiguration("right");
    const g = new SimulatedGenerator({ seed: 3, configuration: cfg, record_period_us: 20_000, clock_drift_ppm: 10_000 });
    const payloads: { samples: { time_us: number; channel_id: string }[] }[] = [];
    while (payloads.length < 11) { const o = g.next().value; if (o.kind === "payload") payloads.push(o.payload as (typeof payloads)[number]); }
    expect(payloads[10]!.samples[0]!.time_us).toBe(202_000);
    expect(payloads[10]!.samples.map((s) => s.channel_id)).toEqual(["R_HEEL", "R_MEDIAL", "R_LATERAL"]);
    const g0 = new SimulatedGenerator({ seed: 3, configuration: cfg, record_period_us: 20_000 });
    const p0: { samples: { time_us: number }[] }[] = [];
    while (p0.length < 11) { const o = g0.next().value; if (o.kind === "payload") p0.push(o.payload as (typeof p0)[number]); }
    expect(p0[10]!.samples[0]!.time_us).toBe(200_000);
  });
});
