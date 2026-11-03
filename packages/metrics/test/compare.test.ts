import { describe, expect, it } from "vitest";
import { CHANNEL_CODES, type ChannelCode } from "@plantillas/contract";
import { METRIC_VERSION, assessComparability, compareMetrics, describeValues, notInstrumented, type CaptureMetrics, type ComparisonSide } from "../src/index";

const side = (over: Partial<ComparisonSide> = {}): ComparisonSide => ({
  configuration_id: "SIM-CONFIG-001", source: "simulated", unit: "adc_count", metric_version: METRIC_VERSION, activity: "caminata", context: null, capture_count: 1, ...over,
});

function metricsOf(values: Partial<Record<ChannelCode, number[]>>): CaptureMetrics {
  const out = {} as Record<ChannelCode, ReturnType<typeof describeValues>>;
  for (const c of CHANNEL_CODES) out[c] = describeValues((values[c] ?? []).map((v) => ({ raw_value: v, status: "ok" as const })));
  return out;
}

describe("compareMetrics con módulo unilateral", () => {
  it("sólo compara las posiciones instrumentadas en ambos lados", () => {
    const left = (v: number): CaptureMetrics => ({
      ...metricsOf({ L_HEEL: [v], L_MEDIAL: [v], L_LATERAL: [v] }),
      R_HEEL: notInstrumented(), R_MEDIAL: notInstrumented(), R_LATERAL: notInstrumented(),
    });
    const d = compareMetrics(left(100), left(130));
    expect(d.map((x) => x.channel)).toEqual(["L_HEEL", "L_MEDIAL", "L_LATERAL"]);
    expect(d[0]!.delta_mean).toBe(30);
  });
});

describe("assessComparability", () => {
  it("compatibles con mismas configuración, unidad, procedencia y versión; sin advertencias", () => {
    const r = assessComparability(side(), side());
    expect(r.compatible).toBe(true);
    expect(r.requirements.every((x) => x.ok)).toBe(true);
    expect(r.caveats).toEqual([]);
  });

  it("U03 - procedencia o configuración distinta bloquea y deja el motivo visible", () => {
    const r = assessComparability(side(), side({ source: "physical", configuration_id: "ESP32-CFG-1" }));
    expect(r.compatible).toBe(false);
    expect(r.requirements.filter((x) => !x.ok).map((x) => x.code)).toEqual(["configuration", "source"]);
  });

  it("versión de métrica distinta bloquea (los resultados no son comparables entre algoritmos)", () => {
    const r = assessComparability(side(), side({ metric_version: "desc-0.9" }));
    expect(r.compatible).toBe(false);
    expect(r.requirements.find((x) => x.code === "metric_version")?.ok).toBe(false);
  });

  it("actividad, contexto o reinicios distintos no bloquean pero se señalan", () => {
    const r = assessComparability(side({ context: "cinta" }), side({ activity: "running", capture_count: 2 }));
    expect(r.compatible).toBe(true);
    expect(r.caveats.map((c) => c.code)).toEqual(["activity", "context", "multiple_captures"]);
  });
});

describe("compareMetrics", () => {
  it("diferencias B − A por canal en media, máximo y desvío, con razón relativa a A", () => {
    const a = metricsOf({ L_HEEL: [100, 200, 300], R_HEEL: [50, 50] });
    const b = metricsOf({ L_HEEL: [200, 300, 400], R_HEEL: [50, 50] });
    const d = compareMetrics(a, b);
    const lh = d.find((x) => x.channel === "L_HEEL")!;
    expect(lh.delta_mean).toBe(100);
    expect(lh.delta_max).toBe(100);
    expect(lh.delta_sd).toBeCloseTo(0, 9);
    expect(lh.delta_mean_ratio).toBeCloseTo(0.5, 9);
    const rh = d.find((x) => x.channel === "R_HEEL")!;
    expect(rh).toMatchObject({ delta_mean: 0, delta_max: 0, delta_sd: 0, delta_mean_ratio: 0 });
  });

  it("si un lado no tiene lecturas válidas la diferencia es null (no cero)", () => {
    const d = compareMetrics(metricsOf({ L_HEEL: [100] }), metricsOf({}));
    const lh = d.find((x) => x.channel === "L_HEEL")!;
    expect(lh).toMatchObject({ delta_mean: null, delta_max: null, delta_sd: null, delta_mean_ratio: null });
    expect(lh.b.unavailable_reason).toBe("sin lecturas");
    expect(d).toHaveLength(6);
  });

  it("media de A igual a cero: diferencia absoluta sí, razón no", () => {
    const d = compareMetrics(metricsOf({ L_HEEL: [0, 0] }), metricsOf({ L_HEEL: [10, 10] }));
    expect(d[0]).toMatchObject({ delta_mean: 10, delta_mean_ratio: null });
  });
});
