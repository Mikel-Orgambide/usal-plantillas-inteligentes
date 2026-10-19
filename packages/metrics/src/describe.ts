import type { RawUnit, SampleStatus } from "@plantillas/contract";

/**
 * Estadísticas descriptivas de las lecturas disponibles de un canal.
 *
 * Son descriptores de la señal original (cuentas ADC), no fuerza ni presión.
 * La media es muestral: con intervalos irregulares no equivale a un promedio
 * ponderado por tiempo. Cero lecturas válidas → resultado no disponible, no cero.
 */

/** Versión del algoritmo; cambia si cambia el significado de cualquier campo. */
export const METRIC_VERSION = "desc-1.0";

export interface ChannelMetrics {
  readonly metric_version: typeof METRIC_VERSION;
  readonly unit: RawUnit;
  readonly n_received: number;
  readonly n_valid: number;
  readonly n_invalid: number;
  readonly sample_mean: number | null;
  readonly sample_max: number | null;
  readonly sample_sd_population: number | null;
  /** Motivo cuando los tres descriptores son `null`. */
  readonly unavailable_reason?: string;
}

export interface ReadingLike {
  readonly raw_value: number | null;
  readonly status: SampleStatus;
}

export function describeValues(readings: readonly ReadingLike[], unit: RawUnit = "adc_count"): ChannelMetrics {
  let n_valid = 0;
  let sum = 0;
  let max = Number.NEGATIVE_INFINITY;
  const valid: number[] = [];
  for (const r of readings) {
    if (r.status === "ok" && typeof r.raw_value === "number" && Number.isFinite(r.raw_value)) {
      n_valid += 1;
      sum += r.raw_value;
      if (r.raw_value > max) max = r.raw_value;
      valid.push(r.raw_value);
    }
  }
  const n_received = readings.length;
  const n_invalid = n_received - n_valid;
  if (n_valid === 0) {
    return {
      metric_version: METRIC_VERSION, unit, n_received, n_valid, n_invalid,
      sample_mean: null, sample_max: null, sample_sd_population: null,
      unavailable_reason: n_received === 0 ? "sin lecturas" : "sin lecturas válidas",
    };
  }
  const mean = sum / n_valid;
  let sq = 0;
  for (const v of valid) sq += (v - mean) * (v - mean);
  return {
    metric_version: METRIC_VERSION, unit, n_received, n_valid, n_invalid,
    sample_mean: mean, sample_max: max, sample_sd_population: Math.sqrt(sq / n_valid),
  };
}

/**
 * Misma estadística a partir de agregados (conteos, suma, suma de cuadrados,
 * máximo), para calcularla en SQL sin traer todas las muestras. La varianza
 * poblacional es E[x²] − E[x]²; se recorta a 0 por error de redondeo.
 */
export function describeFromAggregates(a: {
  readonly n_received: number; readonly n_valid: number; readonly sum: number | null; readonly sum_sq: number | null; readonly max: number | null;
}, unit: RawUnit = "adc_count"): ChannelMetrics {
  const n_invalid = a.n_received - a.n_valid;
  if (a.n_valid === 0 || a.sum === null || a.sum_sq === null || a.max === null) {
    return {
      metric_version: METRIC_VERSION, unit, n_received: a.n_received, n_valid: a.n_valid, n_invalid,
      sample_mean: null, sample_max: null, sample_sd_population: null,
      unavailable_reason: a.n_received === 0 ? "sin lecturas" : "sin lecturas válidas",
    };
  }
  const mean = a.sum / a.n_valid;
  const variance = Math.max(0, a.sum_sq / a.n_valid - mean * mean);
  return {
    metric_version: METRIC_VERSION, unit, n_received: a.n_received, n_valid: a.n_valid, n_invalid,
    sample_mean: mean, sample_max: a.max, sample_sd_population: Math.sqrt(variance),
  };
}
