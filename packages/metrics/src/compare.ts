import { CHANNEL_CODES, type ChannelCode } from "@plantillas/contract";
import { isInstrumented, type ChannelMetrics } from "./describe";
import type { CaptureMetrics } from "./compute";

/**
 * Comparación numérica de dos ventanas (una captura de cada sesión).
 *
 * Política (guía 03 §10): se comparan canales iguales bajo configuración,
 * unidad, procedencia y versión de métrica iguales. Las diferencias de
 * actividad, contexto y calidad de recepción se señalan, no bloquean. No se
 * emite ninguna etiqueta de «mejor» o «peor»: solo diferencias B − A.
 */

export interface ComparisonSide {
  readonly configuration_id: string;
  readonly source: "simulated" | "physical";
  readonly unit: string;
  readonly metric_version: string;
  readonly activity: string;
  readonly context: string | null;
  readonly capture_count: number;
}

export interface Requirement {
  readonly code: "configuration" | "unit" | "source" | "metric_version";
  readonly ok: boolean;
  readonly a: string;
  readonly b: string;
}

export interface Caveat {
  readonly code: "activity" | "context" | "multiple_captures";
  readonly a: string;
  readonly b: string;
}

export interface Comparability {
  readonly compatible: boolean;
  readonly requirements: readonly Requirement[];
  readonly caveats: readonly Caveat[];
}

export function assessComparability(a: ComparisonSide, b: ComparisonSide): Comparability {
  const requirements: Requirement[] = [
    { code: "configuration", ok: a.configuration_id === b.configuration_id, a: a.configuration_id, b: b.configuration_id },
    { code: "unit", ok: a.unit === b.unit, a: a.unit, b: b.unit },
    { code: "source", ok: a.source === b.source, a: a.source, b: b.source },
    { code: "metric_version", ok: a.metric_version === b.metric_version, a: a.metric_version, b: b.metric_version },
  ];
  const caveats: Caveat[] = [];
  if (a.activity !== b.activity) caveats.push({ code: "activity", a: a.activity, b: b.activity });
  if ((a.context ?? "") !== (b.context ?? "")) caveats.push({ code: "context", a: a.context ?? "", b: b.context ?? "" });
  if (a.capture_count > 1 || b.capture_count > 1) caveats.push({ code: "multiple_captures", a: String(a.capture_count), b: String(b.capture_count) });
  return { compatible: requirements.every((r) => r.ok), requirements, caveats };
}

export interface ChannelDifference {
  readonly channel: ChannelCode;
  readonly a: ChannelMetrics;
  readonly b: ChannelMetrics;
  /** `null` cuando alguno de los dos lados no tiene lecturas válidas. */
  readonly delta_mean: number | null;
  readonly delta_max: number | null;
  readonly delta_sd: number | null;
  /** Diferencia de media relativa a A, en fracción (0,1 = +10 %); `null` si A no está o su media es 0. */
  readonly delta_mean_ratio: number | null;
}

/**
 * Diferencias por canal B − A, sólo sobre las posiciones instrumentadas en
 * ambos lados (con la misma configuración son las mismas). Solo tiene sentido
 * si `assessComparability` dio compatible.
 */
export function compareMetrics(a: CaptureMetrics, b: CaptureMetrics): ChannelDifference[] {
  return CHANNEL_CODES.filter((channel) => isInstrumented(a[channel]) && isInstrumented(b[channel])).map((channel) => {
    const ma = a[channel], mb = b[channel];
    const both = ma.sample_mean !== null && mb.sample_mean !== null;
    const delta_mean = both ? mb.sample_mean! - ma.sample_mean! : null;
    return {
      channel, a: ma, b: mb,
      delta_mean,
      delta_max: both ? mb.sample_max! - ma.sample_max! : null,
      delta_sd: both ? mb.sample_sd_population! - ma.sample_sd_population! : null,
      delta_mean_ratio: delta_mean !== null && ma.sample_mean !== 0 ? delta_mean / ma.sample_mean! : null,
    };
  });
}
