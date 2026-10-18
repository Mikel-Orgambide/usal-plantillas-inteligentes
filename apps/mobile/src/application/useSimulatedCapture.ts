import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  CHANNEL_CODES,
  SIMULATED_CONFIGURATION,
  classifySequence,
  normalizeRecord,
  validateSourceRecord,
  type ChannelCode,
  type SourceEvent,
} from "@plantillas/contract";
import { SCENARIOS, SimulatedDataSource, type ScenarioName } from "@plantillas/simulator";
import { WriteQueue, type SessionSummary } from "@plantillas/storage";
import { getDatabase } from "../infrastructure/sqlite/database";

/**
 * Caso de uso provisional (etapas 2–3): fuente simulada → validación →
 * normalización → cola de escritura → SQLite. Cada captura iniciada desde la
 * pantalla crea una sesión; detenerla la cierra con duración y estado.
 * La máquina de estados completa llega en la etapa 4.
 */

export type ChannelValue = { value: number | null; status: "ok" | "read_error" | "stale" };

export interface CaptureStats {
  received: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  gaps: number;
  outOfOrder: number;
  committed: number;
  pending: number;
  lastSequence: number | undefined;
  captureId: string | undefined;
  sessionId: string | undefined;
  lastEvent: string | undefined;
  lastError: string | undefined;
  lastReadError: string | undefined;
}

const emptyStats = (): CaptureStats => ({
  received: 0, accepted: 0, rejected: 0, duplicates: 0, gaps: 0, outOfOrder: 0, committed: 0, pending: 0,
  lastSequence: undefined, captureId: undefined, sessionId: undefined, lastEvent: undefined, lastError: undefined, lastReadError: undefined,
});

const emptyValues = (): Record<ChannelCode, ChannelValue> =>
  Object.fromEntries(CHANNEL_CODES.map((c) => [c, { value: null, status: "stale" }])) as Record<ChannelCode, ChannelValue>;

/** Intervalo de emisión de la pantalla de verificación, más lento que el del generador para poder observar las fallas. */
const VERIFICATION_INTERVAL_MS = 200;

const nowIso = (): string => new Date().toISOString();
/** Reloj monotónico del teléfono para la duración mostrada; no se mezcla con time_us de la captura. */
const monotonicMs = (): number => globalThis.performance?.now?.() ?? Date.now();

interface Active {
  source: SimulatedDataSource;
  queue: WriteQueue | undefined;
  sessionId: string;
  captureRowId: number | undefined;
  startedMono: number;
}

