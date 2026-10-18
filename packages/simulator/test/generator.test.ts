import { describe, expect, it } from "vitest";
import { SIMULATED_CONFIGURATION, classifySequence, validateSourceRecord } from "@plantillas/contract";
import { SCENARIOS, SimulatedGenerator, take, type GeneratorOutput } from "../src/index";

function payloads(outs: GeneratorOutput[]): unknown[] {
  return outs.filter((o) => o.kind === "payload").map((o) => (o as { payload: unknown }).payload);
}
function events(outs: GeneratorOutput[]) {
  return outs.filter((o) => o.kind === "event").map((o) => (o as { event: { type: string } }).event);
}
function seqOf(p: unknown): number {
  return (p as { sequence: number }).sequence;
}
function validate(p: unknown) {
  return validateSourceRecord(p, SIMULATED_CONFIGURATION);
}

describe("generador determinista", () => {
  it("la misma semilla produce exactamente la misma salida", () => {
    const a = take(new SimulatedGenerator({ seed: 7 }), 40);
    const b = take(new SimulatedGenerator({ seed: 7 }), 40);
    expect(a).toEqual(b);
  });

  it("semillas distintas producen valores distintos con la misma estructura", () => {
    const a = payloads(take(new SimulatedGenerator({ seed: 1 }), 10));
    const b = payloads(take(new SimulatedGenerator({ seed: 2 }), 10));
    expect(a.map(seqOf)).toEqual(b.map(seqOf));
    expect(a).not.toEqual(b);
  });

  it("modo normal: todos los registros válidos, secuencia consecutiva, tiempos con desfase por canal", () => {
    const outs = take(new SimulatedGenerator({ seed: 3 }), 30);
    expect(events(outs)[0]?.type).toBe("capture_started");
    const ps = payloads(outs);
    expect(ps).toHaveLength(29);
    let last: number | undefined;
    for (const p of ps) {
      const r = validate(p);
      expect(r.ok, JSON.stringify(r)).toBe(true);
      if (!r.ok) continue;
      expect(classifySequence(last, r.record.sequence).kind).toBe(last === undefined ? "first" : "next");
      last = r.record.sequence;
      expect(r.record.samples.map((s) => s.time_us)).toEqual(
        r.record.samples.map((_, i) => r.record.sequence * 20_000 + i * 400),
      );
      expect(r.record.capture_id).toBe("SIM-CAPTURE-0003-001");
    }
  });

  it("los valores quedan dentro del rango y responden a la alternancia de pies", () => {
    const ps = payloads(take(new SimulatedGenerator({ seed: 5 }), 200)) as { samples: { channel_id: string; raw_value: number }[] }[];
    for (const p of ps) for (const s of p.samples) {
      expect(s.raw_value).toBeGreaterThanOrEqual(0);
      expect(s.raw_value).toBeLessThanOrEqual(4095);
    }
    // En algún momento el talón izquierdo supera claramente el reposo, y en otro queda en reposo.
    const leftHeel = ps.map((p) => p.samples.find((s) => s.channel_id === "L_HEEL")!.raw_value);
    expect(Math.max(...leftHeel)).toBeGreaterThan(2000);
    expect(Math.min(...leftHeel)).toBeLessThan(500);
  });

  it("modo read_error: una muestra con null y read_error; el registro sigue siendo válido", () => {
    const ps = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.read_error }), 8));
    const p = ps.find((x) => seqOf(x) === 3)!;
    const r = validate(p);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.record.samples.find((x) => x.channel_id === "R_LATERAL");
    expect(s).toMatchObject({ status: "read_error", raw_value: null });
  });

  it("modo disconnect: no se emiten los registros 4–6, hay eventos y la secuencia muestra el hueco", () => {
    const outs = take(new SimulatedGenerator({ scenario: SCENARIOS.disconnect }), 14);
    const types = events(outs).map((e) => e.type);
    expect(types).toContain("disconnected");
    expect(types).toContain("reconnected");
    const seqs = payloads(outs).map(seqOf);
    expect(seqs).not.toContain(4);
    expect(seqs).not.toContain(5);
    expect(seqs).not.toContain(6);
    expect(classifySequence(3, 7)).toEqual({ kind: "gap", missing_from: 4, missing_to: 6, missing_count: 3 });
  });

  it("modo sequence_gap: la secuencia salta y el tiempo avanza en proporción", () => {
    const ps = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.sequence_gap }), 8));
    const seqs = ps.map(seqOf);
    expect(seqs.slice(0, 5)).toEqual([0, 1, 2, 6, 7]);
    const t = (ps[3] as { samples: { time_us: number }[] }).samples[0]!.time_us;
    expect(t).toBe(6 * 20_000);
  });

  it("modo duplicate: el registro 2 se emite dos veces idéntico", () => {
    const ps = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.duplicate }), 8));
    const dups = ps.filter((p) => seqOf(p) === 2);
    expect(dups).toHaveLength(2);
    expect(dups[0]).toEqual(dups[1]);
  });

  it("modo conflict: el registro 2 se emite dos veces con contenido distinto", () => {
    const ps = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.conflict }), 8));
    const dups = ps.filter((p) => seqOf(p) === 2);
    expect(dups).toHaveLength(2);
    expect(dups[0]).not.toEqual(dups[1]);
    expect(validate(dups[1]).ok).toBe(true);
  });

  it("modo capture_restart: nuevo capture_id, secuencia y tiempo desde cero, con evento", () => {
    const outs = take(new SimulatedGenerator({ scenario: SCENARIOS.capture_restart }), 12);
    const restart = events(outs).find((e) => e.type === "capture_restarted") as
      | { capture_id: string; previous_capture_id: string }
      | undefined;
    expect(restart).toBeDefined();
    expect(restart?.previous_capture_id).toBe("SIM-CAPTURE-0001-001");
    expect(restart?.capture_id).toBe("SIM-CAPTURE-0001-002");
    const ps = payloads(outs) as { capture_id: string; sequence: number; samples: { time_us: number }[] }[];
    const second = ps.filter((p) => p.capture_id === "SIM-CAPTURE-0001-002");
    expect(second[0]?.sequence).toBe(0);
    expect(second[0]?.samples[0]?.time_us).toBe(0);
    expect(ps.filter((p) => p.capture_id === "SIM-CAPTURE-0001-001").map((p) => p.sequence)).toEqual([0, 1, 2, 3]);
    // El reinicio ocurre una sola vez: la segunda captura continúa más allá de la secuencia 3.
    const longer = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.capture_restart }), 30)) as { capture_id: string; sequence: number }[];
    expect(new Set(longer.map((p) => p.capture_id)).size).toBe(2);
    expect(Math.max(...longer.filter((p) => p.capture_id === "SIM-CAPTURE-0001-002").map((p) => p.sequence))).toBeGreaterThan(3);
  });

  it("modos contradiction y missing_channel producen payloads que el validador rechaza", () => {
    const c = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.contradiction }), 4)).find((p) => seqOf(p) === 1);
    const rc = validate(c);
    expect(rc.ok).toBe(false);
    if (!rc.ok) expect(rc.errors.map((e) => e.code)).toContain("status_value_mismatch");

    const m = payloads(take(new SimulatedGenerator({ scenario: SCENARIOS.missing_channel }), 4)).find((p) => seqOf(p) === 1);
    const rm = validate(m);
    expect(rm.ok).toBe(false);
    if (!rm.ok) expect(rm.errors.map((e) => e.code)).toContain("missing_channel");
  });
});
