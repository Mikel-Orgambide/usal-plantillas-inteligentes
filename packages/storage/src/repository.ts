import {
  CHANNEL_POSITIONS,
  type AcquisitionConfiguration,
  type ChannelCode,
  type DataSourceKind,
  type NormalizedRecord,
  type Sample,
} from "@plantillas/contract";
import { withSavepoint, type SqlDriver, type SqlExecutor } from "./driver";

/**
 * Repositorio de sesiones sobre SQLite. Todas las escrituras son
 * transaccionales: registro y muestras se confirman juntos o no se confirman.
 */

export type SessionState = "prepared" | "recording" | "interrupted" | "finalizing" | "completed" | "incomplete";

export interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly activity: string;
  readonly context: string | null;
  readonly source: DataSourceKind;
  readonly state: SessionState;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly duration_ms: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CaptureRow {
  readonly id: number;
  readonly session_id: string;
  readonly device_id: string;
  readonly configuration_id: string;
  readonly external_capture_id: string;
  readonly source: DataSourceKind;
  readonly started_at: string;
}

export interface RecordRow {
  readonly id: number;
  readonly capture_id: number;
  readonly sequence: number;
  readonly format_version: string;
  readonly received_at: string;
}

export interface SampleRow {
  readonly record_id: number;
  readonly channel_installation_id: string;
  readonly channel_code: ChannelCode;
  readonly time_us: number;
  readonly raw_value: number | null;
  readonly unit: string;
  readonly status: "ok" | "read_error";
}

export interface EventRow {
  readonly id: number;
  readonly session_id: string;
  readonly capture_id: number | null;
  readonly type: string;
  readonly at_us: number | null;
  readonly received_at: string;
  readonly detail: string | null;
}

/** Evento persistible: los de la fuente (`SourceEvent`) o los del coordinador de sesión. */
export type EventLike = { readonly type: string; readonly at_us?: number | null } & Record<string, unknown>;

export interface SessionSummary extends SessionRow {
  readonly capture_count: number;
  readonly record_count: number;
  readonly event_count: number;
  readonly configuration_id: string | null;
}

export type InsertOutcome =
  | { readonly outcome: "inserted"; readonly record_id: number }
  | { readonly outcome: "duplicate"; readonly record_id: number }
  | { readonly outcome: "conflict"; readonly record_id: number }
  | { readonly outcome: "rejected"; readonly reason: string };

export interface NewSession {
  readonly id: string;
  readonly user_id: string;
  readonly activity: string;
  readonly context?: string;
  readonly source: DataSourceKind;
  readonly started_at: string;
}

/** Máximo de entradas de diagnóstico conservadas por sesión. */
export const DIAGNOSTIC_LIMIT = 200;

const now = (): string => new Date().toISOString();

export class SessionRepository {
  constructor(private readonly db: SqlDriver) {}

  // ---- usuario, dispositivo, configuración -------------------------------

  async ensureLocalUser(id = "local"): Promise<string> {
    await this.db.run("INSERT OR IGNORE INTO user (id, created_at) VALUES (?, ?)", [id, now()]);
    return id;
  }

