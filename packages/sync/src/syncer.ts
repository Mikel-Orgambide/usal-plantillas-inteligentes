import type { AcquisitionConfiguration } from "@plantillas/contract";
import { SessionRepository, type CaptureRow, type SqlDriver, type SyncStateRow } from "@plantillas/storage";
import {
  SyncRejectedError,
  type EntityCounts,
  type RemoteCapturePayload,
  type RemoteEventPayload,
  type RemoteGateway,
  type RemoteRecordPayload,
  type RemoteResultPayload,
  type RemoteSessionPayload,
} from "./gateway";

/**
 * Sincronización de una sesión cerrada con el servicio remoto.
 *
 * - Sólo se transfieren sesiones cerradas (completas o incompletas) con al
 *   menos una captura, cuyo usuario local esté vinculado a la cuenta activa.
 * - Cada paso usa los mismos identificadores que la base local, de modo que
 *   repetir la transferencia no duplica nada (el servidor ignora lo que ya
 *   tiene).
 * - Las llamadas se reintentan ante fallas de red; un rechazo explícito
 *   (titularidad, datos inválidos) no se reintenta.
 * - La sesión queda `confirmed` sólo si las cantidades que informa el
 *   servidor coinciden con las locales. Si no coinciden, queda `pending` con
 *   el detalle: una confirmación incierta no se muestra como éxito.
 */

export interface SyncOptions {
  readonly db: SqlDriver;
  readonly gateway: RemoteGateway;
  /** Cuenta remota activa (auth.uid). */
  readonly ownerRemoteId: string;
  /** Registros por lote. */
  readonly chunkSize?: number;
  /** Intentos por llamada remota ante fallas transitorias. */
  readonly attempts?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onProgress?: (p: SyncProgress) => void;
}

export interface SyncProgress {
  readonly sessionId: string;
  readonly step: "begin" | "records" | "finish";
  readonly recordsSent: number;
  readonly recordsTotal: number;
}

export type SyncOutcome =
  | { readonly status: "confirmed"; readonly counts: EntityCounts; readonly state: SyncStateRow }
  | { readonly status: "pending"; readonly error: string; readonly state: SyncStateRow }
  | { readonly status: "failed"; readonly error: string; readonly state: SyncStateRow }
  | { readonly status: "skipped"; readonly reason: string };

const DEFAULTS = { chunkSize: 250, attempts: 3 } as const;
const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function syncSession(opts: SyncOptions, sessionId: string): Promise<SyncOutcome> {
  const repo = new SessionRepository(opts.db);
  const session = await repo.getSession(sessionId);
  if (!session) return { status: "skipped", reason: "la sesión no existe" };
  if (session.state !== "completed" && session.state !== "incomplete") return { status: "skipped", reason: "la sesión todavía no está cerrada" };
  const user = await repo.getUser(session.user_id);
  if (!user?.remote_id) return { status: "skipped", reason: "la sesión no pertenece a ninguna cuenta" };
  if (user.remote_id !== opts.ownerRemoteId) return { status: "skipped", reason: "la sesión pertenece a otra cuenta" };
  const captures = await repo.getCaptures(sessionId);
  if (captures.length === 0) return { status: "skipped", reason: "la sesión no tiene capturas" };
  // Una configuración por módulo (dispositivo), en el orden en que aparecen las capturas (ADR 0011).
  const configurations: AcquisitionConfiguration[] = [];
  for (const id of [...new Set(captures.map((c) => c.configuration_id))]) {
    const cfg = await repo.getConfiguration(id);
    if (!cfg) return { status: "skipped", reason: `falta la configuración ${id} de la captura` };
    configurations.push(cfg);
  }
  const configuration = configurations[0]!;

  const chunkSize = opts.chunkSize ?? DEFAULTS.chunkSize;
  const call = <T>(fn: () => Promise<T>) => withRetry(fn, opts.attempts ?? DEFAULTS.attempts, opts.sleep ?? defaultSleep);
  const local = await localCounts(repo, sessionId, captures);
  const progress = (step: SyncProgress["step"], recordsSent: number) => opts.onProgress?.({ sessionId, step, recordsSent, recordsTotal: local.records });

  try {
    progress("begin", 0);
    const version = await opts.db.get<{ user_version: number }>("PRAGMA user_version");
    const header: RemoteSessionPayload = {
      id: session.id, activity: session.activity, context: session.context, source: session.source, state: session.state,
      started_at: session.started_at, ended_at: session.ended_at, duration_ms: session.duration_ms, created_at: session.created_at, updated_at: session.updated_at,
      device_id: configuration.device_id, configuration_id: configuration.configuration_id, configuration, configurations, schema_version: version?.user_version ?? 0,
    };
    const capturePayloads: RemoteCapturePayload[] = captures.map((c) => ({ external_capture_id: c.external_capture_id, source: c.source, started_at: c.started_at }));
    const begun = await call(() => opts.gateway.beginSession(header, capturePayloads));

    let sent = 0;
    for (const c of captures) {
      const remoteId = begun.captures[c.external_capture_id];
      if (remoteId === undefined) throw new SyncRejectedError(`el servidor no devolvió la captura ${c.external_capture_id}`);
      const records = await repo.getRecords(c.id);
      const samples = await repo.getSamples(c.id);
      const byRecord = new Map<number, RemoteRecordPayload["samples"][number][]>();
      for (const s of samples) {
        const list = byRecord.get(s.record_id) ?? [];
        list.push({ channel_id: s.channel_code, time_us: s.time_us, raw_value: s.raw_value, unit: s.unit as "adc_count", status: s.status });
        byRecord.set(s.record_id, list);
      }
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk: RemoteRecordPayload[] = records.slice(i, i + chunkSize).map((r) => ({
          sequence: r.sequence, format_version: r.format_version, received_at: r.received_at, samples: byRecord.get(r.id) ?? [],
        }));
        await call(() => opts.gateway.pushRecords(remoteId, chunk));
        sent += chunk.length;
        progress("records", sent);
      }
    }

    const byRow = new Map(captures.map((c) => [c.id, c.external_capture_id]));
    const events: RemoteEventPayload[] = (await repo.getEvents(sessionId)).map((e) => ({
      local_id: e.id, capture_external_id: e.capture_id === null ? null : byRow.get(e.capture_id) ?? null, type: e.type, at_us: e.at_us, received_at: e.received_at, detail: e.detail,
    }));
    const results: RemoteResultPayload[] = [];
    for (const c of captures) {
      for (const r of await repo.getResults(c.id)) {
        results.push({
          capture_external_id: c.external_capture_id, channel_code: r.channel_code, metric_version: r.metric_version, unit: r.unit,
          n_received: r.n_received, n_valid: r.n_valid, n_invalid: r.n_invalid, sample_mean: r.sample_mean, sample_max: r.sample_max,
          sample_sd_population: r.sample_sd_population, calibration_id: r.calibration_id, computed_at: r.computed_at,
        });
      }
    }
    progress("finish", sent);
    const remote = await call(() => opts.gateway.finishSession(sessionId, events, results));

    const mismatch = compareCounts(local, remote);
    if (mismatch) {
      const state = await repo.recordSyncAttempt(sessionId, opts.ownerRemoteId, { status: "pending", error: mismatch });
      return { status: "pending", error: mismatch, state };
    }
    const state = await repo.recordSyncAttempt(sessionId, opts.ownerRemoteId, { status: "confirmed", remoteCounts: { ...remote } });
    return { status: "confirmed", counts: remote, state };
  } catch (e) {
    const error = describeError(e);
    const state = await repo.recordSyncAttempt(sessionId, opts.ownerRemoteId, { status: "failed", error });
    return { status: "failed", error, state };
  }
}

