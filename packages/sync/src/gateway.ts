import type { AcquisitionConfiguration, ChannelCode, DataSourceKind } from "@plantillas/contract";
import type { SessionState } from "@plantillas/storage";

/**
 * Contrato entre la app y el servicio remoto (docs/especificacion/02 §12,
 * 03 §14). La sincronización transfiere una sesión cerrada con sus mismos
 * identificadores, en tres pasos: cabecera (sesión y capturas), registros
 * por lotes y cierre (eventos y resultados). El cierre devuelve las
 * cantidades que el servidor tiene realmente guardadas; la app sólo marca
 * la sesión como sincronizada cuando coinciden con las locales. Un HTTP 200
 * no es una confirmación.
 */

export interface RemoteSessionPayload {
  readonly id: string;
  readonly activity: string;
  readonly context: string | null;
  readonly source: DataSourceKind;
  readonly state: SessionState;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly duration_ms: number | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly device_id: string;
  readonly configuration_id: string;
  /** Configuración del primer módulo (compatibilidad con el esquema 0001). */
  readonly configuration: AcquisitionConfiguration;
  /** Configuraciones de todos los módulos de la sesión, el primero primero (ADR 0011; migración 0003). */
  readonly configurations: readonly AcquisitionConfiguration[];
  readonly schema_version: number;
}

export interface RemoteCapturePayload {
  readonly external_capture_id: string;
  readonly source: DataSourceKind;
  readonly started_at: string;
}

export interface RemoteSamplePayload {
  readonly channel_id: ChannelCode;
  readonly time_us: number;
  readonly raw_value: number | null;
  readonly unit: "adc_count";
  readonly status: "ok" | "read_error";
}

export interface RemoteRecordPayload {
  readonly sequence: number;
  readonly format_version: string;
  readonly received_at: string;
  readonly samples: readonly RemoteSamplePayload[];
}

export interface RemoteEventPayload {
  /** Identificador local del evento; con la sesión forma la clave de idempotencia. */
  readonly local_id: number;
  readonly capture_external_id: string | null;
  readonly type: string;
  readonly at_us: number | null;
  readonly received_at: string;
  readonly detail: string | null;
}

export interface RemoteResultPayload {
  readonly capture_external_id: string;
  readonly channel_code: ChannelCode;
  readonly metric_version: string;
  readonly unit: string;
  readonly n_received: number;
  readonly n_valid: number;
  readonly n_invalid: number;
  readonly sample_mean: number | null;
  readonly sample_max: number | null;
  readonly sample_sd_population: number | null;
  readonly calibration_id: string | null;
  readonly computed_at: string;
}

/** Cantidades de una sesión, locales o informadas por el servidor. */
export interface EntityCounts {
  /** Configuraciones (módulos) de la sesión; el servidor la informa desde la migración 0003. */
  readonly configurations: number;
  readonly captures: number;
  readonly records: number;
  readonly events: number;
  readonly results: number;
}

export interface RemoteGateway {
  /** Crea o actualiza la sesión y sus capturas. Devuelve el identificador remoto de cada captura por su id externo. */
  beginSession(session: RemoteSessionPayload, captures: readonly RemoteCapturePayload[]): Promise<{ readonly captures: Readonly<Record<string, string>> }>;
  /** Inserta un lote de registros; los ya existentes (misma captura y secuencia) se ignoran. Devuelve cuántos se insertaron. */
  pushRecords(remoteCaptureId: string, records: readonly RemoteRecordPayload[]): Promise<{ readonly inserted: number }>;
  /** Guarda eventos y resultados y devuelve lo que el servidor tiene de la sesión. */
  finishSession(sessionId: string, events: readonly RemoteEventPayload[], results: readonly RemoteResultPayload[]): Promise<EntityCounts>;
}

/** Error que no tiene sentido reintentar (titularidad, datos rechazados, sesión no autenticada). */
export class SyncRejectedError extends Error {
  override readonly name = "SyncRejectedError";
}
