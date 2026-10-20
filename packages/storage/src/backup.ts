import { CHANNEL_POSITIONS, type AcquisitionConfiguration, type ChannelCode, type DataSourceKind, type NormalizedRecord, type SensorModel } from "@plantillas/contract";
import type { SqlDriver } from "./driver";
import { SessionRepository, type CaptureRow, type EventRow, type ResultRow, type SessionRow } from "./repository";

/**
 * Respaldo por sesión (etapa 10): un paquete JSON autocontenido con todo lo
 * que la base guarda de una sesión —configuración y canales, sesión, capturas,
 * registros con sus muestras, eventos y resultados— que se puede restaurar en
 * otra base conservando identificadores. La restauración es idempotente: los
 * registros duplicados no se vuelven a insertar (C08) y una sesión que ya
 * existe no se toca.
 */

export const BUNDLE_FORMAT = "plantillas-session-bundle-1";

export interface SessionBundle {
  readonly format: typeof BUNDLE_FORMAT;
  readonly exported_at: string;
  readonly schema_version: number;
  readonly configuration: AcquisitionConfiguration;
  readonly session: SessionRow;
  readonly captures: readonly Omit<CaptureRow, "id" | "session_id">[];
  readonly records: readonly {
    readonly capture_id: string;
    readonly sequence: number;
    readonly format_version: string;
    readonly received_at: string;
    readonly samples: readonly { channel_id: ChannelCode; time_us: number; raw_value: number | null; unit: "adc_count"; status: "ok" | "read_error" }[];
  }[];
  readonly events: readonly Omit<EventRow, "id" | "session_id" | "capture_id">[] & readonly { capture_id?: string | null }[];
  readonly results: readonly (Omit<ResultRow, "id" | "capture_id"> & { capture_id: string })[];
}

export interface RestoreReport {
  readonly session: "inserted" | "exists";
  readonly captures: number;
  readonly records_inserted: number;
  readonly records_duplicate: number;
  readonly records_rejected: number;
  readonly events: number;
  readonly results: number;
}

export async function exportSessionBundle(db: SqlDriver, sessionId: string, now = () => new Date().toISOString()): Promise<SessionBundle | null> {
  const repo = new SessionRepository(db);
  const session = await repo.getSession(sessionId);
  if (!session) return null;
  const captures = await repo.getCaptures(sessionId);
  const first = captures[0];
  const configuration = first ? await readConfiguration(db, first.configuration_id) : null;
  if (!configuration) throw new Error(`la sesión ${sessionId} no tiene capturas ni configuración que exportar`);
  const byId = new Map(captures.map((c) => [c.id, c.external_capture_id]));
  const records: SessionBundle["records"][number][] = [];
  for (const c of captures) {
    const rows = await repo.getRecords(c.id);
    const samples = await repo.getSamples(c.id);
    const byRecord = new Map<number, typeof samples>();
    for (const s of samples) { const list = byRecord.get(s.record_id) ?? []; list.push(s); byRecord.set(s.record_id, list); }
    for (const r of rows) {
      records.push({
        capture_id: c.external_capture_id, sequence: r.sequence, format_version: r.format_version, received_at: r.received_at,
        samples: (byRecord.get(r.id) ?? []).map((s) => ({ channel_id: s.channel_code, time_us: s.time_us, raw_value: s.raw_value, unit: s.unit as "adc_count", status: s.status })),
      });
    }
  }
  const events = (await repo.getEvents(sessionId)).map(({ id: _id, session_id: _s, capture_id, ...rest }) => ({ ...rest, capture_id: capture_id === null ? null : byId.get(capture_id) ?? null }));
  const results: SessionBundle["results"][number][] = [];
  for (const c of captures) {
    for (const { id: _id, capture_id: _c, ...rest } of await repo.getResults(c.id)) results.push({ ...rest, capture_id: c.external_capture_id });
  }
  const version = await db.get<{ user_version: number }>("PRAGMA user_version");
  return {
    format: BUNDLE_FORMAT, exported_at: now(), schema_version: version?.user_version ?? 0,
    configuration, session,
    captures: captures.map(({ id: _id, session_id: _s, ...rest }) => rest),
    records, events, results,
  };
}

async function readConfiguration(db: SqlDriver, id: string): Promise<AcquisitionConfiguration | null> {
  const c = await db.get<{ id: string; device_id: string; source: DataSourceKind; raw_min: number; raw_max: number; resolution_bits: number; description: string | null }>(
    "SELECT id, device_id, source, raw_min, raw_max, resolution_bits, description FROM configuration WHERE id = ?", [id]);
  if (!c) return null;
  const channels = await db.all<{ installation_id: string; code: ChannelCode; model: SensorModel; unit: string }>(
    "SELECT installation_id, code, model, unit FROM channel WHERE configuration_id = ? ORDER BY code", [id]);
  return {
    configuration_id: c.id, device_id: c.device_id, source: c.source,
    raw_range: { min: c.raw_min, max: c.raw_max, resolution_bits: c.resolution_bits },
    channels: channels.map((ch) => ({ code: ch.code, installation_id: ch.installation_id, model: ch.model, unit: ch.unit as "adc_count" })),
    ...(c.description ? { description: c.description } : {}),
  };
}

