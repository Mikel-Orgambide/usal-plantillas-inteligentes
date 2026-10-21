import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SyncRejectedError,
  type EntityCounts,
  type RemoteCapturePayload,
  type RemoteEventPayload,
  type RemoteGateway,
  type RemoteRecordPayload,
  type RemoteResultPayload,
  type RemoteSessionPayload,
} from "@plantillas/sync";

/**
 * Pasarela al esquema remoto (supabase/migrations/0001_remote_schema.sql):
 * una llamada RPC por paso. Las funciones corren con los permisos de la
 * cuenta autenticada, así que las políticas de titularidad se aplican en el
 * servidor; la app no decide nada sobre acceso.
 */

/** Códigos de PostgreSQL que indican rechazo y no una falla transitoria. */
const REJECTED_CODES = new Set(["42501", "22023", "23502", "23503", "23514", "22P02", "PGRST202"]);

interface RpcError { readonly code?: string | null; readonly message: string; readonly details?: string | null }

function toError(e: RpcError, step: string): Error {
  const text = `${step}: ${e.message}${e.details ? ` (${e.details})` : ""}`;
  // Nunca se incluyen tokens ni claves en los mensajes: sólo lo que devuelve PostgREST.
  return e.code && REJECTED_CODES.has(e.code) ? new SyncRejectedError(text) : new Error(text);
}

export class SupabaseGateway implements RemoteGateway {
  constructor(private readonly client: SupabaseClient) {}

  async beginSession(session: RemoteSessionPayload, captures: readonly RemoteCapturePayload[]): Promise<{ captures: Record<string, string> }> {
    const { data, error } = await this.client.rpc("sync_session_begin", { p_session: session, p_captures: captures });
    if (error) throw toError(error, "cabecera de la sesión");
    const out = (data as { captures?: Record<string, string | number> } | null)?.captures;
    if (!out) throw new SyncRejectedError("cabecera de la sesión: el servidor no devolvió las capturas");
    return { captures: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, String(v)])) };
  }

  async pushRecords(remoteCaptureId: string, records: readonly RemoteRecordPayload[]): Promise<{ inserted: number }> {
    const { data, error } = await this.client.rpc("sync_records", { p_capture_id: Number(remoteCaptureId), p_records: records });
    if (error) throw toError(error, "registros");
    return { inserted: Number(data ?? 0) };
  }

  async finishSession(sessionId: string, events: readonly RemoteEventPayload[], results: readonly RemoteResultPayload[]): Promise<EntityCounts> {
    const { data, error } = await this.client.rpc("sync_session_finish", { p_session_id: sessionId, p_events: events, p_results: results });
    if (error) throw toError(error, "cierre de la sesión");
    const c = data as Partial<Record<keyof EntityCounts, number | string>> | null;
    if (!c) throw new SyncRejectedError("cierre de la sesión: el servidor no devolvió cantidades");
    return { captures: Number(c.captures ?? 0), records: Number(c.records ?? 0), events: Number(c.events ?? 0), results: Number(c.results ?? 0) };
  }
}
