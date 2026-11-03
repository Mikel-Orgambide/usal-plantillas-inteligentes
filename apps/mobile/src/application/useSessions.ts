import { useCallback, useEffect, useState } from "react";
import type { ChannelCode } from "@plantillas/contract";
import type { CaptureRow, EventRow, SessionRow, SessionSummary } from "@plantillas/storage";
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

export interface SessionDetail {
  session: SessionRow;
  captures: CaptureRow[];
  events: EventRow[];
  quality: { records: number; expected: number; readErrors: number; gaps: number; captures: number };
  /** Series reducidas por canal de la primera captura (etapa 5). */
  series: Record<ChannelCode, Array<number | null>>;
  /** Métricas descriptivas por posición, una ventana por captura (etapa 6). */
  metrics: CaptureWithMetrics[];
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
  const first = captures[0];
  if (first) {
    // Sólo las posiciones instrumentadas por la configuración de la captura; las demás quedan vacías (no son ceros).
    const configuration = await repository.getConfiguration(first.configuration_id);
    const instrumented = configuration ? configuration.channels.map((ch) => ch.code) : CHANNELS;
    for (const c of CHANNELS) series[c] = instrumented.includes(c) ? await repository.getChannelSeries(first.id, c, buckets) : [];
  }
  const metrics = session.state === "completed" || session.state === "incomplete" ? await ensureSessionMetrics(id) : [];
  return { session, captures, events, quality: { records, expected, readErrors, gaps, captures: captures.length }, series, metrics };
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
