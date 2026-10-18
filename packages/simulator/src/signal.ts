import { CHANNEL_POSITIONS, type ChannelCode, type RawValueRange } from "@plantillas/contract";
import type { Rng } from "./random";

/**
 * Patrón sintético de carga por canal.
 *
 * Modela, de forma puramente ilustrativa, una alternancia de apoyo entre pies
 * con mayor carga en el talón al inicio del apoyo y en el antepié al final.
 * No reproduce una marcha real ni valores medidos: sirve para que las
 * pantallas, la persistencia y las métricas tengan señales variadas y
 * reproducibles. Los parámetros son adimensionales y se escalan al rango ADC.
 */
export interface SignalParams {
  /** Duración de un ciclo completo (ambos pies) en microsegundos. */
  readonly cycle_us: number;
  /** Nivel de reposo como fracción del rango (0–1). */
  readonly baseline: number;
  /** Amplitud máxima de carga como fracción del rango (0–1). */
  readonly amplitude: number;
  /** Desviación típica del ruido como fracción del rango. */
  readonly noise: number;
}

export const DEFAULT_SIGNAL: SignalParams = {
  cycle_us: 1_200_000,
  baseline: 0.05,
  amplitude: 0.7,
  noise: 0.01,
};

/** Perfil de carga (0–1) de una zona a lo largo de la fase de apoyo (0–1). */
function zoneProfile(zone: ChannelCode, phase: number): number {
  const z = CHANNEL_POSITIONS[zone].zone;
  // Campana centrada en distinto momento del apoyo según la zona.
  const center = z === "heel" ? 0.25 : z === "forefoot_lateral" ? 0.55 : 0.7;
  const width = z === "heel" ? 0.18 : 0.2;
  const d = (phase - center) / width;
  return Math.exp(-0.5 * d * d);
}

export function sampleValue(
  code: ChannelCode,
  time_us: number,
  params: SignalParams,
  range: RawValueRange,
  rng: Rng,
): number {
  const foot = CHANNEL_POSITIONS[code].foot;
  const cyclePos = (time_us % params.cycle_us) / params.cycle_us; // 0–1
  // Pie izquierdo apoya en la primera mitad del ciclo, derecho en la segunda.
  const inStance = foot === "left" ? cyclePos < 0.5 : cyclePos >= 0.5;
  const phase = foot === "left" ? cyclePos * 2 : (cyclePos - 0.5) * 2;
  const load = inStance ? zoneProfile(code, phase) : 0;
  const fraction = params.baseline + params.amplitude * load + params.noise * rng.gaussian();
  const span = range.max - range.min;
  const value = Math.round(range.min + fraction * span);
  return Math.min(range.max, Math.max(range.min, value));
}