export interface SyncRunReport {
  readonly confirmed: number;
  readonly pending: number;
  readonly failed: number;
  readonly outcomes: Readonly<Record<string, SyncOutcome>>;
}

/** Sincroniza, una por una, las sesiones pendientes de la cuenta activa. */
export async function syncPendingSessions(opts: SyncOptions): Promise<SyncRunReport> {
  const repo = new SessionRepository(opts.db);
  const pending = await repo.listSessionsPendingSync(opts.ownerRemoteId);
  const outcomes: Record<string, SyncOutcome> = {};
  let confirmed = 0, pend = 0, failed = 0;
  for (const s of pending) {
    const o = await syncSession(opts, s.id);
    outcomes[s.id] = o;
    if (o.status === "confirmed") confirmed += 1;
    else if (o.status === "pending") pend += 1;
    else if (o.status === "failed") failed += 1;
  }
  return { confirmed, pending: pend, failed, outcomes };
}

export async function localCounts(repo: SessionRepository, sessionId: string, captures?: readonly CaptureRow[]): Promise<EntityCounts> {
  const caps = captures ?? (await repo.getCaptures(sessionId));
  const configurations = new Set(caps.map((c) => c.configuration_id)).size;
  let records = 0, results = 0;
  for (const c of caps) {
    records += await repo.countRecords(c.id);
    results += (await repo.getResults(c.id)).length;
  }
  return { configurations, captures: caps.length, records, events: (await repo.getEvents(sessionId)).length, results };
}

/** Texto del desajuste entre lo local y lo que informa el servidor, o `null` si coinciden. */
export function compareCounts(local: EntityCounts, remote: EntityCounts): string | null {
  const diffs: string[] = [];
  for (const k of ["configurations", "captures", "records", "events", "results"] as const) {
    if (remote[k] !== local[k]) diffs.push(`${LABEL[k]} ${remote[k] ?? 0} de ${local[k]}`);
  }
  return diffs.length === 0 ? null : `el servidor informa ${diffs.join(", ")}`;
}

const LABEL: Record<keyof EntityCounts, string> = { configurations: "configuraciones", captures: "capturas", records: "registros", events: "eventos", results: "resultados" };

async function withRetry<T>(fn: () => Promise<T>, attempts: number, sleep: (ms: number) => Promise<void>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof SyncRejectedError) throw e;
      last = e;
      if (i < attempts - 1) await sleep(500 * 2 ** i);
    }
  }
  throw last;
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
