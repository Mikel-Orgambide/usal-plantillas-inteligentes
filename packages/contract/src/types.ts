import type { ChannelCode, DataSourceKind, RawUnit } from "./channels";

/** Versión lógica del contrato. Cambia cuando cambia el significado de los campos. */
export const FORMAT_VERSION = "1.0" as const;
export const SUPPORTED_FORMAT_VERSIONS: readonly string[] = [FORMAT_VERSION];

/**
 * Estado de una lectura individual.
 * - `ok`: lectura realizada; un cero es un valor digital legítimo.
 * - `read_error`: la lectura falló; `raw_value` es `null`, nunca cero.
 */
export type SampleStatus = "ok" | "read_error";

export interface Sample {
  readonly channel_id: ChannelCode;
  /** Tiempo relativo al inicio de la captura, asignado al inicio de la lectura. Entero ≥ 0. */
  readonly time_us: number;
  /** Valor ADC original, o `null` cuando `status` es `read_error`. */
  readonly raw_value: number | null;
  readonly unit: RawUnit;
  readonly status: SampleStatus;
}

/**
 * Registro tal como lo genera la fuente (dispositivo o simulador).
 * No incluye procedencia ni sesión: esas las añade la aplicación.
 */
export interface SourceRecord {
  readonly format_version: string;
  readonly device_id: string;
  /** Identificador de captura único para esa fuente, nuevo en cada inicio o reinicio. */
  readonly capture_id: string;
  readonly configuration_id: string;
  /** Contador por captura; se incrementa al generar el registro aunque no se transmita. */
  readonly sequence: number;
  readonly samples: readonly Sample[];
}

/** Datos que agrega el adaptador y la aplicación al incorporar un registro. */
export interface RecordContext {
  /** Determinada por el adaptador elegido, nunca por una etiqueta externa. */
  readonly source: DataSourceKind;
  readonly session_id: string;
  /** Fecha/hora de recepción del registro completo, ISO 8601 con zona. */
  readonly received_at: string;
}

/** Registro normalizado: contrato de la fuente + contexto de recepción. */
export interface NormalizedRecord extends SourceRecord, RecordContext {}

/** Clave externa que identifica un registro: device_id + capture_id + sequence. */
export interface RecordKey {
  readonly device_id: string;
  readonly capture_id: string;
  readonly sequence: number;
}

export function recordKeyOf(record: RecordKey): string {
  return `${record.device_id}|${record.capture_id}|${record.sequence}`;
}
