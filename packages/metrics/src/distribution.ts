import { CHANNEL_CODES, CHANNEL_POSITIONS, type ChannelCode } from "@plantillas/contract";
import type { ChannelMetrics } from "./describe";

/**
 * Distribución de la carga a partir de las métricas descriptivas por canal
 * (`desc-1.0`): reparto izquierda/derecha, antepié/retropié, asimetría por
 * zona y variabilidad. Son proporciones entre medias de la señal original en
 * cuentas ADC, sin calibración: describen cómo se reparte la lectura entre
 * posiciones, no fuerza ni presión, y no constituyen un puntaje ni un
 * diagnóstico. Requieren las seis posiciones con lecturas válidas; si falta
 * alguna, el resultado es «no disponible» (nunca un porcentaje parcial).
 */

export const DISTRIBUTION_VERSION = "dist-1.0";

export type Zone = "heel" | "medial" | "lateral";

export interface LoadDistribution {
  readonly distribution_version: typeof DISTRIBUTION_VERSION;
  /** Fracción de la suma de medias que corresponde al pie izquierdo (0–1). */
  readonly left_share: number | null;
  readonly right_share: number | null;
  /** Fracción de la suma de medias en antepié (medial + lateral de ambos pies). */
  readonly forefoot_share: number | null;
  readonly rearfoot_share: number | null;
  /** (izq − der) / (izq + der) por zona, −1…1; 0 = simétrico, positivo = más carga a la izquierda. */
  readonly asymmetry: Readonly<Record<Zone, number | null>>;
  /** Coeficiente de variación promedio (σ/media) de las seis posiciones; mayor = lecturas más cambiantes. */
  readonly variability: number | null;
  /** Suma de las seis medias, en cuentas: base de las proporciones. */
  readonly total_mean: number | null;
  readonly unavailable_reason?: string;
}

const ZONE_OF: Record<ChannelCode, Zone> = {
  L_HEEL: "heel", R_HEEL: "heel", L_MEDIAL: "medial", R_MEDIAL: "medial", L_LATERAL: "lateral", R_LATERAL: "lateral",
};

function unavailable(reason: string): LoadDistribution {
  return {
    distribution_version: DISTRIBUTION_VERSION, left_share: null, right_share: null, forefoot_share: null, rearfoot_share: null,
    asymmetry: { heel: null, medial: null, lateral: null }, variability: null, total_mean: null, unavailable_reason: reason,
  };
}

export function computeDistribution(metrics: Readonly<Record<ChannelCode, Pick<ChannelMetrics, "sample_mean" | "sample_sd_population" | "n_valid">>>): LoadDistribution {
  const means: Partial<Record<ChannelCode, number>> = {};
  for (const code of CHANNEL_CODES) {
    const m = metrics[code];
    if (!m || m.sample_mean === null || !Number.isFinite(m.sample_mean) || m.n_valid === 0) return unavailable(`sin lecturas válidas en ${code}`);
    means[code] = m.sample_mean;
  }
  const mean = (code: ChannelCode) => means[code]!;
  const total = CHANNEL_CODES.reduce((s, c) => s + mean(c), 0);
  if (total <= 0) return unavailable("suma de medias nula");

  const left = CHANNEL_CODES.filter((c) => CHANNEL_POSITIONS[c].foot === "left").reduce((s, c) => s + mean(c), 0);
  const fore = CHANNEL_CODES.filter((c) => ZONE_OF[c] !== "heel").reduce((s, c) => s + mean(c), 0);
  const asym = (zone: Zone): number | null => {
    const l = CHANNEL_CODES.find((c) => ZONE_OF[c] === zone && CHANNEL_POSITIONS[c].foot === "left")!;
    const r = CHANNEL_CODES.find((c) => ZONE_OF[c] === zone && CHANNEL_POSITIONS[c].foot === "right")!;
    const sum = mean(l) + mean(r);
    return sum > 0 ? (mean(l) - mean(r)) / sum : null;
  };
  let cvSum = 0, cvN = 0;
  for (const code of CHANNEL_CODES) {
    const sd = metrics[code].sample_sd_population;
    if (sd !== null && mean(code) > 0) { cvSum += sd / mean(code); cvN += 1; }
  }
  return {
    distribution_version: DISTRIBUTION_VERSION,
    left_share: left / total, right_share: 1 - left / total,
    forefoot_share: fore / total, rearfoot_share: 1 - fore / total,
    asymmetry: { heel: asym("heel"), medial: asym("medial"), lateral: asym("lateral") },
    variability: cvN === CHANNEL_CODES.length ? cvSum / cvN : null,
    total_mean: total,
  };
}

/**
 * Combina ventanas (capturas o sesiones) en una sola métrica por canal,
 * ponderando cada media por su cantidad de lecturas válidas: equivale a la
 * media de todas las lecturas juntas. La desviación combinada usa la ley de
 * varianza total (dentro + entre ventanas). Ventanas sin lecturas válidas en
 * un canal no aportan a ese canal.
 */
export function combineChannelMetrics(windows: readonly Readonly<Record<ChannelCode, ChannelMetrics>>[]): Readonly<Record<ChannelCode, ChannelMetrics>> {
  const out = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of CHANNEL_CODES) {
    let n_received = 0, n_valid = 0, sum = 0, max = Number.NEGATIVE_INFINITY;
    const parts: { n: number; mean: number; sd: number }[] = [];
    let unit: ChannelMetrics["unit"] = "adc_count";
    for (const w of windows) {
      const m = w[code];
      if (!m) continue;
      unit = m.unit;
      n_received += m.n_received;
      if (m.sample_mean === null || m.n_valid === 0) continue;
      n_valid += m.n_valid;
      sum += m.sample_mean * m.n_valid;
      if (m.sample_max !== null && m.sample_max > max) max = m.sample_max;
      parts.push({ n: m.n_valid, mean: m.sample_mean, sd: m.sample_sd_population ?? 0 });
    }
    if (n_valid === 0) {
      out[code] = { metric_version: "desc-1.0", unit, n_received, n_valid: 0, n_invalid: n_received, sample_mean: null, sample_max: null, sample_sd_population: null, unavailable_reason: n_received === 0 ? "sin lecturas" : "sin lecturas válidas" };
      continue;
    }
    const mean = sum / n_valid;
    let variance = 0;
    for (const p of parts) variance += (p.n / n_valid) * (p.sd * p.sd + (p.mean - mean) * (p.mean - mean));
    out[code] = { metric_version: "desc-1.0", unit, n_received, n_valid, n_invalid: n_received - n_valid, sample_mean: mean, sample_max: max, sample_sd_population: Math.sqrt(Math.max(0, variance)) };
  }
  return out;
}

/**
 * Carga acumulada aproximada de una ventana: suma de las medias de las seis
 * posiciones multiplicada por el tiempo con lecturas válidas (período × n).
 * Unidad: cuentas·segundo. Es una aproximación en unidades crudas (sin
 * calibración no se convierte a N·s) y sólo sirve para comparar ventanas con
 * la misma configuración.
 */
export function approximateLoad(metrics: Readonly<Record<ChannelCode, Pick<ChannelMetrics, "sample_mean" | "n_valid">>>, periodSeconds: number): number | null {
  let total = 0;
  let any = false;
  for (const code of CHANNEL_CODES) {
    const m = metrics[code];
    if (!m || m.sample_mean === null) continue;
    total += m.sample_mean * m.n_valid * periodSeconds;
    any = true;
  }
  return any ? total : null;
}
