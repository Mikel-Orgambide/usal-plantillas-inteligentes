import {
  SyncRejectedError,
  type EntityCounts,
  type RemoteCapturePayload,
  type RemoteEventPayload,
  type RemoteGateway,
  type RemoteRecordPayload,
  type RemoteResultPayload,
  type RemoteSessionPayload,
} from "../src/index";

/**
 * Servicio remoto en memoria con las mismas reglas que el esquema de Supabase
 * (supabase/migrations/0001_remote_schema.sql): cada fila tiene titular; una
 * sesión de otro titular es invisible y su id no puede reutilizarse; los
 * registros se identifican por captura y secuencia; eventos por sesión e id
 * local; resultados por captura, canal y versión.
 */
export class FakeRemote implements RemoteGateway {
  readonly sessions = new Map<string, { owner: string; header: RemoteSessionPayload }>();
  readonly captures = new Map<string, { owner: string; sessionId: string; external: string }>();
  readonly records = new Map<string, Map<number, RemoteRecordPayload>>();
  readonly events = new Map<string, Map<number, RemoteEventPayload>>();
  readonly results = new Map<string, Map<string, RemoteResultPayload>>();
  readonly calls: string[] = [];
  /** Cuenta que realiza las llamadas (auth.uid). */
  owner = "uuid-A";
  /** Falla transitoria en las próximas N llamadas. */
  failNext = 0;
  /** Cantidades que el cierre informa en lugar de las reales (confirmación incierta). */
  reportOverride: Partial<EntityCounts> | undefined;
  private nextCaptureId = 1;

  private guard(name: string): void {
    this.calls.push(name);
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error("falla de red simulada");
    }
  }

  async beginSession(session: RemoteSessionPayload, captures: readonly RemoteCapturePayload[]): Promise<{ captures: Record<string, string> }> {
    this.guard("begin");
    const existing = this.sessions.get(session.id);
    if (existing && existing.owner !== this.owner) throw new SyncRejectedError("new row violates row-level security policy for table \"session\"");
    this.sessions.set(session.id, { owner: this.owner, header: session });
    const out: Record<string, string> = {};
    for (const c of captures) {
      let id = [...this.captures.entries()].find(([, v]) => v.sessionId === session.id && v.external === c.external_capture_id)?.[0];
      if (!id) {
        id = String(this.nextCaptureId++);
        this.captures.set(id, { owner: this.owner, sessionId: session.id, external: c.external_capture_id });
        this.records.set(id, new Map());
        this.results.set(id, new Map());
      }
      out[c.external_capture_id] = id;
    }
    return { captures: out };
  }

  async pushRecords(remoteCaptureId: string, records: readonly RemoteRecordPayload[]): Promise<{ inserted: number }> {
    this.guard("records");
    const cap = this.captures.get(remoteCaptureId);
    if (!cap || cap.owner !== this.owner) throw new SyncRejectedError("captura inexistente o de otra cuenta");
    const store = this.records.get(remoteCaptureId)!;
    let inserted = 0;
    for (const r of records) {
      if (store.has(r.sequence)) continue;
      store.set(r.sequence, r);
      inserted += 1;
    }
    return { inserted };
  }

  async finishSession(sessionId: string, events: readonly RemoteEventPayload[], results: readonly RemoteResultPayload[]): Promise<EntityCounts> {
    this.guard("finish");
    const s = this.sessions.get(sessionId);
    if (!s || s.owner !== this.owner) throw new SyncRejectedError("sesión inexistente o de otra cuenta");
    const ev = this.events.get(sessionId) ?? new Map<number, RemoteEventPayload>();
    for (const e of events) if (!ev.has(e.local_id)) ev.set(e.local_id, e);
    this.events.set(sessionId, ev);
    for (const r of results) {
      const capId = [...this.captures.entries()].find(([, v]) => v.sessionId === sessionId && v.external === r.capture_external_id)?.[0];
      if (!capId) throw new SyncRejectedError(`resultado de una captura desconocida: ${r.capture_external_id}`);
      this.results.get(capId)!.set(`${r.channel_code}|${r.metric_version}`, r);
    }
    const real = this.countsOf(sessionId);
    return { ...real, ...this.reportOverride };
  }

  countsOf(sessionId: string): EntityCounts {
    const caps = [...this.captures.entries()].filter(([, v]) => v.sessionId === sessionId).map(([id]) => id);
    return {
      captures: caps.length,
      records: caps.reduce((n, id) => n + (this.records.get(id)?.size ?? 0), 0),
      events: this.events.get(sessionId)?.size ?? 0,
      results: caps.reduce((n, id) => n + (this.results.get(id)?.size ?? 0), 0),
    };
  }

  /** Sesiones visibles para una cuenta (lo que devolvería `select * from session` bajo RLS). */
  visibleSessions(owner: string): string[] {
    return [...this.sessions.entries()].filter(([, v]) => v.owner === owner).map(([id]) => id);
  }
}
