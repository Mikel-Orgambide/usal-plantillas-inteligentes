/**
 * Configuración de canales del contrato v1.0.
 *
 * Seis posiciones instrumentadas: un FSR406 en cada talón y dos FSR402 en el
 * antepié (medial y lateral) de cada pie. El código de posición identifica el
 * lugar lógico; la unidad física instalada se identifica por separado mediante
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

/** Comprueba que una configuración declare las seis posiciones exactamente una vez. */
export function validateConfiguration(config: AcquisitionConfiguration): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const channel of config.channels) {
    if (!isChannelCode(channel.code)) errors.push(`código de canal desconocido: ${String(channel.code)}`);
    if (seen.has(channel.code)) errors.push(`código de canal duplicado: ${channel.code}`);
    seen.add(channel.code);
    if (!channel.installation_id) errors.push(`canal ${channel.code} sin installation_id`);
    if (channel.unit !== RAW_UNIT) errors.push(`canal ${channel.code} con unidad no admitida: ${channel.unit}`);
  }
  for (const code of CHANNEL_CODES) {
    if (!seen.has(code)) errors.push(`falta el canal ${code}`);
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
