import { useEffect, useMemo, useState } from "react";
import type { ChannelCode } from "@plantillas/contract";
import { approximateLoad, combineChannelMetrics, computeDistribution, type ChannelMetrics, type LoadDistribution } from "@plantillas/metrics";
import type { SessionSummary } from "@plantillas/storage";
import { getDatabase } from "../infrastructure/sqlite/database";
import { ensureSessionMetrics } from "./sessionMetrics";

/**
 * Resumen de un día (pantalla Hoy): sesiones cerradas del día, calidad de los
 * datos recibidos, distribución de la carga combinando las capturas del día
 * (ponderadas por lecturas válidas) y carga acumulada aproximada. Todo sale
 * de las métricas ya calculadas por sesión; la pantalla sólo dibuja.
 */

/** Clave de día en hora local: «2026-10-27». */
export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayKey(): string {
  return dayKeyOf(new Date().toISOString());
}

/** Días con sesiones, del más reciente al más antiguo, siempre incluyendo hoy. */
export function availableDays(sessions: readonly SessionSummary[]): string[] {
  const keys = new Set<string>([todayKey()]);
  for (const s of sessions) keys.add(dayKeyOf(s.started_at));
  return [...keys].sort().reverse();
}

export interface DaySummary {
  readonly day: string;
  readonly sessions: readonly SessionSummary[];
  /** Sesiones cerradas con capturas: las que aportan métricas. */
  readonly measured: number;
  readonly durationMs: number;
  readonly records: number;
  readonly expected: number;
  readonly readErrors: number;
  readonly gaps: number;
  readonly physical: number;
  readonly simulated: number;
  /** Registros recibidos sobre esperados (0–1), o null sin registros. */
  readonly quality: number | null;
  readonly channels: Readonly<Record<ChannelCode, ChannelMetrics>> | null;
  readonly distribution: LoadDistribution | null;
  /** Carga acumulada aproximada del día, en cuentas·segundo. */
  readonly load: number | null;
}

export async function loadDaySummary(day: string, sessions: readonly SessionSummary[]): Promise<DaySummary> {
  const ofDay = sessions.filter((s) => dayKeyOf(s.started_at) === day);
  const closed = ofDay.filter((s) => (s.state === "completed" || s.state === "incomplete") && s.capture_count > 0);
  const { repository } = await getDatabase();
  const windows: Readonly<Record<ChannelCode, ChannelMetrics>>[] = [];
  let records = 0, expected = 0, readErrors = 0, load = 0, anyLoad = false;
  for (const s of closed) {
    const captures = await repository.getCaptures(s.id);
    let sessionRecords = 0;
    for (const c of captures) {
      const q = await repository.getCaptureQuality(c.id);
      sessionRecords += q.records;
      expected += q.max_sequence === null ? 0 : q.max_sequence + 1;
      readErrors += q.read_errors;
    }
    records += sessionRecords;
    // Período aproximado de la sesión: duración sobre registros (50 ms en la placa, 40 ms en el simulador).
    const period = s.duration_ms && sessionRecords > 0 ? Math.min(1, Math.max(0.01, s.duration_ms / sessionRecords / 1000)) : 0.05;
    for (const w of await ensureSessionMetrics(s.id)) {
      windows.push(w.metrics);
      const l = approximateLoad(w.metrics, period);
      if (l !== null) { load += l; anyLoad = true; }
    }
  }
  const channels = windows.length > 0 ? combineChannelMetrics(windows) : null;
  return {
    day, sessions: ofDay, measured: closed.length,
    durationMs: ofDay.reduce((n, s) => n + (s.duration_ms ?? 0), 0),
    records, expected, readErrors, gaps: ofDay.reduce((n, s) => n + s.gap_count, 0),
    physical: ofDay.filter((s) => s.source === "physical").length, simulated: ofDay.filter((s) => s.source === "simulated").length,
    quality: expected > 0 ? Math.min(1, records / expected) : null,
    channels, distribution: channels ? computeDistribution(channels) : null,
    load: anyLoad ? load : null,
  };
}

export function useDaySummary(day: string, sessions: readonly SessionSummary[] | null): { summary: DaySummary | undefined; error: string | undefined } {
  const [summary, setSummary] = useState<DaySummary | undefined>();
  const [error, setError] = useState<string | undefined>();
  const ids = useMemo(() => (sessions ?? []).map((s) => `${s.id}:${s.state}:${s.record_count}`).join(","), [sessions]);
  useEffect(() => {
    if (!sessions) return;
    let alive = true;
    loadDaySummary(day, sessions)
      .then((d) => { if (alive) { setSummary(d); setError(undefined); } })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, ids]);
  return { summary, error };
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «Hoy», «Ayer» o «lunes 27 oct». */
export function dayLabel(day: string): string {
  const today = todayKey();
  if (day === today) return "Hoy";
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (day === dayKeyOf(y.toISOString())) return "Ayer";
  const [yy, mm, dd] = day.split("-").map(Number);
  const d = new Date(yy!, mm! - 1, dd!);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Texto descriptivo, no evaluativo, de la distribución del día. */
export function describeDistribution(d: LoadDistribution): string {
  if (d.left_share === null || d.forefoot_share === null) return `No disponible: ${d.unavailable_reason ?? "faltan lecturas válidas"}.`;
  const l = Math.round(d.left_share * 100);
  const f = Math.round(d.forefoot_share * 100);
  const zones: Array<[string, number | null]> = [["talón", d.asymmetry.heel], ["medial", d.asymmetry.medial], ["lateral", d.asymmetry.lateral]];
  const biggest = zones.filter((z): z is [string, number] => z[1] !== null).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const side = biggest ? (biggest[1] > 0 ? "izquierdo" : "derecho") : "";
  const diff = biggest ? Math.round(Math.abs(biggest[1]) * 100) : 0;
  return `La lectura se reparte ${l}/${100 - l} entre pie izquierdo y derecho, y ${f}/${100 - f} entre antepié y talón.${biggest && diff >= 1 ? ` La diferencia mayor entre pies está en ${biggest[0]} (${diff} % más en el ${side}).` : ""}`;
}