export function validateBundle(value: unknown): SessionBundle {
  const b = value as Partial<SessionBundle>;
  if (!b || b.format !== BUNDLE_FORMAT) throw new Error("el archivo no es un respaldo de sesión reconocido");
  if (!b.session?.id || !b.configuration?.configuration_id || !Array.isArray(b.captures) || !Array.isArray(b.records)) throw new Error("respaldo incompleto: faltan sesión, configuración, capturas o registros");
  for (const ch of b.configuration.channels) if (!(ch.code in CHANNEL_POSITIONS)) throw new Error(`canal desconocido en el respaldo: ${String(ch.code)}`);
  return b as SessionBundle;
}

/** Restaura un paquete en la base dada. Si la sesión ya existe, no modifica nada y lo informa. */
export async function restoreSessionBundle(db: SqlDriver, bundle: SessionBundle, userId = "local"): Promise<RestoreReport> {
  const b = validateBundle(bundle);
  const repo = new SessionRepository(db);
  await repo.ensureLocalUser(userId);
  await repo.ensureConfiguration(b.configuration);
  if (await repo.getSession(b.session.id)) {
    return { session: "exists", captures: 0, records_inserted: 0, records_duplicate: 0, records_rejected: 0, events: 0, results: 0 };
  }
  const s = b.session;
  await db.run(
    "INSERT INTO session (id, user_id, activity, context, source, state, started_at, ended_at, duration_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [s.id, userId, s.activity, s.context, s.source, s.state, s.started_at, s.ended_at, s.duration_ms, s.created_at, s.updated_at],
  );
  const captureIds = new Map<string, number>();
  for (const c of b.captures) {
    const row = await repo.openCapture(s.id, b.configuration, c.external_capture_id, c.started_at);
    captureIds.set(c.external_capture_id, row.id);
  }
  let inserted = 0, duplicate = 0, rejected = 0;
  for (const [external, rowId] of captureIds) {
    const records: NormalizedRecord[] = b.records.filter((r) => r.capture_id === external).map((r) => ({
      format_version: r.format_version, device_id: b.configuration.device_id, capture_id: r.capture_id, configuration_id: b.configuration.configuration_id,
      sequence: r.sequence, samples: r.samples, source: s.source, session_id: s.id, received_at: r.received_at,
    }));
    for (let i = 0; i < records.length; i += 200) {
      for (const o of await repo.insertRecords(rowId, records.slice(i, i + 200))) {
        if (o.outcome === "inserted") inserted += 1; else if (o.outcome === "duplicate") duplicate += 1; else rejected += 1;
      }
    }
  }
  for (const e of b.events) {
    const captureRow = e.capture_id ? captureIds.get(e.capture_id) ?? null : null;
    await db.run("INSERT INTO event (session_id, capture_id, type, at_us, received_at, detail) VALUES (?, ?, ?, ?, ?, ?)", [s.id, captureRow, e.type, e.at_us, e.received_at, e.detail]);
  }
  let results = 0;
  for (const [external, rowId] of captureIds) {
    const rows = b.results.filter((r) => r.capture_id === external).map(({ capture_id: _c, ...rest }) => rest);
    if (rows.length > 0) { await repo.saveResults(rowId, rows); results += rows.length; }
  }
  return { session: "inserted", captures: captureIds.size, records_inserted: inserted, records_duplicate: duplicate, records_rejected: rejected, events: b.events.length, results };
}

/** Cantidades por entidad de una base, para comparar original y copia restaurada (P05). */
export async function countEntities(db: SqlDriver, sessionId?: string): Promise<Record<string, number>> {
  const where = sessionId ? "WHERE session_id = ?" : "";
  const params = sessionId ? [sessionId] : [];
  const n = async (sql: string) => (await db.get<{ n: number }>(sql, params))?.n ?? 0;
  return {
    sessions: await n(`SELECT COUNT(*) AS n FROM session ${sessionId ? "WHERE id = ?" : ""}`),
    captures: await n(`SELECT COUNT(*) AS n FROM capture ${where}`),
    records: await n(`SELECT COUNT(*) AS n FROM record r JOIN capture c ON c.id = r.capture_id ${where.replace("session_id", "c.session_id")}`),
    samples: await n(`SELECT COUNT(*) AS n FROM sample s JOIN record r ON r.id = s.record_id JOIN capture c ON c.id = r.capture_id ${where.replace("session_id", "c.session_id")}`),
    events: await n(`SELECT COUNT(*) AS n FROM event ${where}`),
    results: await n(`SELECT COUNT(*) AS n FROM result x JOIN capture c ON c.id = x.capture_id ${where.replace("session_id", "c.session_id")}`),
  };
}
