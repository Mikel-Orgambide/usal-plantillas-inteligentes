import { CHANNEL_CODES, type ChannelCode } from "@plantillas/contract";
import type { ResultRow, SessionRepository } from "@plantillas/storage";
import { METRIC_VERSION, describeFromAggregates, type ChannelMetrics } from "./describe";

/**
 * Calcula (o recupera, si ya existen con esta versión) las métricas por canal
 * de una captura y las guarda en `result`. Una ventana = una captura: las
 * capturas de una sesión no se combinan (los reinicios interrumpen el tiempo).
 */
export type CaptureMetrics = Readonly<Record<ChannelCode, ChannelMetrics>>;

export async function computeCaptureMetrics(repo: SessionRepository, captureId: number, nowIso = () => new Date().toISOString()): Promise<CaptureMetrics> {
  const existing = await repo.getResults(captureId, METRIC_VERSION);
  if (existing.length === CHANNEL_CODES.length) return fromRows(existing);

  const aggregates = await repo.getChannelAggregates(captureId);
  const computed: Record<ChannelCode, ChannelMetrics> = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of CHANNEL_CODES) {
    const a = aggregates.find((x) => x.channel_code === code) ?? { channel_code: code, n_received: 0, n_valid: 0, sum: null, sum_sq: null, max: null };
    computed[code] = describeFromAggregates(a);
  }
  await repo.saveResults(captureId, CHANNEL_CODES.map((code) => ({
    channel_code: code,
    metric_version: METRIC_VERSION,
    unit: computed[code].unit,
    n_received: computed[code].n_received,
    n_valid: computed[code].n_valid,
    n_invalid: computed[code].n_invalid,
    sample_mean: computed[code].sample_mean,
    sample_max: computed[code].sample_max,
    sample_sd_population: computed[code].sample_sd_population,
    computed_at: nowIso(),
  })));
  return computed;
}

function fromRows(rows: ResultRow[]): CaptureMetrics {
  const out = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of CHANNEL_CODES) {
    const r = rows.find((x) => x.channel_code === code)!;
    out[code] = {
      metric_version: METRIC_VERSION,
      unit: r.unit as ChannelMetrics["unit"],
      n_received: r.n_received, n_valid: r.n_valid, n_invalid: r.n_invalid,
      sample_mean: r.sample_mean, sample_max: r.sample_max, sample_sd_population: r.sample_sd_population,
      ...(r.n_valid === 0 ? { unavailable_reason: r.n_received === 0 ? "sin lecturas" : "sin lecturas válidas" } : {}),
    };
  }
  return out;
}
