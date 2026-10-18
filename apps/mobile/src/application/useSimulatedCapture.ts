import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHANNEL_CODES,
  SIMULATED_CONFIGURATION,
  classifySequence,
  validateSourceRecord,
  type ChannelCode,
  type SourceEvent,
} from "@plantillas/contract";
import { SCENARIOS, SimulatedDataSource, type ScenarioName } from "@plantillas/simulator";

/**
 * Caso de uso provisional de la etapa 2: recorre fuente → validación →
 * clasificación de secuencia y expone el último estado para la pantalla.
 * Sin persistencia todavía (etapa 3) ni máquina de estados de sesión (etapa 4).
 */

export type ChannelValue = { value: number | null; status: "ok" | "read_error" | "stale" };

export interface CaptureStats {
  received: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  gaps: number;
  outOfOrder: number;
  lastSequence: number | undefined;
  captureId: string | undefined;
  lastEvent: string | undefined;
  lastError: string | undefined;
}

const emptyStats = (): CaptureStats => ({
  received: 0, accepted: 0, rejected: 0, duplicates: 0, gaps: 0, outOfOrder: 0,
  lastSequence: undefined, captureId: undefined, lastEvent: undefined, lastError: undefined,
});

const emptyValues = (): Record<ChannelCode, ChannelValue> =>
  Object.fromEntries(CHANNEL_CODES.map((c) => [c, { value: null, status: "stale" }])) as Record<ChannelCode, ChannelValue>;

export function useSimulatedCapture(scenario: ScenarioName, seed: number) {
  const sourceRef = useRef<SimulatedDataSource | null>(null);
  const [running, setRunning] = useState(false);
  const [values, setValues] = useState<Record<ChannelCode, ChannelValue>>(emptyValues);
  const [stats, setStats] = useState<CaptureStats>(emptyStats);

  const start = useCallback(async () => {
    if (sourceRef.current) return;
    const source = new SimulatedDataSource({ seed, scenario: SCENARIOS[scenario] });
    sourceRef.current = source;
    setValues(emptyValues());
    setStats(emptyStats());

    let lastSeq: number | undefined;
    let captureId: string | undefined;

    source.subscribe({
      onPayload: (payload) => {
        const result = validateSourceRecord(payload, SIMULATED_CONFIGURATION);
        setStats((s) => {
          const next = { ...s, received: s.received + 1 };
          if (!result.ok) {
            next.rejected += 1;
            next.lastError = result.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
            return next;
          }
          const rec = result.record;
          if (rec.capture_id !== captureId) {
            captureId = rec.capture_id;
            lastSeq = undefined;
          }
          const rel = classifySequence(lastSeq, rec.sequence);
          if (rel.kind === "duplicate") next.duplicates += 1;
          else if (rel.kind === "gap") next.gaps += 1;
          else if (rel.kind === "out_of_order") next.outOfOrder += 1;
          if (rel.kind !== "duplicate" && rel.kind !== "out_of_order") lastSeq = rec.sequence;
          next.accepted += 1;
          next.lastSequence = rec.sequence;
          next.captureId = captureId;
          return next;
        });
        if (result.ok) {
          setValues(() => {
            const v = emptyValues();
            for (const s of result.record.samples) v[s.channel_id] = { value: s.raw_value, status: s.status };
            return v;
          });
        }
      },
      onEvent: (event: SourceEvent) => {
        setStats((s) => ({ ...s, lastEvent: event.type }));
        if (event.type === "disconnected") {
          setValues((v) => {
            const marked = { ...v };
            for (const c of CHANNEL_CODES) marked[c] = { ...marked[c], status: "stale" };
            return marked;
          });
        }
      },
    });

    await source.connect();
    await source.startCapture();
    setRunning(true);
  }, [scenario, seed]);

  const stop = useCallback(async () => {
    const source = sourceRef.current;
    if (!source) return;
    await source.disconnect();
    sourceRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => { void sourceRef.current?.disconnect(); }, []);

  return { running, values, stats, start, stop };
}
