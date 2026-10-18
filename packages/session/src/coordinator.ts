import {
  CHANNEL_CODES,
  classifySequence,
  normalizeRecord,
  validateSourceRecord,
  type AcquisitionConfiguration,
  type ChannelCode,
  type DataSource,
  type SourceEvent,
  type SourceRecord,
} from "@plantillas/contract";
import { WriteQueue, type EventLike, type SessionRepository, type SessionState } from "@plantillas/storage";
import { systemClock, type Clock } from "./clock";

/**
 * Coordinador de sesión (etapa 4).
 *
 * Máquina de estados:
 *   prepared → recording ⇄ interrupted → finalizing → completed | incomplete
 *
 * Flujo de inicio: crear sesión → conectar fuente → iniciar captura → asociar
 * la captura al recibir su identificador → aceptar registros.
 * Flujo de cierre: solicitar detención → ventana de datos tardíos → vaciar la
 * cola → confirmar estado → resumen. `stop()` es idempotente (S01).
 */

export interface CoordinatorOptions {
  readonly repository: SessionRepository;
  readonly source: DataSource;
  readonly configuration: AcquisitionConfiguration;
  readonly userId: string;
  readonly activity: string;
  readonly context?: string;
  readonly sessionId: string;
  readonly clock?: Clock;
  /** Milisegundos durante los que se aceptan registros después de pedir la detención. */
  readonly lateDataWindowMs?: number;
  /** Tamaño de lote y latencia de la cola de escritura. */
  readonly batchSize?: number;
  readonly maxLatencyMs?: number;
}

export type ChannelValue = { readonly value: number | null; readonly status: "ok" | "read_error" | "stale" };

export interface SessionStats {
  readonly received: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly duplicates: number;
  readonly gaps: number;
  readonly outOfOrder: number;
  readonly lateRejected: number;
  readonly committed: number;
  readonly pending: number;
  readonly failedBatches: number;
  readonly captures: number;
}

export interface SessionSnapshot {
  readonly sessionId: string;
  readonly state: SessionState;
  readonly captureId: string | undefined;
  readonly values: Readonly<Record<ChannelCode, ChannelValue>>;
  readonly stats: SessionStats;
  readonly lastEvent: string | undefined;
  readonly lastError: string | undefined;
  readonly lastReadError: string | undefined;
  /** Duración de grabación según el reloj monotónico, en ms. */
  readonly durationMs: number;
}

export interface SessionResult {
  readonly sessionId: string;
  readonly state: "completed" | "incomplete";
  readonly durationMs: number;
  readonly stats: SessionStats;
  readonly reason?: string;
}

export type SnapshotListener = (snapshot: SessionSnapshot) => void;

const emptyValues = (): Record<ChannelCode, ChannelValue> =>
  Object.fromEntries(CHANNEL_CODES.map((c) => [c, { value: null, status: "stale" }])) as Record<ChannelCode, ChannelValue>;

const emptyStats = (): SessionStats => ({
  received: 0, accepted: 0, rejected: 0, duplicates: 0, gaps: 0, outOfOrder: 0, lateRejected: 0,
  committed: 0, pending: 0, failedBatches: 0, captures: 0,
});

export class SessionCoordinator {
  readonly sessionId: string;
  private readonly repo: SessionRepository;
  private readonly source: DataSource;
  private readonly config: AcquisitionConfiguration;
  private readonly clock: Clock;
  private readonly opts: CoordinatorOptions;

  private state: SessionState = "prepared";
  private prepared = false;
  private listeners = new Set<SnapshotListener>();
  private unsubscribe: (() => void) | undefined;

  private values = emptyValues();
  private stats = emptyStats();
  private lastEvent: string | undefined;
  private lastError: string | undefined;
  private lastReadError: string | undefined;

  private captureExternalId: string | undefined;
  private captureRowId: number | undefined;
  private queue: WriteQueue | undefined;
  /** Registros confirmados por colas ya cerradas (capturas anteriores de la misma sesión). */
  private committedClosed = 0;
  /** Captura cuya secuencia se está siguiendo (se actualiza en forma síncrona al recibir). */
  private trackedCaptureId: string | undefined;
  private lastSequence: number | undefined;

