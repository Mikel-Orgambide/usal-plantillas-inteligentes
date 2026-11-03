import { CHANNEL_CODES, type ChannelCode } from "@plantillas/contract";
import type { ResultRow, SessionRepository } from "@plantillas/storage";
import { METRIC_VERSION, describeFromAggregates, notInstrumented, type ChannelMetrics } from "./describe";

/**
 * Calcula (o recupera, si ya existen con esta versión) las métricas por canal
 * de una captura y las guarda en `result`. Una ventana = una captura: las
 * capturas de una sesión no se combinan (los reinicios interrumpen el tiempo).
 *
 * Las seis posiciones del contrato están siempre presentes en el resultado;
 * las que la configuración no instrumenta llevan `unavailable_reason =
 * NOT_INSTRUMENTED` y no se guardan como filas (no midieron nada).
 */
export type CaptureMetrics = Readonly<Record<ChannelCode, ChannelMetrics>>;

export async function computeCaptureMetrics(
  repo: SessionRepository,
  captureId: number,
  nowIso = () => new Date().toISOString(),
  channels: readonly ChannelCode[] = CHANNEL_CODES,
): Promise<CaptureMetrics> {
  const existing = await repo.getResults(captureId, METRIC_VERSION);
  if (existing.length === channels.length && channels.every((c) => existing.some((r) => r.channel_code === c))) return fromRows(existing, channels);

  const aggregates = await repo.getChannelAggregates(captureId);
  const computed: Record<ChannelCode, ChannelMetrics> = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of CHANNEL_CODES) {
    if (!channels.includes(code)) { computed[code] = notInstrumented(); continue; }
    const a = aggregates.find((x) => x.channel_code === code) ?? { channel_code: code, n_received: 0, n_valid: 0, sum: null, sum_sq: null, max: null };
    computed[code] = describeFromAggregates(a);
  }
  await repo.saveResults(captureId, channels.map((code) => ({
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

function fromRows(rows: ResultRow[], channels: readonly ChannelCode[]): CaptureMetrics {
  const out = {} as Record<ChannelCode, ChannelMetrics>;
  for (const code of CHANNEL_CODES) {
    if (!channels.includes(code)) { out[code] = notInstrumented(); continue; }
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
