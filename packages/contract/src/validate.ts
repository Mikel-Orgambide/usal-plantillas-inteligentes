import {
  configuredChannels,
  isChannelCode,
  type AcquisitionConfiguration,
  type ChannelCode,
} from "./channels";
import { SUPPORTED_FORMAT_VERSIONS, type Sample, type SourceRecord } from "./types";

/**
 * Validación en ejecución de un registro recibido de la fuente.
 *
 * Independiente de los tipos de TypeScript: recibe `unknown` y devuelve un
 * resultado válido o una lista de errores con código, ruta y mensaje. Nunca
 * corrige silenciosamente la entrada ni rellena canales ausentes. Un registro
 * debe traer exactamente los canales de su configuración.
 */

export type ValidationCode =
  | "not_an_object"
  | "unsupported_version"
  | "missing_field"
  | "invalid_type"
  | "empty_identifier"
  | "configuration_mismatch"
  | "device_mismatch"
  | "invalid_integer"
  | "negative_value"
  | "unsafe_integer"
  | "samples_not_array"
  | "unknown_channel"
  | "channel_not_in_configuration"
  | "duplicate_channel"
  | "missing_channel"
  | "invalid_unit"
  | "invalid_status"
  | "status_value_mismatch"
  | "out_of_range";

export interface ValidationIssue {
  readonly code: ValidationCode;
  /** Ruta del campo afectado, p. ej. "samples[2].raw_value". */
  readonly path: string;
  readonly message: string;
}

export type WarningCode = "adc_boundary";

export interface ValidationWarning {
  readonly code: WarningCode;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly record: SourceRecord; readonly warnings: readonly ValidationWarning[] }
  | { readonly ok: false; readonly errors: readonly ValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class Collector {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationWarning[] = [];

  error(code: ValidationCode, path: string, message: string): void {
    this.errors.push({ code, path, message });
  }

  warn(code: WarningCode, path: string, message: string): void {
    this.warnings.push({ code, path, message });
  }
}

function checkNonEmptyString(c: Collector, obj: Record<string, unknown>, field: string): string | undefined {
  if (!(field in obj)) {
    c.error("missing_field", field, `falta el campo ${field}`);
    return undefined;
  }
  const value = obj[field];
  if (typeof value !== "string") {
    c.error("invalid_type", field, `${field} debe ser una cadena`);
    return undefined;
  }
  if (value.length === 0) {
    c.error("empty_identifier", field, `${field} no puede estar vacío`);
    return undefined;
  }
  return value;
}

/** Entero no negativo representable sin pérdida en JavaScript. */
function checkNonNegativeSafeInteger(c: Collector, value: unknown, path: string): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    c.error("invalid_integer", path, `${path} debe ser un número entero finito`);
    return undefined;
  }
  if (!Number.isInteger(value)) {
    c.error("invalid_integer", path, `${path} debe ser un entero`);
    return undefined;
  }
  if (value < 0) {
    c.error("negative_value", path, `${path} no puede ser negativo`);
    return undefined;
  }
  if (!Number.isSafeInteger(value)) {
    c.error("unsafe_integer", path, `${path} excede el entero seguro representable`);
    return undefined;
  }
  return value;
}

