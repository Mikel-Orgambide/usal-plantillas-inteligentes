/**
 * Configuración de canales del contrato v1.0.
 *
 * Seis posiciones lógicas: un FSR406 en cada talón y dos FSR402 en el antepié
 * (medial y lateral) de cada pie. Una configuración concreta declara un
 * subconjunto de esas posiciones (de 1 a 6, en el orden del contrato): el
 * módulo unilateral del 3/11/2026 instrumenta sólo el pie izquierdo. Las
 * posiciones no declaradas quedan «no disponibles»; nunca se rellenan con
 * ceros ni con valores copiados. El código de posición identifica el lugar
 * lógico; la unidad física instalada se identifica por separado mediante
 * `installation_id` dentro de cada configuración.
 */

export const CHANNEL_CODES = [
  "L_HEEL",
  "L_MEDIAL",
  "L_LATERAL",
  "R_HEEL",
  "R_MEDIAL",
  "R_LATERAL",
] as const;

export type ChannelCode = (typeof CHANNEL_CODES)[number];

export type Foot = "left" | "right";

export type Zone = "heel" | "forefoot_medial" | "forefoot_lateral";

/**
 * Modelo anunciado por el vendedor; no acredita fabricante ni rango de fuerza.
 * `synthetic`: canal sin sensor, con valores generados por la placa (pruebas de transporte).
 */
export type SensorModel = "FSR406" | "FSR402" | "synthetic";

/** Unidad de los valores crudos en la primera versión del contrato. */
export const RAW_UNIT = "adc_count" as const;
export type RawUnit = typeof RAW_UNIT;

export interface ChannelPosition {
  readonly code: ChannelCode;
  readonly foot: Foot;
  readonly zone: Zone;
  readonly expected_model: SensorModel;
}

/** Significado fijo de cada código de posición. No depende de la configuración. */
export const CHANNEL_POSITIONS: Readonly<Record<ChannelCode, ChannelPosition>> = {
  L_HEEL: { code: "L_HEEL", foot: "left", zone: "heel", expected_model: "FSR406" },
  L_MEDIAL: { code: "L_MEDIAL", foot: "left", zone: "forefoot_medial", expected_model: "FSR402" },
  L_LATERAL: { code: "L_LATERAL", foot: "left", zone: "forefoot_lateral", expected_model: "FSR402" },
  R_HEEL: { code: "R_HEEL", foot: "right", zone: "heel", expected_model: "FSR406" },
  R_MEDIAL: { code: "R_MEDIAL", foot: "right", zone: "forefoot_medial", expected_model: "FSR402" },
  R_LATERAL: { code: "R_LATERAL", foot: "right", zone: "forefoot_lateral", expected_model: "FSR402" },
};

export function isChannelCode(value: unknown): value is ChannelCode {
  return typeof value === "string" && (CHANNEL_CODES as readonly string[]).includes(value);
}

/** Un canal concreto dentro de una configuración: posición + unidad física instalada. */
export interface ChannelDefinition {
  readonly code: ChannelCode;
  /** Identificador de la unidad física instalada (p. ej. "FSR406-A"). */
  readonly installation_id: string;
  readonly model: SensorModel;
  readonly unit: RawUnit;
}

/** Rango eléctrico/digital documentado para los valores crudos de la configuración. */
export interface RawValueRange {
  readonly min: number;
  readonly max: number;
  /** Resolución declarada del conversor; informativa, no se deduce del nombre de la placa. */
  readonly resolution_bits: number;
}

/**
 * Configuración de adquisición. Es inmutable una vez asociada con registros:
 * cualquier cambio de sensor, ubicación, circuito, montaje o adquisición
 * genera una nueva configuración con otro `configuration_id`.
 */
export interface AcquisitionConfiguration {
  readonly configuration_id: string;
  readonly device_id: string;
  readonly source: DataSourceKind;
  readonly raw_range: RawValueRange;
  readonly channels: readonly ChannelDefinition[];
  /** Descripción breve del montaje o del generador. */
  readonly description?: string;
}

export type DataSourceKind = "simulated" | "physical";

/**
 * Configuración de referencia del simulador. Los valores de rango son los de
 * un ADC de 12 bits a modo ilustrativo; no expresan parámetros medidos del ESP32.
 */
export const SIMULATED_CONFIGURATION: AcquisitionConfiguration = {
  configuration_id: "SIM-CONFIG-001",
  device_id: "SIM-001",
  source: "simulated",
  raw_range: { min: 0, max: 4095, resolution_bits: 12 },
  description: "Simulador determinista, seis canales, rango ilustrativo de 12 bits",
  channels: CHANNEL_CODES.map((code) => ({
    code,
    installation_id: `SIM-${code}`,
    model: CHANNEL_POSITIONS[code].expected_model,
    unit: RAW_UNIT,
  })),
};

/**
 * Configuración de referencia del módulo unilateral izquierdo (3/11/2026): un
 * ESP32 con tres divisores FSR en el pie izquierdo. Sirve de fixture y de
 * ejemplo de subconjunto; la configuración real la anuncia el dispositivo.
 */