  /**
   * Registra una configuración y sus canales si no existen. Si ya existe,
   * comprueba que sea idéntica: una configuración no se modifica, se versiona.
   */
  async ensureConfiguration(config: AcquisitionConfiguration): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run("INSERT OR IGNORE INTO device (id, created_at) VALUES (?, ?)", [config.device_id, now()]);
      const existing = await tx.get<{ device_id: string; source: string; raw_min: number; raw_max: number; resolution_bits: number }>(
        "SELECT device_id, source, raw_min, raw_max, resolution_bits FROM configuration WHERE id = ?",
        [config.configuration_id],
      );
      if (existing) {
        const same =
          existing.device_id === config.device_id &&
          existing.source === config.source &&
          existing.raw_min === config.raw_range.min &&
          existing.raw_max === config.raw_range.max &&
          existing.resolution_bits === config.raw_range.resolution_bits;
        const channels = await tx.all<{ installation_id: string; code: string }>(
          "SELECT installation_id, code FROM channel WHERE configuration_id = ? ORDER BY code",
          [config.configuration_id],
        );
        const sameChannels =
          channels.length === config.channels.length &&
          config.channels.every((c) => channels.some((r) => r.code === c.code && r.installation_id === c.installation_id));
        if (!same || !sameChannels) {
          throw new Error(`la configuración ${config.configuration_id} ya existe con otro contenido; crear una nueva versión`);
        }
        return;
      }
      await tx.run(
        "INSERT INTO configuration (id, device_id, source, raw_min, raw_max, resolution_bits, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [config.configuration_id, config.device_id, config.source, config.raw_range.min, config.raw_range.max, config.raw_range.resolution_bits, config.description ?? null, now()],
      );
      for (const ch of config.channels) {
        const pos = CHANNEL_POSITIONS[ch.code];
        await tx.run(
          "INSERT INTO channel (installation_id, configuration_id, code, foot, zone, model, unit) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [ch.installation_id, config.configuration_id, ch.code, pos.foot, pos.zone, ch.model, ch.unit],
        );
      }
    });
  }

  // ---- sesiones ----------------------------------------------------------

  async createSession(s: NewSession): Promise<SessionRow> {
    const ts = now();
    await this.db.run(
      "INSERT INTO session (id, user_id, activity, context, source, state, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'prepared', ?, ?, ?)",
      [s.id, s.user_id, s.activity, s.context ?? null, s.source, s.started_at, ts, ts],
    );
    return (await this.getSession(s.id))!;
  }

  async setSessionState(id: string, state: SessionState): Promise<void> {
    const r = await this.db.run("UPDATE session SET state = ?, updated_at = ? WHERE id = ?", [state, now(), id]);
    if (r.changes !== 1) throw new Error(`sesión ${id} inexistente`);
  }

  async closeSession(id: string, ended_at: string, duration_ms: number, state: "completed" | "incomplete" = "completed"): Promise<void> {
    const r = await this.db.run(
      "UPDATE session SET state = ?, ended_at = ?, duration_ms = ?, updated_at = ? WHERE id = ?",
      [state, ended_at, duration_ms, now(), id],
    );
    if (r.changes !== 1) throw new Error(`sesión ${id} inexistente`);
  }

  async getSession(id: string): Promise<SessionRow | undefined> {
    return this.db.get<SessionRow>("SELECT * FROM session WHERE id = ?", [id]);
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.db.all<SessionSummary>(`
      SELECT s.*,
        (SELECT COUNT(*) FROM capture c WHERE c.session_id = s.id) AS capture_count,
        (SELECT COUNT(*) FROM record r JOIN capture c ON c.id = r.capture_id WHERE c.session_id = s.id) AS record_count,
        (SELECT COUNT(*) FROM event e WHERE e.session_id = s.id) AS event_count,
        (SELECT c.configuration_id FROM capture c WHERE c.session_id = s.id ORDER BY c.id LIMIT 1) AS configuration_id
      FROM session s
      ORDER BY s.started_at DESC`);
  }

  /** Sesiones que quedaron abiertas (p. ej. tras cerrar la aplicación). */
  async listOpenSessions(): Promise<SessionRow[]> {
    return this.db.all<SessionRow>("SELECT * FROM session WHERE state IN ('prepared','recording','interrupted','finalizing') ORDER BY started_at");
  }

  // ---- capturas ----------------------------------------------------------

  /**
   * Abre una captura dentro de una sesión. Un capture_id externo ya usado por
   * el mismo dispositivo en otra sesión es un conflicto: no se reutiliza.
   */
  async openCapture(sessionId: string, config: AcquisitionConfiguration, externalCaptureId: string, startedAt: string): Promise<CaptureRow> {
    return this.db.transaction(async (tx) => {
      const session = await tx.get<SessionRow>("SELECT * FROM session WHERE id = ?", [sessionId]);
      if (!session) throw new Error(`sesión ${sessionId} inexistente`);
      if (session.source !== config.source) {
        throw new Error(`la sesión es ${session.source} y la configuración es ${config.source}; no se mezclan procedencias`);
      }
      const existing = await tx.get<CaptureRow>(
        "SELECT * FROM capture WHERE device_id = ? AND external_capture_id = ?",
        [config.device_id, externalCaptureId],
      );
      if (existing) {
        if (existing.session_id === sessionId && existing.configuration_id === config.configuration_id) return existing;
        throw new Error(`capture_id ${externalCaptureId} ya pertenece a otra sesión o configuración`);
      }
      const r = await tx.run(
        "INSERT INTO capture (session_id, device_id, configuration_id, external_capture_id, source, started_at) VALUES (?, ?, ?, ?, ?, ?)",
        [sessionId, config.device_id, config.configuration_id, externalCaptureId, config.source, startedAt],
      );
      return (await tx.get<CaptureRow>("SELECT * FROM capture WHERE id = ?", [r.lastInsertRowId]))!;
    });
  }

  async getCaptures(sessionId: string): Promise<CaptureRow[]> {
    return this.db.all<CaptureRow>("SELECT * FROM capture WHERE session_id = ? ORDER BY id", [sessionId]);
  }

  // ---- registros y muestras ----------------------------------------------

  /**
   * Inserta un lote de registros en una sola transacción, con un savepoint por
   * registro: un registro defectuoso se revierte solo y no arrastra al resto.
   * Un duplicado idéntico no crea filas; un duplicado con contenido distinto
   * conserva el original y deja el payload nuevo en diagnóstico.
   */
  async insertRecords(captureId: number, records: readonly NormalizedRecord[]): Promise<InsertOutcome[]> {
    if (records.length === 0) return [];
    return this.db.transaction(async (tx) => {
      const capture = await tx.get<CaptureRow>("SELECT * FROM capture WHERE id = ?", [captureId]);
      if (!capture) throw new Error(`captura ${captureId} inexistente`);
      const channels = await tx.all<{ installation_id: string; code: string }>(
        "SELECT installation_id, code FROM channel WHERE configuration_id = ?",
        [capture.configuration_id],
      );
      const installationByCode = new Map(channels.map((c) => [c.code, c.installation_id]));

      const outcomes: InsertOutcome[] = [];
      for (const [i, record] of records.entries()) {
        if (record.capture_id !== capture.external_capture_id || record.device_id !== capture.device_id) {
          outcomes.push({ outcome: "rejected", reason: "el registro no pertenece a esta captura" });
          continue;
        }
        if (record.configuration_id !== capture.configuration_id) {
          outcomes.push({ outcome: "rejected", reason: "configuración distinta de la autorizada para la captura" });
          continue;
        }
        const existing = await tx.get<RecordRow>("SELECT * FROM record WHERE capture_id = ? AND sequence = ?", [captureId, record.sequence]);
        if (existing) {
          const stored = await tx.all<SampleRow>("SELECT * FROM sample WHERE record_id = ? ORDER BY channel_code", [existing.id]);
          if (samplesEqual(stored, record.samples)) {
            outcomes.push({ outcome: "duplicate", record_id: existing.id });
          } else {
            await tx.run(
              "INSERT INTO diagnostic (session_id, received_at, reason, payload) VALUES (?, ?, ?, ?)",
              [capture.session_id, record.received_at, `conflicto: secuencia ${record.sequence} recibida con contenido distinto`, JSON.stringify(record)],
            );
            outcomes.push({ outcome: "conflict", record_id: existing.id });
          }
          continue;
        }
        try {
          const recordId = await withSavepoint(tx, `rec_${i}`, async () => {
            const r = await tx.run(
              "INSERT INTO record (capture_id, sequence, format_version, received_at) VALUES (?, ?, ?, ?)",
              [captureId, record.sequence, record.format_version, record.received_at],
            );
            for (const s of record.samples) {
              const installation = installationByCode.get(s.channel_id);
              if (!installation) throw new Error(`canal ${s.channel_id} no pertenece a la configuración ${capture.configuration_id}`);
              await tx.run(
                "INSERT INTO sample (record_id, channel_installation_id, channel_code, time_us, raw_value, unit, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [r.lastInsertRowId, installation, s.channel_id, s.time_us, s.raw_value, s.unit, s.status],
              );
            }
            return r.lastInsertRowId;
          });
          outcomes.push({ outcome: "inserted", record_id: recordId });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await tx.run(
            "INSERT INTO diagnostic (session_id, received_at, reason, payload) VALUES (?, ?, ?, ?)",
            [capture.session_id, record.received_at, `rechazado al guardar: ${reason}`, JSON.stringify(record)],
          );
          outcomes.push({ outcome: "rejected", reason });
        }
      }
      await trimDiagnostics(tx, capture.session_id);
      return outcomes;
    });
  }

  async getRecords(captureId: number, opts: { fromSequence?: number; toSequence?: number; limit?: number } = {}): Promise<RecordRow[]> {
    const from = opts.fromSequence ?? 0;
    const to = opts.toSequence ?? Number.MAX_SAFE_INTEGER;
    const limit = opts.limit ?? 100_000;
    return this.db.all<RecordRow>(
      "SELECT * FROM record WHERE capture_id = ? AND sequence BETWEEN ? AND ? ORDER BY sequence LIMIT ?",
      [captureId, from, to, limit],
    );
  }

  async getSamples(captureId: number, channel?: ChannelCode): Promise<SampleRow[]> {
    const sql = `SELECT s.* FROM sample s JOIN record r ON r.id = s.record_id
      WHERE r.capture_id = ? ${channel ? "AND s.channel_code = ?" : ""}
      ORDER BY r.sequence, s.time_us`;
    return this.db.all<SampleRow>(sql, channel ? [captureId, channel] : [captureId]);
  }

  async countRecords(captureId: number): Promise<number> {
    const row = await this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM record WHERE capture_id = ?", [captureId]);
    return row?.n ?? 0;
  }

  // ---- eventos y diagnóstico ---------------------------------------------

  async addEvent(sessionId: string, captureId: number | null, event: EventLike, receivedAt: string): Promise<void> {
    const { type, at_us, ...rest } = event;
    const detail = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null;
    await this.db.run(
      "INSERT INTO event (session_id, capture_id, type, at_us, received_at, detail) VALUES (?, ?, ?, ?, ?, ?)",
      [sessionId, captureId, type, at_us ?? null, receivedAt, detail],
    );
  }

  async addDiagnostic(sessionId: string, reason: string, payload: unknown, receivedAt: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run("INSERT INTO diagnostic (session_id, received_at, reason, payload) VALUES (?, ?, ?, ?)", [
        sessionId, receivedAt, reason, JSON.stringify(payload),
      ]);
      await trimDiagnostics(tx, sessionId);
    });
  }

  async getEvents(sessionId: string): Promise<EventRow[]> {
    return this.db.all<EventRow>("SELECT * FROM event WHERE session_id = ? ORDER BY id", [sessionId]);
  }

  async getDiagnostics(sessionId: string): Promise<{ id: number; received_at: string; reason: string; payload: string }[]> {
    return this.db.all("SELECT id, received_at, reason, payload FROM diagnostic WHERE session_id = ? ORDER BY id", [sessionId]);
  }
}

function samplesEqual(stored: readonly SampleRow[], incoming: readonly Sample[]): boolean {
  if (stored.length !== incoming.length) return false;
  const sorted = [...incoming].sort((a, b) => a.channel_id.localeCompare(b.channel_id));
  return sorted.every((s, i) => {
    const t = stored[i]!;
    return t.channel_code === s.channel_id && t.time_us === s.time_us && t.raw_value === s.raw_value && t.unit === s.unit && t.status === s.status;
  });
}

async function trimDiagnostics(tx: SqlExecutor, sessionId: string): Promise<void> {
  await tx.run(
    `DELETE FROM diagnostic WHERE session_id = ? AND id NOT IN (
       SELECT id FROM diagnostic WHERE session_id = ? ORDER BY id DESC LIMIT ?)`,
    [sessionId, sessionId, DIAGNOSTIC_LIMIT],
  );
}
