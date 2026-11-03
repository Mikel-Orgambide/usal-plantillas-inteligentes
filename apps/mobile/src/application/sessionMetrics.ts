import { configuredChannels } from "@plantillas/contract";
import { computeCaptureMetrics, type CaptureMetrics } from "@plantillas/metrics";
import type { CaptureRow } from "@plantillas/storage";
import { getDatabase } from "../infrastructure/sqlite/database";

export interface CaptureWithMetrics {
  readonly capture: CaptureRow;
  readonly metrics: CaptureMetrics;
}

/**
 * Métricas descriptivas por posición de cada captura de una sesión. Se
 * calculan una vez (al cerrar la sesión o al abrir por primera vez el detalle
 * de una sesión anterior) y quedan guardadas con su versión de algoritmo.
 * Las capturas no se combinan: un reinicio interrumpe la ventana. Se calculan
 * sólo las posiciones que instrumenta la configuración de la captura; las
 * demás quedan «no instrumentadas» (nunca cero).
 */
export async function ensureSessionMetrics(sessionId: string): Promise<CaptureWithMetrics[]> {
  const { repository } = await getDatabase();
  const captures = await repository.getCaptures(sessionId);
  const out: CaptureWithMetrics[] = [];
  for (const capture of captures) {
    const configuration = await repository.getConfiguration(capture.configuration_id);
    const channels = configuration ? configuredChannels(configuration) : undefined;
    out.push({ capture, metrics: await computeCaptureMetrics(repository, capture.id, undefined, channels) });
  }
  return out;
}
