import { CHANNEL_CODES, CHANNEL_POSITIONS, type ChannelCode } from "@plantillas/contract";
import { isInstrumented, notInstrumented, type ChannelMetrics } from "./describe";

/**
 * Distribución de la carga a partir de las métricas descriptivas por canal
 * (`desc-1.0`): reparto izquierda/derecha, antepié/retropié, asimetría por
 * zona y variabilidad. Son proporciones entre medias de la señal original en
 * cuentas ADC, sin calibración: describen cómo se reparte la lectura entre
 * posiciones, no fuerza ni presión, y no constituyen un puntaje ni un
 * diagnóstico. Se calculan sobre las posiciones instrumentadas por la
 * configuración: todas ellas deben tener lecturas válidas; si alguna falta,
 * el resultado es «no disponible» (nunca un porcentaje parcial). Las
 * proporciones bilaterales (izquierda/derecha, asimetría por zona) requieren
 * ambos pies y quedan en `null` con un módulo unilateral.
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
  /** Suma de las medias instrumentadas, en cuentas: base de las proporciones. */
  readonly total_mean: number | null;
  /** Posiciones sobre las que se calculó (las instrumentadas por la configuración). */
  readonly instrumented: readonly ChannelCode[];
  /** `true` si ambos pies están instrumentados; si no, las proporciones bilaterales son `null`. */
  readonly bilateral: boolean;
  readonly unavailable_reason?: string;
}

const ZONE_OF: Record<ChannelCode, Zone> = {
  L_HEEL: "heel", R_HEEL: "heel", L_MEDIAL: "medial", R_MEDIAL: "medial", L_LATERAL: "lateral", R_LATERAL: "lateral",
};

function unavailable(reason: string, instrumented: readonly ChannelCode[], bilateral: boolean): LoadDistribution {
  return {
    distribution_version: DISTRIBUTION_VERSION, left_share: null, right_share: null, forefoot_share: null, rearfoot_share: null,
    asymmetry: { heel: null, medial: null, lateral: null }, variability: null, total_mean: null, instrumented, bilateral, unavailable_reason: reason,
  };
}

type DistributionInput = Readonly<Record<ChannelCode, Pick<ChannelMetrics, "sample_mean" | "sample_sd_population" | "n_valid" | "unavailable_reason">>>;

/** Posiciones instrumentadas según las métricas: las que no llevan `NOT_INSTRUMENTED`. */
export function instrumentedChannels(metrics: Readonly<Partial<Record<ChannelCode, Pick<ChannelMetrics, "unavailable_reason">>>>): ChannelCode[] {
  return CHANNEL_CODES.filter((c) => isInstrumented(metrics[c]));
}

export function computeDistribution(metrics: DistributionInput): LoadDistribution {
  const instrumented = instrumentedChannels(metrics);
  const feet = new Set(instrumented.map((c) => CHANNEL_POSITIONS[c].foot));
  const bilateral = feet.has("left") && feet.has("right");
  if (instrumented.length === 0) return unavailable("ninguna posición instrumentada", instrumented, bilateral);
  const means: Partial<Record<ChannelCode, number>> = {};
  for (const code of instrumented) {
    const m = metrics[code];
    if (!m || m.sample_mean === null || !Number.isFinite(m.sample_mean) || m.n_valid === 0) return unavailable(`sin lecturas válidas en ${code}`, instrumented, bilateral);
    means[code] = m.sample_mean;
  }
  const mean = (code: ChannelCode) => means[code]!;
  const total = instrumented.reduce((s, c) => s + mean(c), 0);
  if (total <= 0) return unavailable("suma de medias nula", instrumented, bilateral);

  const left = instrumented.filter((c) => CHANNEL_POSITIONS[c].foot === "left").reduce((s, c) => s + mean(c), 0);
  const fore = instrumented.filter((c) => ZONE_OF[c] !== "heel").reduce((s, c) => s + mean(c), 0);
  const hasHeel = instrumented.some((c) => ZONE_OF[c] === "heel");
  const hasFore = instrumented.some((c) => ZONE_OF[c] !== "heel");
  const asym = (zone: Zone): number | null => {
    const l = instrumented.find((c) => ZONE_OF[c] === zone && CHANNEL_POSITIONS[c].foot === "left");
    const r = instrumented.find((c) => ZONE_OF[c] === zone && CHANNEL_POSITIONS[c].foot === "right");
    if (!l || !r) return null;
    const sum = mean(l) + mean(r);
    return sum > 0 ? (mean(l) - mean(r)) / sum : null;
  };
  let cvSum = 0, cvN = 0;
  for (const code of instrumented) {
    const sd = metrics[code].sample_sd_population;
    if (sd !== null && mean(code) > 0) { cvSum += sd / mean(code); cvN += 1; }
  }
  return {
    distribution_version: DISTRIBUTION_VERSION,
    left_share: bilateral ? left / total : null, right_share: bilateral ? 1 - left / total : null,
    forefoot_share: hasHeel && hasFore ? fore / total : null, rearfoot_share: hasHeel && hasFore ? 1 - fore / total : null,
    asymmetry: { heel: asym("heel"), medial: asym("medial"), lateral: asym("lateral") },
    variability: cvN === instrumented.length ? cvSum / cvN : null,
    total_mean: total,
    instrumented, bilateral,
  };
}

/**
 * Combina ventanas (capturas o sesiones) en una sola métrica por canal,
 * ponderando cada media por su cantidad de lecturas válidas: equivale a la
 * media de todas las lecturas juntas. La desviación combinada usa la ley de
 * varianza total (dentro + entre ventanas). Ventanas sin lecturas válidas en
 * un canal no aportan a ese canal. Un canal que ninguna ventana instrumenta
 * queda «no instrumentado»; si lo instrumenta al menos una, se combina lo que hay.
 */
export function combineChannelMetrics(windows: readonly Readonly<Record<ChannelCode, ChannelMetrics>>[]): Readonly<Record<ChannelCode, ChannelMetrics>> {
  const out = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of CHANNEL_CODES) {
    let n_received = 0, n_valid = 0, sum = 0, max = Number.NEGATIVE_INFINITY;
    const parts: { n: number; mean: number; sd: number }[] = [];
    let unit: ChannelMetrics["unit"] = "adc_count";
    let instrumented = false;
    for (const w of windows) {
      const m = w[code];
      if (!m || !isInstrumented(m)) continue;
      instrumented = true;
      unit = m.unit;
      n_received += m.n_received;
      if (m.sample_mean === null || m.n_valid === 0) continue;
      n_valid += m.n_valid;
      sum += m.sample_mean * m.n_valid;
      if (m.sample_max !== null && m.sample_max > max) max = m.sample_max;
      parts.push({ n: m.n_valid, mean: m.sample_mean, sd: m.sample_sd_population ?? 0 });
    }
    if (!instrumented) { out[code] = notInstrumented(unit); continue; }
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
 * Carga acumulada aproximada de una ventana: suma de las medias de las
 * posiciones instrumentadas multiplicada por el tiempo con lecturas válidas (período × n).
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
