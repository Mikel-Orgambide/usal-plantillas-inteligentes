import {
  CHANNEL_CODES,
  classifySequence,
  configuredChannels,
  normalizeRecord,
  validateSourceRecord,
  CHANNEL_POSITIONS,
  footAvailability,
  type AcquisitionConfiguration,
  type ChannelCode,
  type DataSource,
  type Foot,
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

/** Un módulo de sensado: una fuente (placa o simulador) con su configuración. */
export interface SessionModule {
  readonly source: DataSource;
  readonly configuration: AcquisitionConfiguration;
}

export interface CoordinatorOptions {
  readonly repository: SessionRepository;
  /** Forma simple (un módulo). Equivale a `modules: [{ source, configuration }]`. */
  readonly source?: DataSource;
  readonly configuration?: AcquisitionConfiguration;
  /**
   * Uno o dos módulos (ADR 0011): uno por pie, cada uno con su dispositivo, captura,
   * secuencia y reloj. No se admiten dos módulos del mismo pie ni procedencias distintas.
   */
  readonly modules?: readonly SessionModule[];
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

/**
 * Último valor conocido de una posición.
 * - `ok` / `read_error`: lectura recibida en el último registro.
 * - `stale`: la posición está instrumentada pero no hay registro reciente (antes del primero o tras un corte).
 * - `unavailable`: la posición no forma parte de la configuración (p. ej. pie derecho en el módulo unilateral). Nunca se representa con cero.
 */
export type ChannelValue = { readonly value: number | null; readonly status: "ok" | "read_error" | "stale" | "unavailable" };

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

/**
 * Estado del enlace de un módulo durante la sesión.
 * - `identified`: conocido, todavía sin enlace (antes de iniciar).
 * - `connected`: enlace activo y registros llegando.
 * - `stale`: enlace activo pero sin registros recientes.
 * - `disconnected`: el enlace se cortó y no se está intentando recuperar.
 * - `reconnecting`: el enlace se cortó y la fuente intenta recuperarlo.
 */
export type ModuleStatus = "identified" | "connected" | "stale" | "disconnected" | "reconnecting";

export interface ModuleSnapshot {
  readonly device_id: string;
  readonly configuration_id: string;
  /** Pie que instrumenta el módulo; `null` si instrumenta ambos (p. ej. simulador de seis). */
  readonly foot: Foot | null;
  readonly channels: readonly ChannelCode[];
  readonly status: ModuleStatus;
  readonly captureId: string | undefined;
  readonly stats: SessionStats;
  readonly lastEvent: string | undefined;
  readonly lastError: string | undefined;
  readonly lastReadError: string | undefined;
}

export interface SessionSnapshot {
  readonly sessionId: string;
  readonly state: SessionState;
  /** Captura del primer módulo (compatibilidad); con dos módulos, ver `modules[].captureId`. */
  readonly captureId: string | undefined;
  readonly values: Readonly<Record<ChannelCode, ChannelValue>>;
  /** Totales de todos los módulos. */
  readonly stats: SessionStats;
  readonly modules: readonly ModuleSnapshot[];
  /** `true` cuando los módulos instrumentan ambos pies. */
  readonly bilateral: boolean;
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

/** Valores iniciales: `stale` para las posiciones configuradas por algún módulo, `unavailable` para el resto. */
const emptyValues = (configs: readonly AcquisitionConfiguration[]): Record<ChannelCode, ChannelValue> => {
  const configured = new Set(configs.flatMap((c) => configuredChannels(c)));
  return Object.fromEntries(
    CHANNEL_CODES.map((c) => [c, { value: null, status: configured.has(c) ? "stale" : "unavailable" }]),
  ) as Record<ChannelCode, ChannelValue>;
};

const footOf = (config: AcquisitionConfiguration): Foot | null => {
  const a = footAvailability(config);
  if (a.left && a.right) return null;
  return a.left ? "left" : a.right ? "right" : null;
};

const sumStats = (parts: readonly SessionStats[]): SessionStats => parts.reduce((acc, s) => ({
  received: acc.received + s.received, accepted: acc.accepted + s.accepted, rejected: acc.rejected + s.rejected,
  duplicates: acc.duplicates + s.duplicates, gaps: acc.gaps + s.gaps, outOfOrder: acc.outOfOrder + s.outOfOrder,
  lateRejected: acc.lateRejected + s.lateRejected, committed: acc.committed + s.committed, pending: acc.pending + s.pending,
  failedBatches: acc.failedBatches + s.failedBatches, captures: acc.captures + s.captures,
}), emptyStats());

/** Estado interno de un módulo: todo lo que antes era de la sesión y ahora es por dispositivo. */
class ModuleState {
  readonly source: DataSource;
  readonly config: AcquisitionConfiguration;
  readonly channels: readonly ChannelCode[];
  readonly foot: Foot | null;
  status: ModuleStatus = "identified";
  stats: SessionStats = emptyStats();
  values: Partial<Record<ChannelCode, ChannelValue>> = {};
  lastEvent: string | undefined;
  lastError: string | undefined;
  lastReadError: string | undefined;
  captureExternalId: string | undefined;
  captureRowId: number | undefined;
  queue: WriteQueue | undefined;
  /** Registros confirmados por colas ya cerradas (capturas anteriores del mismo módulo). */
  committedClosed = 0;
  trackedCaptureId: string | undefined;
  lastSequence: number | undefined;
  unsubscribe: (() => void) | undefined;
  /** Instante monotónico en que se perdió el enlace (tramo incompleto en curso). */
  lostAtMono: number | undefined;

  constructor(m: SessionModule) {
    this.source = m.source;
    this.config = m.configuration;
    this.channels = configuredChannels(m.configuration);
    this.foot = footOf(m.configuration);
  }

  snapshot(): ModuleSnapshot {
    return {
      device_id: this.config.device_id, configuration_id: this.config.configuration_id, foot: this.foot, channels: this.channels,
      status: this.status, captureId: this.captureExternalId,
      stats: { ...this.stats, committed: this.committedClosed + (this.queue?.stats.committed ?? 0), pending: this.queue?.stats.pending ?? 0 },
      lastEvent: this.lastEvent, lastError: this.lastError, lastReadError: this.lastReadError,
    };
  }

  markStale(): void {
    for (const c of this.channels) this.values[c] = { ...(this.values[c] ?? { value: null, status: "stale" }), status: "stale" };
  }
}

const emptyStats = (): SessionStats => ({
  received: 0, accepted: 0, rejected: 0, duplicates: 0, gaps: 0, outOfOrder: 0, lateRejected: 0,
  committed: 0, pending: 0, failedBatches: 0, captures: 0,
});

export class SessionCoordinator {
  readonly sessionId: string;
  private readonly repo: SessionRepository;
  private readonly modules: readonly ModuleState[];
  /** Procedencia común de la sesión (todos los módulos la comparten). */
  private readonly sourceKind: AcquisitionConfiguration["source"];
  private readonly clock: Clock;
  private readonly opts: CoordinatorOptions;

  private state: SessionState = "prepared";
  private prepared = false;
  private listeners = new Set<SnapshotListener>();

  private lastEvent: string | undefined;
  private lastError: string | undefined;

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
    const defs: SessionModule[] = opts.modules ? [...opts.modules] : [];
    if (defs.length === 0) {
      if (!opts.source || !opts.configuration) throw new Error("la sesión necesita al menos un módulo (source + configuration)");
      defs.push({ source: opts.source, configuration: opts.configuration });
    }
    if (defs.length > 2) throw new Error("una sesión admite como máximo dos módulos (uno por pie)");
    const feet = defs.map((d) => footOf(d.configuration));
    if (defs.length === 2) {
      if (feet[0] === null || feet[1] === null) throw new Error("con dos módulos cada uno debe instrumentar un solo pie");
      if (feet[0] === feet[1]) throw new Error(`los dos módulos instrumentan el mismo pie (${feet[0]})`);
      if (defs[0]!.configuration.source !== defs[1]!.configuration.source) throw new Error("no se mezclan procedencias (simulada y física) en una sesión");
      if (defs[0]!.configuration.device_id === defs[1]!.configuration.device_id) throw new Error("los dos módulos tienen el mismo device_id");
    }
    this.modules = defs.map((d) => new ModuleState(d));
    this.sourceKind = defs[0]!.configuration.source;
    this.clock = opts.clock ?? systemClock;
  }

  /** Valores por posición: lo último recibido de cada módulo; el resto `stale`/`unavailable`. */
  private mergedValues(): Record<ChannelCode, ChannelValue> {
    const v = emptyValues(this.modules.map((m) => m.config));
    for (const m of this.modules) for (const c of m.channels) if (m.values[c]) v[c] = m.values[c]!;
    return v;
  }

  private get bilateral(): boolean {
    const feet = new Set(this.modules.flatMap((m) => m.channels.map((c) => CHANNEL_POSITIONS[c].foot)));
    return feet.has("left") && feet.has("right");
  }

  get currentState(): SessionState {
    return this.state;
  }

  snapshot(): SessionSnapshot {
    const end = this.stoppedMono ?? this.clock.monotonicMs();
    const modules = this.modules.map((m) => m.snapshot());
    return {
      sessionId: this.sessionId,
      state: this.state,
      captureId: modules[0]?.captureId,
      values: this.mergedValues(),
      stats: sumStats(modules.map((m) => m.stats)),
      modules,
      bilateral: this.bilateral,
      lastEvent: this.lastEvent,
      lastError: this.lastError ?? modules.map((m) => m.lastError).find((e) => e !== undefined),
      lastReadError: modules.map((m) => m.lastReadError).find((e) => e !== undefined),
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
    for (const m of this.modules) await this.repo.ensureConfiguration(m.config);
    await this.repo.createSession({
      id: this.sessionId,
      user_id: this.opts.userId,
      activity: this.opts.activity,
      ...(this.opts.context !== undefined ? { context: this.opts.context } : {}),
      source: this.sourceKind,
      started_at: this.clock.nowIso(),
    });
    this.prepared = true;
    this.notify();
  }

  /** prepared → recording: conecta la fuente, inicia la captura y acepta registros. */
  async start(): Promise<void> {
    if (!this.prepared) await this.prepare();
    if (this.state !== "prepared") throw new Error(`no se puede iniciar desde el estado ${this.state}`);
    const failures: string[] = [];
    for (const m of this.modules) {
      m.unsubscribe = m.source.subscribe({
        onPayload: (p) => this.onPayload(m, p),
        onEvent: (e) => this.onEvent(m, e),
      });
      try {
        await m.source.connect();
        await m.source.startCapture();
        m.status = "connected";
      } catch (error) {
        // Falta de un módulo al inicio (ADR 0011): la sesión arranca con los que respondieron;
        // el ausente queda `disconnected` con su tramo incompleto desde el inicio.
        m.unsubscribe?.();
        m.unsubscribe = undefined;
        m.status = "disconnected";
        m.lastError = `no se pudo iniciar la fuente: ${message(error)}`;
        m.lostAtMono = this.clock.monotonicMs();
        failures.push(`${m.config.device_id}: ${message(error)}`);
      }
    }
    const started = this.modules.filter((m) => m.status === "connected");
    if (started.length === 0) {
      const reason = `no se pudo iniciar la fuente: ${failures.join("; ")}`;
      await this.finish("incomplete", reason);
      throw new Error(reason);
    }
    this.startedMono = this.clock.monotonicMs();
    await this.setState("recording");
    this.enqueueDb(() => this.repo.addEvent(this.sessionId, null, { type: "session_started", modules: this.modules.map((m) => m.config.device_id) }, this.clock.nowIso()));
    for (const m of this.modules) {
      if (m.status !== "disconnected") continue;
      this.lastError = m.lastError;
      this.enqueueDb(() => this.repo.addEvent(this.sessionId, null, { type: "module_lost", device_id: m.config.device_id, foot: m.foot, reason: m.lastError ?? "no inició" }, this.clock.nowIso()));
    }
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
    const active = this.modules.filter((m) => m.status !== "disconnected" || m.unsubscribe);
    for (const m of active) {
      try {
        await m.source.stopCapture();
      } catch (error) {
        stopError = `${m.config.device_id}: la fuente no confirmó la detención: ${message(error)}`;
        this.lastError = stopError;
      }
    }
    if (window > 0) await sleep(window);
    this.stoppedMono = this.clock.monotonicMs();
    for (const m of this.modules) { m.unsubscribe?.(); m.unsubscribe = undefined; }

    await this.chain; // eventos y aperturas de captura pendientes
    for (const m of this.modules) await m.queue?.close();
    for (const m of active) {
      try {
        await m.source.disconnect();
      } catch (error) {
        this.lastError = `${m.config.device_id}: la fuente no confirmó la desconexión: ${message(error)}`;
      }
    }

    // Completa si al menos un módulo asoció captura y ninguno tuvo lotes fallidos ni detención sin confirmar.
    const withCapture = this.modules.filter((m) => m.captureRowId !== undefined);
    const failedBatches = this.modules.reduce((n, m) => n + (m.queue?.stats.failedBatches ?? 0), 0);
    const complete = withCapture.length > 0 && failedBatches === 0 && stopError === undefined;
    const reason = !complete
      ? stopError ?? (withCapture.length === 0 ? "sin captura asociada" : "hubo lotes de escritura fallidos")
      : undefined;
    await this.finish(complete ? "completed" : "incomplete", reason);
    return this.result(this.state as "completed" | "incomplete", reason);
  }

  private async finish(state: "completed" | "incomplete", reason?: string): Promise<void> {
    const durationMs = this.snapshot().durationMs;
    await this.repo.addEvent(this.sessionId, this.modules[0]?.captureRowId ?? null, { type: "session_stopped", state, ...(reason ? { reason } : {}) }, this.clock.nowIso());
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

  private onPayload(m: ModuleState, payload: unknown): void {
    const receivedAt = this.clock.nowIso();
    if (!this.accepting()) {
      m.stats = { ...m.stats, lateRejected: m.stats.lateRejected + 1 };
      this.notify();
      return;
    }
    m.stats = { ...m.stats, received: m.stats.received + 1 };
    const result = validateSourceRecord(payload, m.config);
    if (!result.ok) {
      const reason = result.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
      m.stats = { ...m.stats, rejected: m.stats.rejected + 1 };
      m.lastError = reason;
      this.enqueueDb(() => this.repo.addDiagnostic(this.sessionId, reason, payload, receivedAt));
      this.notify();
      return;
    }
    const rec = result.record;
    if (m.status !== "connected") m.status = "connected";
    this.trackSequence(m, rec);
    for (const smp of rec.samples) m.values[smp.channel_id] = { value: smp.raw_value, status: smp.status };
    const record = normalizeRecord(rec, { source: this.sourceKind, session_id: this.sessionId, received_at: receivedAt });
    this.enqueueDb(async () => {
      await this.ensureCapture(m, rec.capture_id);
      m.queue!.enqueue(record);
    });
    this.notify();
  }

  private trackSequence(m: ModuleState, rec: SourceRecord): void {
    if (rec.capture_id !== m.trackedCaptureId) {
      m.trackedCaptureId = rec.capture_id;
      m.lastSequence = undefined;
    }
    const rel = classifySequence(m.lastSequence, rec.sequence);
    const s = { ...m.stats, accepted: m.stats.accepted + 1 };
    const dev = this.modules.length > 1 ? { device_id: m.config.device_id } : {};
    if (rel.kind === "duplicate") s.duplicates += 1;
    else if (rel.kind === "out_of_order") {
      s.outOfOrder += 1;
      this.enqueueDb(() => this.repo.addEvent(this.sessionId, m.captureRowId ?? null, { type: "out_of_order", sequence: rec.sequence, behind_by: rel.behind_by, ...dev }, this.clock.nowIso()));
    } else if (rel.kind === "gap") {
      s.gaps += 1;
      this.enqueueDb(() => this.repo.addEvent(this.sessionId, m.captureRowId ?? null, { type: "sequence_gap", missing_from: rel.missing_from, missing_to: rel.missing_to, missing_count: rel.missing_count, ...dev }, this.clock.nowIso()));
    }
    if (rel.kind !== "duplicate" && rel.kind !== "out_of_order") m.lastSequence = rec.sequence;
    m.stats = s;
    const failed = rec.samples.filter((smp) => smp.status === "read_error");
    if (failed.length > 0) m.lastReadError = `secuencia ${rec.sequence}: ${failed.map((smp) => smp.channel_id).join(", ")}`;
  }

  /** Asocia la captura anunciada por la fuente del módulo; un identificador nuevo es un reinicio. */
  private async ensureCapture(m: ModuleState, externalId: string): Promise<void> {
    if (m.captureExternalId === externalId && m.queue) return;
    if (m.queue) {
      await m.queue.close();
      m.committedClosed += m.queue.stats.committed;
    }
    const capture = await this.repo.openCapture(this.sessionId, m.config, externalId, this.clock.nowIso());
    m.captureExternalId = externalId;
    m.captureRowId = capture.id;
    m.stats = { ...m.stats, captures: m.stats.captures + 1 };
    m.queue = new WriteQueue(this.repo, capture.id, {
      ...(this.opts.batchSize !== undefined ? { batchSize: this.opts.batchSize } : {}),
      ...(this.opts.maxLatencyMs !== undefined ? { maxLatencyMs: this.opts.maxLatencyMs } : {}),
      onBatch: () => this.notify(),
      onError: (e) => {
        m.stats = { ...m.stats, failedBatches: m.stats.failedBatches + 1 };
        m.lastError = `error al guardar: ${message(e)}`;
        this.notify();
      },
    });
    this.notify();
  }

  private onEvent(m: ModuleState, event: SourceEvent): void {
    const receivedAt = this.clock.nowIso();
    this.lastEvent = event.type;
    m.lastEvent = event.type;
    const multi = this.modules.length > 1;
    const dev = multi ? { device_id: m.config.device_id } : {};
    if (event.type === "disconnected" && (this.state === "recording" || this.state === "interrupted")) {
      m.status = "reconnecting";
      m.markStale();
      m.lostAtMono = this.clock.monotonicMs();
      if (multi) this.enqueueDb(() => this.repo.addEvent(this.sessionId, m.captureRowId ?? null, { type: "module_lost", device_id: m.config.device_id, foot: m.foot, reason: event.reason }, receivedAt));
      if (this.modules.every((x) => x.status !== "connected" && x.status !== "stale") && this.state === "recording") {
        // Sin ningún módulo con enlace, la sesión está interrumpida; con uno vivo, continúa (ADR 0011).
        this.state = "interrupted";
        this.enqueueDb(() => this.repo.setSessionState(this.sessionId, "interrupted"));
      }
    } else if (event.type === "reconnected") {
      m.status = "connected";
      if (multi && m.lostAtMono !== undefined) {
        const lost = this.clock.monotonicMs() - m.lostAtMono;
        this.enqueueDb(() => this.repo.addEvent(this.sessionId, m.captureRowId ?? null, { type: "module_recovered", device_id: m.config.device_id, foot: m.foot, incomplete_ms: Math.round(lost) }, receivedAt));
      }
      m.lostAtMono = undefined;
      if (this.state === "interrupted") {
        this.state = "recording";
        this.enqueueDb(() => this.repo.setSessionState(this.sessionId, "recording"));
      }
    } else if (event.type === "source_error" && m.status === "reconnecting" && /no se pudo reconectar/.test(event.message)) {
      m.status = "disconnected";
    }
    if (event.type === "capture_restarted" || event.type === "capture_started") {
      // La captura se asocia al recibir el identificador; si la fuente lo anuncia antes, se abre ya.
      this.enqueueDb(() => this.ensureCapture(m, event.capture_id));
    }
    this.enqueueDb(() => this.repo.addEvent(this.sessionId, m.captureRowId ?? null, { ...event, ...dev }, receivedAt));
    this.notify();
  }
}

/**
 * Al arrancar la aplicación: toda sesión que quedó abierta se conserva como
 * `incomplete` con un evento que explica por qué (S02). No se borra nada.
 */
export async function recoverOpenSessions(repo: SessionRepository, clock: Clock = systemClock): Promise<string[]> {
  const open = await repo.listOpenSessions();
  for (const s of open) {
    // Duración estimada: desde el inicio hasta la última recepción conocida. No es la duración
    // medida por el reloj monotónico, y queda identificada como estimación en el evento.
    const last = await repo.lastActivityAt(s.id);
    const estimated = last ? Math.max(0, Date.parse(last) - Date.parse(s.started_at)) : 0;
    await repo.addEvent(s.id, null, {
      type: "recovered_incomplete", previous_state: s.state,
      reason: "la aplicación se reinició con la sesión abierta",
      duration_estimated_ms: estimated, duration_basis: last ? "última recepción" : "sin recepciones",
    }, clock.nowIso());
    await repo.closeSession(s.id, last ?? clock.nowIso(), estimated, "incomplete");
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
