import { CHANNEL_CODES, CHANNEL_POSITIONS, type ChannelCode, type Foot } from "@plantillas/contract";
import { describeValues, notInstrumented, type ChannelMetrics } from "./describe";
import { computeDistribution, type LoadDistribution } from "./distribution";

/**
 * Métricas bilaterales de una sesión con dos módulos (ADR 0011).
 *
 * Cada módulo tiene su propio reloj y su propia captura; la única referencia
 * común es el instante de recepción en el teléfono (`received_at`). Con él:
 * - se estima el origen del reloj de cada módulo (mediana de `received_at − time_us`)
 *   y el **desfase** entre ambos orígenes, que se declara (no se corrige);
 * - se determinan los **intervalos completos**: tramos en los que ambos módulos
 *   entregaron registros con huecos de recepción menores a `maxGapMs`;
 * - las medias por posición y las proporciones izquierda/derecha se calculan
 *   sólo con los registros que caen dentro de esos intervalos.
 * Sin ambos módulos, o sin tramo completo, el resultado es «no disponible».
 */

export const BILATERAL_VERSION = "bilateral-1.0";

export interface BilateralRecord {
  readonly device_id: string;
  readonly received_at: string;
  readonly samples: readonly { readonly channel_id: ChannelCode; readonly time_us: number; readonly raw_value: number | null; readonly status: "ok" | "read_error" }[];
}

export interface Interval { readonly from_ms: number; readonly to_ms: number }

export interface BilateralMetrics {
  readonly bilateral_version: typeof BILATERAL_VERSION;
  /** Dispositivos por pie, tal como se identificaron en la sesión. */
  readonly modules: Readonly<Record<Foot, string | null>>;
  /** Desfase estimado entre los orígenes de reloj de ambos módulos, en ms (derecho − izquierdo). `null` sin ambos. */
  readonly offset_ms: number | null;
  /** Intervalos (ms desde el primer registro recibido) en que ambos módulos estuvieron presentes. */
  readonly complete_intervals: readonly Interval[];
  /** Fracción del tiempo cubierto por algún módulo que estuvo cubierto por ambos (0–1). */
  readonly complete_fraction: number;
  /** Duración total cubierta por ambos módulos, en ms. */
  readonly complete_ms: number;
  /** Métricas por posición calculadas sólo dentro de los intervalos completos. */
  readonly metrics: Readonly<Record<ChannelCode, ChannelMetrics>> | null;
  /** Distribución sobre los intervalos completos (izquierda/derecha y asimetría disponibles). */
  readonly distribution: LoadDistribution | null;
  readonly unavailable_reason?: string;
}

export interface BilateralOptions {
  /** Hueco máximo entre recepciones consecutivas de un módulo para considerarlo presente (ms). */
  readonly maxGapMs?: number;
}

const ms = (iso: string) => Date.parse(iso);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Tramos de presencia de un módulo: recepciones consecutivas separadas por menos de `maxGapMs`. */
function coverage(times: readonly number[], maxGapMs: number): Interval[] {
  if (times.length === 0) return [];
  const sorted = [...times].sort((a, b) => a - b);
  const out: Interval[] = [];
  let from = sorted[0]!, to = sorted[0]!;
  for (const t of sorted.slice(1)) {
    if (t - to > maxGapMs) { out.push({ from_ms: from, to_ms: to }); from = t; }
    to = t;
  }
  out.push({ from_ms: from, to_ms: to });
  return out;
}

function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) for (const y of b) {
    const from = Math.max(x.from_ms, y.from_ms), to = Math.min(x.to_ms, y.to_ms);
    if (to > from) out.push({ from_ms: from, to_ms: to });
  }
  return out.sort((p, q) => p.from_ms - q.from_ms);
}

