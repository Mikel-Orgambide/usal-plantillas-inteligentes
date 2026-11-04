import { useCallback, useEffect, useState } from "react";
import { CHANNEL_POSITIONS, type ChannelCode, type Foot } from "@plantillas/contract";
import { computeBilateral, type BilateralMetrics } from "@plantillas/metrics";
import { exportSessionBundle, type CaptureRow, type EventRow, type SessionRow, type SessionSummary } from "@plantillas/storage";
import { getDatabase } from "../infrastructure/sqlite/database";
import { ensureSessionMetrics, type CaptureWithMetrics } from "./sessionMetrics";
import { useAuth } from "./authStore";

/**
 * Lista de sesiones del historial, con recarga. Muestra sólo las del usuario
 * local activo (la cuenta con sesión iniciada, o `local` sin cuenta); las de
 * otras cuentas siguen en el teléfono y se cuentan aparte (etapa 11).
 */
export function useSessionList() {
  const { localUserId } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const reload = useCallback(async () => {
    try {
      const { repository } = await getDatabase();
      const all = await repository.listSessions();
      setSessions(all.filter((s) => s.user_id === localUserId));
      setHiddenCount(all.filter((s) => s.user_id !== localUserId).length);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [localUserId]);
  useEffect(() => { void reload(); }, [reload]);
  return { sessions, hiddenCount, error, reload };
}

/** Un módulo de la sesión: un dispositivo, su configuración y sus capturas (ADR 0011). */
export interface SessionModuleDetail {
  device_id: string;
  configuration_id: string;
  foot: Foot | null;
  captures: CaptureRow[];
  records: number;
  gaps: number;
  readErrors: number;
}

export interface SessionDetail {
  session: SessionRow;
  captures: CaptureRow[];
  events: EventRow[];
  quality: { records: number; expected: number; readErrors: number; gaps: number; captures: number };
  /** Series reducidas por canal, de la primera captura del módulo que instrumenta cada posición (etapa 5). */
  series: Record<ChannelCode, Array<number | null>>;
  /** Métricas descriptivas por posición, una ventana por captura (etapa 6). */
  metrics: CaptureWithMetrics[];
  /** Módulos (dispositivos) de la sesión, izquierdo primero. */
  modules: SessionModuleDetail[];
  /** Métricas bilaterales sobre tramos con ambos módulos; `null` con un solo módulo. */
  bilateral: BilateralMetrics | null;
}

const FOOT_ORDER: Record<string, number> = { left: 0, right: 1, both: 2 };

function footOfChannels(codes: readonly ChannelCode[]): Foot | null {
  const feet = new Set(codes.map((c) => CHANNEL_POSITIONS[c].foot));
  return feet.size === 1 ? [...feet][0]! : null;
}

const CHANNELS: ChannelCode[] = ["L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"];

export async function loadSessionDetail(id: string, buckets = 120): Promise<SessionDetail | null> {
  const { repository } = await getDatabase();
  const session = await repository.getSession(id);
  if (!session) return null;
  const captures = await repository.getCaptures(id);
  const events = await repository.getEvents(id);
  let records = 0, expected = 0, readErrors = 0;
  for (const c of captures) {
    const q = await repository.getCaptureQuality(c.id);
    records += q.records;
    expected += q.max_sequence === null ? 0 : q.max_sequence + 1;
    readErrors += q.read_errors;
  }
  const gaps = events.filter((e) => e.type === "sequence_gap").length;
  const series = Object.fromEntries(CHANNELS.map((c) => [c, [] as Array<number | null>])) as Record<ChannelCode, Array<number | null>>;

  // Módulos: las capturas agrupadas por dispositivo (una sesión bilateral tiene dos, ADR 0011).
  const modules: SessionModuleDetail[] = [];
  for (const c of captures) {
    let m = modules.find((x) => x.device_id === c.device_id);
    if (!m) {
      const configuration = await repository.getConfiguration(c.configuration_id);
      m = { device_id: c.device_id, configuration_id: c.configuration_id, foot: footOfChannels(configuration ? configuration.channels.map((ch) => ch.code) : CHANNELS), captures: [], records: 0, gaps: 0, readErrors: 0 };
      modules.push(m);
    }
    m.captures.push(c);
    const q = await repository.getCaptureQuality(c.id);
    m.records += q.records;
    m.readErrors += q.read_errors;
  }
  for (const e of events) {
    if (e.type !== "sequence_gap") continue;
    const cap = e.capture_id === null ? undefined : captures.find((c) => c.id === e.capture_id);
    const m = cap ? modules.find((x) => x.device_id === cap.device_id) : modules[0];
    if (m) m.gaps += 1;
  }
  modules.sort((a, b) => FOOT_ORDER[a.foot ?? "both"]! - FOOT_ORDER[b.foot ?? "both"]!);

  // Series: por cada posición, la primera captura del módulo que la instrumenta; las demás quedan vacías (no son ceros).
  for (const m of modules) {
    const first = m.captures[0];
    if (!first) continue;
    const configuration = await repository.getConfiguration(first.configuration_id);
    const instrumented = configuration ? configuration.channels.map((ch) => ch.code) : CHANNELS;
    for (const c of instrumented) if (series[c].length === 0) series[c] = await repository.getChannelSeries(first.id, c, buckets);
  }
  const closed = session.state === "completed" || session.state === "incomplete";
  const metrics = closed ? await ensureSessionMetrics(id) : [];
  let bilateral: BilateralMetrics | null = null;
  if (closed && modules.length === 2) {
    const { driver } = await getDatabase();
    const bundle = await exportSessionBundle(driver, id);
    if (bundle) {
      const devByCapture = new Map(bundle.captures.map((c) => [c.external_capture_id, c.device_id]));
      bilateral = computeBilateral(bundle.records.map((r) => ({ device_id: devByCapture.get(r.capture_id) ?? "", received_at: r.received_at, samples: r.samples })));
    }
  }
  return { session, captures, events, quality: { records, expected, readErrors, gaps, captures: captures.length }, series, metrics, modules, bilateral };
}

export function useSessionDetail(id: string | undefined) {
  const [detail, setDetail] = useState<SessionDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadSessionDetail(id)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [id]);
  return { detail, error };
}