export function useSimulatedCapture(scenario: ScenarioName, seed: number) {
  const activeRef = useRef<Active | null>(null);
  const [running, setRunning] = useState(false);
  const [values, setValues] = useState<Record<ChannelCode, ChannelValue>>(emptyValues);
  const [stats, setStats] = useState<CaptureStats>(emptyStats);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [dbInfo, setDbInfo] = useState<string>("abriendo base…");

  const refreshHistory = useCallback(async () => {
    const { repository } = await getDatabase();
    setHistory(await repository.listSessions());
  }, []);

  useEffect(() => {
    getDatabase()
      .then(async ({ migration }) => {
        setDbInfo(`SQLite v${migration.to}${migration.applied.length ? ` (migrado desde ${migration.from})` : ""}`);
        await refreshHistory();
      })
      .catch((e: unknown) => setDbInfo(`error al abrir la base: ${e instanceof Error ? e.message : String(e)}`));
  }, [refreshHistory]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    const { repository } = await getDatabase();
    const sessionId = Crypto.randomUUID();
    const startedAt = nowIso();
    await repository.ensureConfiguration(SIMULATED_CONFIGURATION);
    await repository.createSession({ id: sessionId, user_id: "local", activity: `simulación ${scenario}`, context: `semilla ${seed}`, source: "simulated", started_at: startedAt });
    await repository.setSessionState(sessionId, "recording");

    const source = new SimulatedDataSource({ seed, scenario: SCENARIOS[scenario], emit_interval_ms: VERIFICATION_INTERVAL_MS });
    const active: Active = { source, queue: undefined, sessionId, captureRowId: undefined, startedMono: monotonicMs() };
    activeRef.current = active;
    setValues(emptyValues());
    setStats({ ...emptyStats(), sessionId });

    let lastSeq: number | undefined;
    let captureId: string | undefined;

    const ensureCapture = async (externalCaptureId: string): Promise<void> => {
      if (captureId === externalCaptureId && active.queue) return;
      if (active.queue) await active.queue.close();
      const capture = await repository.openCapture(sessionId, SIMULATED_CONFIGURATION, externalCaptureId, nowIso());
      active.captureRowId = capture.id;
      captureId = externalCaptureId;
      lastSeq = undefined;
      active.queue = new WriteQueue(repository, capture.id, {
        onBatch: () => setStats((s) => ({ ...s, committed: active.queue?.stats.committed ?? s.committed, pending: active.queue?.stats.pending ?? 0 })),
        onError: (e) => setStats((s) => ({ ...s, lastError: `error al guardar: ${e instanceof Error ? e.message : String(e)}` })),
      });
    };

    // Las operaciones sobre la base se encadenan para conservar el orden de llegada.
    let chain: Promise<void> = Promise.resolve();
    const serial = (fn: () => Promise<void>) => { chain = chain.then(fn).catch((e: unknown) => setStats((s) => ({ ...s, lastError: e instanceof Error ? e.message : String(e) }))); };

    source.subscribe({
      onPayload: (payload) => {
        const receivedAt = nowIso();
        const result = validateSourceRecord(payload, SIMULATED_CONFIGURATION);
        setStats((s) => {
          const next = { ...s, received: s.received + 1 };
          if (!result.ok) {
            next.rejected += 1;
            next.lastError = result.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
            return next;
          }
          const rec = result.record;
          if (rec.capture_id !== next.captureId) { next.captureId = rec.capture_id; lastSeq = undefined; }
          const rel = classifySequence(lastSeq, rec.sequence);
          if (rel.kind === "duplicate") next.duplicates += 1;
          else if (rel.kind === "gap") next.gaps += 1;
          else if (rel.kind === "out_of_order") next.outOfOrder += 1;
          if (rel.kind !== "duplicate" && rel.kind !== "out_of_order") lastSeq = rec.sequence;
          next.accepted += 1;
          next.lastSequence = rec.sequence;
          const failed = rec.samples.filter((smp) => smp.status === "read_error");
          if (failed.length > 0) next.lastReadError = `secuencia ${rec.sequence}: ${failed.map((smp) => smp.channel_id).join(", ")}`;
          return next;
        });
        if (!result.ok) {
          serial(() => repository.addDiagnostic(sessionId, result.errors.map((e) => `${e.path}: ${e.message}`).join("; "), payload, receivedAt));
          return;
        }
        const record = normalizeRecord(result.record, { source: "simulated", session_id: sessionId, received_at: receivedAt });
        serial(async () => { await ensureCapture(record.capture_id); active.queue!.enqueue(record); });
        setValues(() => {
          const v = emptyValues();
          for (const s of result.record.samples) v[s.channel_id] = { value: s.raw_value, status: s.status };
          return v;
        });
      },
      onEvent: (event: SourceEvent) => {
        const receivedAt = nowIso();
        setStats((s) => ({ ...s, lastEvent: event.type }));
        if (event.type === "disconnected") {
          setValues((v) => { const m = { ...v }; for (const c of CHANNEL_CODES) m[c] = { ...m[c], status: "stale" }; return m; });
        }
        serial(() => repository.addEvent(sessionId, active.captureRowId ?? null, event, receivedAt));
      },
    });

    await source.connect();
    await source.startCapture();
    setRunning(true);
    await refreshHistory();
  }, [scenario, seed, refreshHistory]);

  const stop = useCallback(async () => {
    const active = activeRef.current;
    if (!active) return;
    await active.source.disconnect();
    const { repository } = await getDatabase();
    await repository.setSessionState(active.sessionId, "finalizing");
    await active.queue?.close();
    const durationMs = Math.round(monotonicMs() - active.startedMono);
    await repository.closeSession(active.sessionId, nowIso(), durationMs, "completed");
    setStats((s) => ({ ...s, committed: active.queue?.stats.committed ?? s.committed, pending: 0 }));
    activeRef.current = null;
    setRunning(false);
    await refreshHistory();
  }, [refreshHistory]);

  useEffect(() => () => { void activeRef.current?.source.disconnect(); }, []);

  return { running, values, stats, history, dbInfo, start, stop };
}