function union(a: readonly Interval[]): Interval[] {
  const s = [...a].sort((p, q) => p.from_ms - q.from_ms);
  const out: Interval[] = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.from_ms <= last.to_ms) out[out.length - 1] = { from_ms: last.from_ms, to_ms: Math.max(last.to_ms, i.to_ms) };
    else out.push(i);
  }
  return out;
}

const span = (a: readonly Interval[]) => a.reduce((s, i) => s + (i.to_ms - i.from_ms), 0);
const inside = (t: number, a: readonly Interval[]) => a.some((i) => t >= i.from_ms && t <= i.to_ms);

function unavailable(reason: string, modules: Record<Foot, string | null>): BilateralMetrics {
  return { bilateral_version: BILATERAL_VERSION, modules, offset_ms: null, complete_intervals: [], complete_fraction: 0, complete_ms: 0, metrics: null, distribution: null, unavailable_reason: reason };
}

/**
 * Calcula las métricas bilaterales a partir de los registros de la sesión
 * (los del paquete de respaldo sirven tal cual, agregando el `device_id` de su captura).
 */
export function computeBilateral(records: readonly BilateralRecord[], options: BilateralOptions = {}): BilateralMetrics {
  const maxGapMs = options.maxGapMs ?? 1000;
  const byFoot: Record<Foot, BilateralRecord[]> = { left: [], right: [] };
  const modules: Record<Foot, string | null> = { left: null, right: null };
  for (const r of records) {
    const feet = new Set(r.samples.map((s) => CHANNEL_POSITIONS[s.channel_id].foot));
    if (feet.size !== 1) continue; // un registro de un módulo instrumenta un solo pie
    const foot = [...feet][0]!;
    if (modules[foot] !== null && modules[foot] !== r.device_id) continue; // sólo un módulo por pie
    modules[foot] = r.device_id;
    byFoot[foot].push(r);
  }
  if (!modules.left || !modules.right) return unavailable("requiere ambos pies", modules);

  const t0 = Math.min(...records.map((r) => ms(r.received_at)));
  const times = (foot: Foot) => byFoot[foot].map((r) => ms(r.received_at) - t0);
  const covL = coverage(times("left"), maxGapMs), covR = coverage(times("right"), maxGapMs);
  const complete = intersect(covL, covR);
  const any = union([...covL, ...covR]);
  const completeMs = span(complete);
  const anyMs = span(any);
  const fraction = anyMs > 0 ? completeMs / anyMs : 0;

  // Origen del reloj de cada módulo: recepción − tiempo de adquisición (primera muestra del registro).
  const origin = (foot: Foot) => median(byFoot[foot].map((r) => ms(r.received_at) - (r.samples[0]?.time_us ?? 0) / 1000));
  const offset = Math.round(origin("right") - origin("left"));

  if (completeMs <= 0) {
    return { ...unavailable("sin tramo con ambos módulos presentes", modules), offset_ms: offset, complete_fraction: fraction };
  }
  type Reading = { raw_value: number | null; status: "ok" | "read_error" };
  const readings = {} as Record<ChannelCode, Reading[]>;
  for (const c of CHANNEL_CODES) readings[c] = [];
  const instrumented = new Set<ChannelCode>();
  for (const foot of ["left", "right"] as const) {
    for (const r of byFoot[foot]) {
      if (!inside(ms(r.received_at) - t0, complete)) continue;
      for (const s of r.samples) { instrumented.add(s.channel_id); readings[s.channel_id].push({ raw_value: s.raw_value, status: s.status }); }
    }
  }
  const metrics = {} as Record<ChannelCode, ChannelMetrics>;
  for (const c of CHANNEL_CODES) {
    metrics[c] = instrumented.has(c) ? describeValues(readings[c]) : notInstrumented();
  }
  return {
    bilateral_version: BILATERAL_VERSION, modules, offset_ms: offset,
    complete_intervals: complete, complete_fraction: fraction, complete_ms: completeMs,
    metrics, distribution: computeDistribution(metrics),
  };
}