function validateSample(
  c: Collector,
  raw: unknown,
  index: number,
  config: AcquisitionConfiguration,
): Sample | undefined {
  const path = `samples[${index}]`;
  if (!isPlainObject(raw)) {
    c.error("invalid_type", path, "la muestra debe ser un objeto");
    return undefined;
  }

  let valid = true;

  const channelId = raw["channel_id"];
  let channel: ChannelCode | undefined;
  if (!isChannelCode(channelId)) {
    c.error("unknown_channel", `${path}.channel_id`, `canal desconocido: ${String(channelId)}`);
    valid = false;
  } else if (!config.channels.some((ch) => ch.code === channelId)) {
    c.error("channel_not_in_configuration", `${path}.channel_id`, `canal ${channelId} no declarado en la configuración`);
    valid = false;
  } else {
    channel = channelId;
  }

  const timeUs = checkNonNegativeSafeInteger(c, raw["time_us"], `${path}.time_us`);
  if (timeUs === undefined) valid = false;

  const unit = raw["unit"];
  const expectedUnit = channel ? config.channels.find((ch) => ch.code === channel)?.unit : undefined;
  if (typeof unit !== "string" || (expectedUnit !== undefined && unit !== expectedUnit)) {
    c.error("invalid_unit", `${path}.unit`, `unidad no admitida: ${String(unit)}`);
    valid = false;
  }

  const rawStatus = raw["status"];
  const status: Sample["status"] | undefined =
    rawStatus === "ok" || rawStatus === "read_error" ? rawStatus : undefined;
  if (status === undefined) {
    c.error("invalid_status", `${path}.status`, `estado desconocido: ${String(rawStatus)}`);
    valid = false;
  }

  const rawValue = raw["raw_value"];
  if (status === "read_error") {
    if (rawValue !== null) {
      c.error(
        "status_value_mismatch",
        `${path}.raw_value`,
        "una lectura read_error debe tener raw_value null",
      );
      valid = false;
    }
  } else if (status === "ok") {
    if (rawValue === null) {
      c.error("status_value_mismatch", `${path}.raw_value`, "una lectura ok no puede tener raw_value null");
      valid = false;
    } else if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || !Number.isInteger(rawValue)) {
      c.error("invalid_integer", `${path}.raw_value`, "raw_value debe ser un entero finito");
      valid = false;
    } else {
      const { min, max } = config.raw_range;
      if (rawValue < min || rawValue > max) {
        c.error("out_of_range", `${path}.raw_value`, `raw_value ${rawValue} fuera del rango [${min}, ${max}]`);
        valid = false;
      } else if (rawValue === min || rawValue === max) {
        c.warn(
          "adc_boundary",
          `${path}.raw_value`,
          `raw_value ${rawValue} en el límite del rango declarado; no demuestra saturación del sensor`,
        );
      }
    }
  }

  if (!valid || channel === undefined || timeUs === undefined || status === undefined) return undefined;
  return {
    channel_id: channel,
    time_us: timeUs,
    raw_value: status === "ok" ? (rawValue as number) : null,
    unit: unit as Sample["unit"],
    status,
  };
}

/**
 * Valida un registro recibido contra el contrato v1.0 y una configuración conocida.
 * Devuelve el registro tipado solo si no hay errores; las advertencias no lo invalidan.
 */
export function validateSourceRecord(input: unknown, config: AcquisitionConfiguration): ValidationResult {
  const c = new Collector();

  if (!isPlainObject(input)) {
    c.error("not_an_object", "", "el registro debe ser un objeto");
    return { ok: false, errors: c.errors };
  }

  const formatVersion = checkNonEmptyString(c, input, "format_version");
  if (formatVersion !== undefined && !SUPPORTED_FORMAT_VERSIONS.includes(formatVersion)) {
    c.error("unsupported_version", "format_version", `versión no admitida: ${formatVersion}`);
  }

  const deviceId = checkNonEmptyString(c, input, "device_id");
  if (deviceId !== undefined && deviceId !== config.device_id) {
    c.error("device_mismatch", "device_id", `device_id ${deviceId} no coincide con la configuración (${config.device_id})`);
  }

  const captureId = checkNonEmptyString(c, input, "capture_id");

  const configurationId = checkNonEmptyString(c, input, "configuration_id");
  if (configurationId !== undefined && configurationId !== config.configuration_id) {
    c.error(
      "configuration_mismatch",
      "configuration_id",
      `configuration_id ${configurationId} no coincide con la configuración activa (${config.configuration_id})`,
    );
  }

  const sequence =
    "sequence" in input
      ? checkNonNegativeSafeInteger(c, input["sequence"], "sequence")
      : (c.error("missing_field", "sequence", "falta el campo sequence"), undefined);

  const samples: Sample[] = [];
  const rawSamples = input["samples"];
  if (!Array.isArray(rawSamples)) {
    c.error("samples_not_array", "samples", "samples debe ser una lista");
  } else {
    const seen = new Set<ChannelCode>();
    rawSamples.forEach((raw, index) => {
      const sample = validateSample(c, raw, index, config);
      if (sample === undefined) return;
      if (seen.has(sample.channel_id)) {
        c.error("duplicate_channel", `samples[${index}].channel_id`, `canal repetido en el registro: ${sample.channel_id}`);
        return;
      }
      seen.add(sample.channel_id);
      samples.push(sample);
    });
    // Exactamente los canales de la configuración: ni más (error arriba) ni menos.
    for (const code of configuredChannels(config)) {
      if (!seen.has(code)) {
        c.error("missing_channel", "samples", `falta la posición ${code} declarada en la configuración`);
      }
    }
  }

  if (c.errors.length > 0) return { ok: false, errors: c.errors };

  return {
    ok: true,
    record: {
      format_version: formatVersion as string,
      device_id: deviceId as string,
      capture_id: captureId as string,
      configuration_id: configurationId as string,
      sequence: sequence as number,
      samples,
    },
    warnings: c.warnings,
  };
}
