import { describe, expect, it } from "vitest";
import type { ChannelCode } from "@plantillas/contract";
import { approximateLoad, combineChannelMetrics, computeDistribution, describeValues, instrumentedChannels, notInstrumented, type ChannelMetrics } from "../src/index";

function metrics(values: Partial<Record<ChannelCode, { mean: number; sd?: number; n?: number }>>): Record<ChannelCode, ChannelMetrics> {
  const out = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of ["L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"] as ChannelCode[]) {
    const v = values[code];
    out[code] = v
      ? { metric_version: "desc-1.0", unit: "adc_count", n_received: v.n ?? 10, n_valid: v.n ?? 10, n_invalid: 0, sample_mean: v.mean, sample_max: v.mean * 2, sample_sd_population: v.sd ?? 0 }
      : { metric_version: "desc-1.0", unit: "adc_count", n_received: 10, n_valid: 0, n_invalid: 10, sample_mean: null, sample_max: null, sample_sd_population: null, unavailable_reason: "sin lecturas válidas" };
  }
  return out;
}

/** Métricas del módulo unilateral: pie izquierdo medido, pie derecho no instrumentado. */
function leftOnly(values: Partial<Record<"L_HEEL" | "L_MEDIAL" | "L_LATERAL", { mean: number; sd?: number }>>): Record<ChannelCode, ChannelMetrics> {
  const out = metrics(values);
  for (const code of ["R_HEEL", "R_MEDIAL", "R_LATERAL"] as const) out[code] = notInstrumented();
  return out;
}

describe("distribución con módulo unilateral (tres posiciones)", () => {
  it("calcula antepié/retropié y variabilidad sobre el pie instrumentado; izquierda/derecha y asimetría quedan n/d", () => {
    const d = computeDistribution(leftOnly({ L_HEEL: { mean: 300, sd: 30 }, L_MEDIAL: { mean: 100, sd: 10 }, L_LATERAL: { mean: 100, sd: 10 } }));
    expect(d.unavailable_reason).toBeUndefined();
    expect(d.instrumented).toEqual(["L_HEEL", "L_MEDIAL", "L_LATERAL"]);
    expect(d.bilateral).toBe(false);
    expect(d.left_share).toBeNull();
    expect(d.right_share).toBeNull();
    expect(d.forefoot_share).toBeCloseTo(0.4, 9);
    expect(d.rearfoot_share).toBeCloseTo(0.6, 9);
    expect(d.asymmetry).toEqual({ heel: null, medial: null, lateral: null });
    expect(d.variability).toBeCloseTo(0.1, 9);
    expect(d.total_mean).toBe(500);
  });

  it("una posición instrumentada sin lecturas válidas sigue dejando todo n/d; las no instrumentadas no cuentan", () => {
    const d = computeDistribution(leftOnly({ L_HEEL: { mean: 300 }, L_MEDIAL: { mean: 100 } }));
    expect(d.unavailable_reason).toBe("sin lecturas válidas en L_LATERAL");
    expect(d.instrumented).toHaveLength(3);
  });

  it("combinar ventanas unilaterales conserva el pie derecho como no instrumentado", () => {
    const combined = combineChannelMetrics([leftOnly({ L_HEEL: { mean: 500 } }), leftOnly({ L_HEEL: { mean: 100 } })]);
    expect(combined.L_HEEL.sample_mean).toBe(300);
    expect(combined.R_HEEL.unavailable_reason).toBe("no instrumentado");
    expect(instrumentedChannels(combined)).toEqual(["L_HEEL", "L_MEDIAL", "L_LATERAL"]);
    expect(approximateLoad(combined, 0.05)).toBeCloseTo(300 * 20 * 0.05, 9);
  });
});