export const LEFT_MODULE_CONFIGURATION: AcquisitionConfiguration = {
  configuration_id: "ESP32-FSR-L-001",
  device_id: "ESP32-000000",
  source: "physical",
  raw_range: { min: 0, max: 4095, resolution_bits: 12 },
  description: "Módulo unilateral izquierdo: 3 divisores FSR (2,2 kΩ talón, 4,7 kΩ antepié), ADC 12 bits",
  channels: (["L_HEEL", "L_MEDIAL", "L_LATERAL"] as const).map((code) => ({
    code,
    installation_id: `ESP32-FSR-L-001-${code}`,
    model: CHANNEL_POSITIONS[code].expected_model,
    unit: RAW_UNIT,
  })),
};

/** Módulo derecho (ADR 0011): mismo circuito que el izquierdo en un segundo ESP32. */
export const RIGHT_MODULE_CONFIGURATION: AcquisitionConfiguration = {
  configuration_id: "ESP32-FSR-R-001",
  device_id: "ESP32-000001",
  source: "physical",
  raw_range: { min: 0, max: 4095, resolution_bits: 12 },
  description: "Módulo unilateral derecho: 3 divisores FSR (2,2 kΩ talón, 4,7 kΩ antepié), ADC 12 bits",
  channels: (["R_HEEL", "R_MEDIAL", "R_LATERAL"] as const).map((code) => ({
    code,
    installation_id: `ESP32-FSR-R-001-${code}`,
    model: CHANNEL_POSITIONS[code].expected_model,
    unit: RAW_UNIT,
  })),
};

/**
 * Configuración simulada de un solo pie: imita un módulo (tres posiciones) con
 * procedencia `simulated`, para probar la sesión con dos fuentes sin hardware.
 */
export function simulatedModuleConfiguration(foot: Foot): AcquisitionConfiguration {
  const id = foot === "left" ? "SIM-L-001" : "SIM-R-001";
  const codes = CHANNEL_CODES.filter((c) => CHANNEL_POSITIONS[c].foot === foot);
  return {
    configuration_id: id,
    device_id: foot === "left" ? "SIM-L" : "SIM-R",
    source: "simulated",
    raw_range: { min: 0, max: 4095, resolution_bits: 12 },
    description: `Simulador de módulo ${foot === "left" ? "izquierdo" : "derecho"} (tres posiciones), rango ilustrativo de 12 bits`,
    channels: codes.map((code) => ({ code, installation_id: `${id}-${code}`, model: CHANNEL_POSITIONS[code].expected_model, unit: RAW_UNIT })),
  };
}

/** Códigos de posición declarados por una configuración, en el orden del contrato. */
export function configuredChannels(config: Pick<AcquisitionConfiguration, "channels">): ChannelCode[] {
  const declared = new Set(config.channels.map((ch) => ch.code));
  return CHANNEL_CODES.filter((code) => declared.has(code));
}

/** Pies con al menos una posición instrumentada en la configuración. */
export interface FootAvailability {
  readonly left: boolean;
  readonly right: boolean;
  /** Ambos pies instrumentados: condición de las métricas bilaterales. */
  readonly bilateral: boolean;
}

export function footAvailability(config: Pick<AcquisitionConfiguration, "channels">): FootAvailability {
  const codes = configuredChannels(config);
  const left = codes.some((c) => CHANNEL_POSITIONS[c].foot === "left");
  const right = codes.some((c) => CHANNEL_POSITIONS[c].foot === "right");
  return { left, right, bilateral: left && right };
}

/**
 * Comprueba que una configuración declare entre 1 y 6 posiciones conocidas, sin
 * repetir y en el orden del contrato. No exige las seis: una configuración
 * unilateral es válida y las posiciones ausentes quedan «no disponibles».
 */
export function validateConfiguration(config: AcquisitionConfiguration): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  let lastIndex = -1;
  if (config.channels.length === 0) errors.push("la configuración no declara ningún canal");
  for (const channel of config.channels) {
    if (!isChannelCode(channel.code)) {
      errors.push(`código de canal desconocido: ${String(channel.code)}`);
      continue;
    }
    if (seen.has(channel.code)) errors.push(`código de canal duplicado: ${channel.code}`);
    seen.add(channel.code);
    const index = CHANNEL_CODES.indexOf(channel.code);
    if (index < lastIndex) errors.push(`canal ${channel.code} fuera del orden del contrato`);
    lastIndex = Math.max(lastIndex, index);
    if (!channel.installation_id) errors.push(`canal ${channel.code} sin installation_id`);
    if (channel.unit !== RAW_UNIT) errors.push(`canal ${channel.code} con unidad no admitida: ${channel.unit}`);
  }
  const { min, max, resolution_bits } = config.raw_range;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) {
    errors.push("raw_range inválido: min y max deben ser enteros con min < max");
  }
  if (!Number.isInteger(resolution_bits) || resolution_bits <= 0) {
    errors.push("raw_range.resolution_bits debe ser un entero positivo");
  }
  if (!config.configuration_id) errors.push("configuration_id vacío");
  if (!config.device_id) errors.push("device_id vacío");
  return errors;
}
