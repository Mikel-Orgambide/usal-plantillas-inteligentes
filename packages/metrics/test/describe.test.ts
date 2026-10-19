import { describe, expect, it } from "vitest";
import { METRIC_VERSION, describeFromAggregates, describeValues, type ReadingLike } from "../src/index";

const ok = (v: number): ReadingLike => ({ raw_value: v, status: "ok" });
const err = (): ReadingLike => ({ raw_value: null, status: "read_error" });

describe("describeValues (fixtures de la guía 05 §3)", () => {
  it("A - tres lecturas válidas: media 200, máximo 300, desvío poblacional 81,649658", () => {
    const m = describeValues([ok(100), ok(200), ok(300)]);
    expect(m).toMatchObject({ metric_version: METRIC_VERSION, unit: "adc_count", n_received: 3, n_valid: 3, n_invalid: 0, sample_mean: 200, sample_max: 300 });
    expect(m.sample_sd_population).toBeCloseTo(81.649658, 6);
    expect(m.unavailable_reason).toBeUndefined();
  });

  it("B - una lectura read_error no participa de la estadística pero sí de las cantidades", () => {
    const m = describeValues([ok(100), ok(200), ok(300), err()]);
    expect(m).toMatchObject({ n_received: 4, n_valid: 3, n_invalid: 1, sample_mean: 200, sample_max: 300 });
    expect(m.sample_sd_population).toBeCloseTo(81.649658, 6);
  });

  it("C - el cero es una lectura válida: media 100, máximo 200", () => {
    const m = describeValues([ok(0), ok(100), ok(200)]);
    expect(m).toMatchObject({ n_received: 3, n_valid: 3, n_invalid: 0, sample_mean: 100, sample_max: 200 });
    expect(m.sample_sd_population).toBeCloseTo(81.649658, 6);
  });

  it("D - sin lecturas válidas el resultado es 'no disponible', nunca cero", () => {
    const m = describeValues([err(), err()]);
    expect(m).toMatchObject({ n_received: 2, n_valid: 0, n_invalid: 2, sample_mean: null, sample_max: null, sample_sd_population: null, unavailable_reason: "sin lecturas válidas" });
    expect(describeValues([])).toMatchObject({ n_received: 0, n_valid: 0, n_invalid: 0, sample_mean: null, unavailable_reason: "sin lecturas" });
  });

  it("una sola lectura: desvío 0, media y máximo iguales al valor", () => {
    expect(describeValues([ok(512)])).toMatchObject({ n_valid: 1, sample_mean: 512, sample_max: 512, sample_sd_population: 0 });
  });

  it("describeFromAggregates coincide con describeValues sobre los mismos datos", () => {
    const values = [0, 17, 4095, 2048, 2048, 333, 1];
    const readings = [...values.map(ok), err(), err()];
    const direct = describeValues(readings);
    const agg = describeFromAggregates({
      n_received: readings.length, n_valid: values.length,
      sum: values.reduce((a, b) => a + b, 0), sum_sq: values.reduce((a, b) => a + b * b, 0), max: Math.max(...values),
    });
    expect(agg.n_received).toBe(direct.n_received);
    expect(agg.n_valid).toBe(direct.n_valid);
    expect(agg.sample_mean).toBeCloseTo(direct.sample_mean!, 9);
    expect(agg.sample_max).toBe(direct.sample_max);
    expect(agg.sample_sd_population).toBeCloseTo(direct.sample_sd_population!, 6);
    expect(describeFromAggregates({ n_received: 3, n_valid: 0, sum: null, sum_sq: null, max: null })).toMatchObject({ sample_mean: null, unavailable_reason: "sin lecturas válidas" });
  });
});