describe("distribución de la carga (dist-1.0)", () => {
  it("reparte izquierda/derecha y antepié/retropié a partir de las medias", () => {
    const d = computeDistribution(metrics({ L_HEEL: { mean: 300 }, L_MEDIAL: { mean: 100 }, L_LATERAL: { mean: 100 }, R_HEEL: { mean: 300 }, R_MEDIAL: { mean: 100 }, R_LATERAL: { mean: 100 } }));
    expect(d.left_share).toBeCloseTo(0.5);
    expect(d.right_share).toBeCloseTo(0.5);
    expect(d.forefoot_share).toBeCloseTo(0.4);
    expect(d.rearfoot_share).toBeCloseTo(0.6);
    expect(d.asymmetry).toEqual({ heel: 0, medial: 0, lateral: 0 });
    expect(d.variability).toBe(0);
    expect(d.total_mean).toBe(1000);
    expect(d.unavailable_reason).toBeUndefined();
  });

  it("la asimetría por zona es positiva cuando la izquierda carga más", () => {
    const d = computeDistribution(metrics({ L_HEEL: { mean: 600, sd: 60 }, L_MEDIAL: { mean: 100, sd: 10 }, L_LATERAL: { mean: 100, sd: 10 }, R_HEEL: { mean: 400, sd: 40 }, R_MEDIAL: { mean: 100, sd: 10 }, R_LATERAL: { mean: 100, sd: 10 } }));
    expect(d.left_share).toBeCloseTo(800 / 1400);
    expect(d.asymmetry.heel).toBeCloseTo(0.2);
    expect(d.asymmetry.medial).toBe(0);
    expect(d.variability).toBeCloseTo(0.1);
  });

  it("falta una posición válida ⇒ no disponible, nunca un porcentaje parcial", () => {
    const d = computeDistribution(metrics({ L_HEEL: { mean: 300 }, L_MEDIAL: { mean: 100 }, L_LATERAL: { mean: 100 }, R_HEEL: { mean: 300 }, R_MEDIAL: { mean: 100 } }));
    expect(d.left_share).toBeNull();
    expect(d.forefoot_share).toBeNull();
    expect(d.unavailable_reason).toBe("sin lecturas válidas en R_LATERAL");
  });

  it("todas las medias en cero ⇒ no disponible", () => {
    const d = computeDistribution(metrics({ L_HEEL: { mean: 0 }, L_MEDIAL: { mean: 0 }, L_LATERAL: { mean: 0 }, R_HEEL: { mean: 0 }, R_MEDIAL: { mean: 0 }, R_LATERAL: { mean: 0 } }));
    expect(d.unavailable_reason).toBe("suma de medias nula");
  });
});

describe("combinación de ventanas", () => {
  it("la media combinada ponderada por lecturas válidas coincide con la media de todas las lecturas juntas", () => {
    const a = [100, 200, 300, 400];
    const b = [1000, 1000];
    const win = (vals: number[]) => {
      const m = describeValues(vals.map((v) => ({ raw_value: v, status: "ok" as const })));
      return metrics({ L_HEEL: { mean: m.sample_mean!, sd: m.sample_sd_population!, n: m.n_valid }, L_MEDIAL: { mean: 1 }, L_LATERAL: { mean: 1 }, R_HEEL: { mean: 1 }, R_MEDIAL: { mean: 1 }, R_LATERAL: { mean: 1 } });
    };
    const combined = combineChannelMetrics([win(a), win(b)]);
    const all = describeValues([...a, ...b].map((v) => ({ raw_value: v, status: "ok" as const })));
    expect(combined.L_HEEL.n_valid).toBe(6);
    expect(combined.L_HEEL.sample_mean).toBeCloseTo(all.sample_mean!);
    expect(combined.L_HEEL.sample_sd_population).toBeCloseTo(all.sample_sd_population!);
    expect(combined.L_HEEL.sample_max).toBe(2000); // el máximo del fixture es 2 × media de la ventana mayor
    expect(combined.L_MEDIAL.n_valid).toBe(20);
  });

  it("una ventana sin lecturas válidas en un canal no aporta a ese canal", () => {
    const combined = combineChannelMetrics([metrics({ L_HEEL: { mean: 500 } }), metrics({ L_HEEL: { mean: 100 }, R_HEEL: { mean: 50 } })]);
    expect(combined.L_HEEL.sample_mean).toBeCloseTo(300);
    expect(combined.R_HEEL.sample_mean).toBe(50);
    expect(combined.R_HEEL.n_received).toBe(20);
    expect(combined.L_MEDIAL.sample_mean).toBeNull();
    expect(combined.L_MEDIAL.unavailable_reason).toBe("sin lecturas válidas");
  });

  it("carga acumulada aproximada = suma de medias × tiempo con lecturas válidas", () => {
    const m = metrics({ L_HEEL: { mean: 100, n: 20 }, L_MEDIAL: { mean: 50, n: 20 }, L_LATERAL: { mean: 50, n: 20 }, R_HEEL: { mean: 100, n: 20 }, R_MEDIAL: { mean: 50, n: 20 }, R_LATERAL: { mean: 50, n: 20 } });
    expect(approximateLoad(m, 0.05)).toBeCloseTo(400 * 20 * 0.05);
    expect(approximateLoad(metrics({}), 0.05)).toBeNull();
  });
});