  private startedMono = 0;
  private stoppedMono: number | undefined;
  private acceptingUntilMono: number | undefined;
  /** Encadena las operaciones sobre la base para conservar el orden de llegada. */
  private chain: Promise<void> = Promise.resolve();
  private stopping: Promise<SessionResult> | undefined;

  constructor(opts: CoordinatorOptions) {
    this.opts = opts;
    this.sessionId = opts.sessionId;
    this.repo = opts.repository;
    this.source = opts.source;
    this.config = opts.configuration;
    this.clock = opts.clock ?? systemClock;
  }

  get currentState(): SessionState {
    return this.state;
  }

  snapshot(): SessionSnapshot {
    const end = this.stoppedMono ?? this.clock.monotonicMs();
    return {
      sessionId: this.sessionId,
      state: this.state,
      captureId: this.captureExternalId,
      values: this.values,
      stats: { ...this.stats, committed: this.committedClosed + (this.queue?.stats.committed ?? 0), pending: this.queue?.stats.pending ?? 0 },
      lastEvent: this.lastEvent,
      lastError: this.lastError,
      lastReadError: this.lastReadError,
      durationMs: this.startedMono ? Math.max(0, Math.round(end - this.startedMono)) : 0,
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  // ---- ciclo de vida -------------------------------------------------------

  /** Crea la sesión en la base en estado `prepared`, con perfil, actividad y contexto. */
  async prepare(): Promise<void> {
    if (this.prepared) return;
    await this.repo.ensureConfiguration(this.config);
    await this.repo.createSession({
      id: this.sessionId,
      user_id: this.opts.userId,
      activity: this.opts.activity,
      ...(this.opts.context !== undefined ? { context: this.opts.context } : {}),
      source: this.config.source,
      started_at: this.clock.nowIso(),
    });
    this.prepared = true;
    this.notify();
  }

  /** prepared → recording: conecta la fuente, inicia la captura y acepta registros. */
  async start(): Promise<void> {
    if (!this.prepared) await this.prepare();
    if (this.state !== "prepared") throw new Error(`no se puede iniciar desde el estado ${this.state}`);
    this.unsubscribe = this.source.subscribe({
      onPayload: (p) => this.onPayload(p),
      onEvent: (e) => this.onEvent(e),
    });
    try {
      await this.source.connect();
      await this.source.startCapture();
    } catch (error) {
      this.unsubscribe?.();
      await this.finish("incomplete", `no se pudo iniciar la fuente: ${message(error)}`);
      throw error;
    }
    this.startedMono = this.clock.monotonicMs();
    await this.setState("recording");
    this.enqueueDb(() => this.repo.addEvent(this.sessionId, null, { type: "session_started" }, this.clock.nowIso()));
  }

  /**
   * Solicita la detención. Idempotente: llamadas repetidas devuelven el mismo
   * resultado y no cierran dos veces ni duplican eventos (S01).
   */
  stop(): Promise<SessionResult> {
    if (this.stopping) return this.stopping;
    this.stopping = this.doStop();
    return this.stopping;
  }

  private async doStop(): Promise<SessionResult> {
    if (this.state === "completed" || this.state === "incomplete") {
      return this.result(this.state);
    }
    if (this.state === "prepared") {
      if (!this.prepared) {
        this.state = "incomplete";
        this.notify();
        return this.result("incomplete", "detenida antes de preparar");
      }
      await this.finish("incomplete", "detenida antes de iniciar");
      return this.result("incomplete", "detenida antes de iniciar");
    }
    const window = this.opts.lateDataWindowMs ?? 0;
    this.acceptingUntilMono = this.clock.monotonicMs() + window;
    await this.setState("finalizing");

    let stopError: string | undefined;
    try {
      await this.source.stopCapture();
    } catch (error) {
      stopError = `la fuente no confirmó la detención: ${message(error)}`;
      this.lastError = stopError;
    }
    if (window > 0) await sleep(window);
    this.stoppedMono = this.clock.monotonicMs();
    this.unsubscribe?.();
    this.unsubscribe = undefined;

    await this.chain; // eventos y aperturas de captura pendientes
    await this.queue?.close();
    try {
      await this.source.disconnect();
    } catch (error) {
      this.lastError = `la fuente no confirmó la desconexión: ${message(error)}`;
    }

    const complete = this.captureRowId !== undefined && (this.queue?.stats.failedBatches ?? 0) === 0 && stopError === undefined;
    const reason = !complete
      ? stopError ?? (this.captureRowId === undefined ? "sin captura asociada" : "hubo lotes de escritura fallidos")
      : undefined;
    await this.finish(complete ? "completed" : "incomplete", reason);
    return this.result(this.state as "completed" | "incomplete", reason);
  }

  private async finish(state: "completed" | "incomplete", reason?: string): Promise<void> {
    const durationMs = this.snapshot().durationMs;
    await this.repo.addEvent(this.sessionId, this.captureRowId ?? null, { type: "session_stopped", state, ...(reason ? { reason } : {}) }, this.clock.nowIso());
    await this.repo.closeSession(this.sessionId, this.clock.nowIso(), durationMs, state);
    this.state = state;
    this.notify();
  }

  private result(state: "completed" | "incomplete", reason?: string): SessionResult {
    const snap = this.snapshot();
    return { sessionId: this.sessionId, state, durationMs: snap.durationMs, stats: snap.stats, ...(reason ? { reason } : {}) };
  }

  private async setState(state: SessionState): Promise<void> {
    this.state = state;
    await this.repo.setSessionState(this.sessionId, state);
    this.notify();
  }

  // ---- recepción -----------------------------------------------------------

  private enqueueDb(fn: () => Promise<void>): void {
    this.chain = this.chain.then(fn).catch((e: unknown) => {
      this.lastError = message(e);
      this.notify();
    });
  }

  private accepting(): boolean {
    if (this.state === "recording" || this.state === "interrupted") return true;
    if (this.state === "finalizing" && this.acceptingUntilMono !== undefined) {
      return this.clock.monotonicMs() <= this.acceptingUntilMono;
    }
    return false;
  }

  private onPayload(payload: unknown): void {
    const receivedAt = this.clock.nowIso();
    if (!this.accepting()) {
      this.stats = { ...this.stats, lateRejected: this.stats.lateRejected + 1 };
      this.notify();
      return;
    }
    this.stats = { ...this.stats, received: this.stats.received + 1 };
    const result = validateSourceRecord(payload, this.config);
    if (!result.ok) {
      const reason = result.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
      this.stats = { ...this.stats, rejected: this.stats.rejected + 1 };
      this.lastError = reason;
      this.enqueueDb(() => this.repo.addDiagnostic(this.sessionId, reason, payload, receivedAt));
      this.notify();
      return;
    }
    const rec = result.record;
    this.trackSequence(rec);
    this.updateValues(rec);
    const record = normalizeRecord(rec, { source: this.config.source, session_id: this.sessionId, received_at: receivedAt });
    this.enqueueDb(async () => {
      await this.ensureCapture(rec.capture_id);
      this.queue!.enqueue(record);
    });
    this.notify();
  }

  private trackSequence(rec: SourceRecord): void {
    if (rec.capture_id !== this.trackedCaptureId) {
      this.trackedCaptureId = rec.capture_id;
      this.lastSequence = undefined;
    }
    const rel = classifySequence(this.lastSequence, rec.sequence);
    const s = { ...this.stats, accepted: this.stats.accepted + 1 };
    if (rel.kind === "duplicate") s.duplicates += 1;
    else if (rel.kind === "out_of_order") {
      s.outOfOrder += 1;
      this.enqueueDb(() => this.repo.addEvent(this.sessionId, this.captureRowId ?? null, { type: "out_of_order", sequence: rec.sequence, behind_by: rel.behind_by }, this.clock.nowIso()));
    } else if (rel.kind === "gap") {
      s.gaps += 1;
      this.enqueueDb(() => this.repo.addEvent(this.sessionId, this.captureRowId ?? null, { type: "sequence_gap", missing_from: rel.missing_from, missing_to: rel.missing_to, missing_count: rel.missing_count }, this.clock.nowIso()));
    }
    if (rel.kind !== "duplicate" && rel.kind !== "out_of_order") this.lastSequence = rec.sequence;
    this.stats = s;
    const failed = rec.samples.filter((smp) => smp.status === "read_error");
    if (failed.length > 0) this.lastReadError = `secuencia ${rec.sequence}: ${failed.map((smp) => smp.channel_id).join(", ")}`;
  }

  private updateValues(rec: SourceRecord): void {
    const v = emptyValues();
    for (const smp of rec.samples) v[smp.channel_id] = { value: smp.raw_value, status: smp.status };
    this.values = v;
  }

  /** Asocia la captura anunciada por la fuente; un identificador nuevo es un reinicio. */
  private async ensureCapture(externalId: string): Promise<void> {
    if (this.captureExternalId === externalId && this.queue) return;
    if (this.queue) {
      await this.queue.close();
      this.committedClosed += this.queue.stats.committed;
    }
    const capture = await this.repo.openCapture(this.sessionId, this.config, externalId, this.clock.nowIso());
    this.captureExternalId = externalId;
    this.captureRowId = capture.id;
    this.stats = { ...this.stats, captures: this.stats.captures + 1 };
    this.queue = new WriteQueue(this.repo, capture.id, {
      ...(this.opts.batchSize !== undefined ? { batchSize: this.opts.batchSize } : {}),
      ...(this.opts.maxLatencyMs !== undefined ? { maxLatencyMs: this.opts.maxLatencyMs } : {}),
      onBatch: () => this.notify(),
      onError: (e) => {
        this.stats = { ...this.stats, failedBatches: this.stats.failedBatches + 1 };
        this.lastError = `error al guardar: ${message(e)}`;
        this.notify();
      },
    });
    this.notify();
  }

  private onEvent(event: SourceEvent): void {
    const receivedAt = this.clock.nowIso();
    this.lastEvent = event.type;
    if (event.type === "disconnected" && this.state === "recording") {
      this.state = "interrupted";
      this.markStale();
      this.enqueueDb(() => this.repo.setSessionState(this.sessionId, "interrupted"));
    } else if (event.type === "reconnected" && this.state === "interrupted") {
      this.state = "recording";
      this.enqueueDb(() => this.repo.setSessionState(this.sessionId, "recording"));
    }
    if (event.type === "capture_restarted" || event.type === "capture_started") {
      // La captura se asocia al recibir el identificador; si la fuente lo anuncia antes, se abre ya.
      this.enqueueDb(() => this.ensureCapture(event.capture_id));
    }
    this.enqueueDb(() => this.repo.addEvent(this.sessionId, this.captureRowId ?? null, event, receivedAt));
    this.notify();
  }

  private markStale(): void {
    const v = { ...this.values };
    for (const c of CHANNEL_CODES) v[c] = { ...v[c], status: "stale" };
    this.values = v;
  }
}

/**
 * Al arrancar la aplicación: toda sesión que quedó abierta se conserva como
 * `incomplete` con un evento que explica por qué (S02). No se borra nada.
 */
export async function recoverOpenSessions(repo: SessionRepository, clock: Clock = systemClock): Promise<string[]> {
  const open = await repo.listOpenSessions();
  for (const s of open) {
    await repo.addEvent(s.id, null, { type: "recovered_incomplete", previous_state: s.state, reason: "la aplicación se reinició con la sesión abierta" }, clock.nowIso());
    await repo.closeSession(s.id, clock.nowIso(), s.duration_ms ?? 0, "incomplete");
  }
  return open.map((s) => s.id);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type { EventLike };
