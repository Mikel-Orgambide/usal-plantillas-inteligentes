import type { NormalizedRecord, RecordContext, SourceRecord } from "./types";

/**
 * Incorpora un registro validado a una sesión, añadiendo procedencia y recepción.
 * La procedencia la decide el adaptador que recibió el registro; `received_at`
 * no reemplaza el tiempo de adquisición de cada muestra.
 */
export function normalizeRecord(record: SourceRecord, context: RecordContext): NormalizedRecord {
  if (!context.session_id) throw new Error("session_id vacío");
  if (Number.isNaN(Date.parse(context.received_at))) {
    throw new Error(`received_at no es una fecha ISO 8601 válida: ${context.received_at}`);
  }
  return {
    ...record,
    samples: record.samples.map((s) => ({ ...s })),
    source: context.source,
    session_id: context.session_id,
    received_at: context.received_at,
  };
}
