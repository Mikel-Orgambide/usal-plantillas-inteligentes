import { CHANNEL_POSITIONS, type ChannelCode, type Foot } from "@plantillas/contract";
import type { ChannelMetrics, LoadDistribution } from "@plantillas/metrics";

/**
 * Contexto que se envía al modelo (ADR 0012): un texto compacto en español
 * con lo que la app ya calculó. Se arma localmente a partir de SQLite; el
 * modelo no recibe registros crudos ni datos de contacto, sólo un alias.
 * El presupuesto es de unos 2.500 tokens (~10.000 caracteres): las sesiones
 * más antiguas se recortan antes que la seleccionada.
 */

export interface AssistantModuleInput {
  readonly device_id: string;
  readonly configuration_id: string;
  readonly foot: Foot | null;
  readonly channels: readonly ChannelCode[];
}

export interface AssistantSessionInput {
  readonly id: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly duration_ms: number | null;
  readonly activity: string;
  readonly context: string | null;
  readonly source: "simulated" | "physical";
  readonly state: string;
  readonly modules: readonly AssistantModuleInput[];
  readonly quality?: { readonly records: number; readonly expected: number; readonly readErrors: number; readonly gaps: number; readonly captures: number };
  /** Métricas por posición combinadas de la sesión (`desc-1.0`); ausentes si la sesión no cerró. */
  readonly metrics?: Readonly<Partial<Record<ChannelCode, ChannelMetrics>>>;
  readonly distribution?: LoadDistribution | null;
  readonly bilateral?: { readonly offset_ms: number | null; readonly complete_fraction: number; readonly left_share: number | null; readonly right_share: number | null; readonly asymmetry?: Readonly<Record<string, number | null>> } | null;
  /** Eventos relevantes (desconexiones, reinicios, pérdida de módulo), en orden. */
  readonly events?: readonly { readonly type: string; readonly received_at: string; readonly detail?: string | null }[];
}

export interface AssistantComparisonInput {
  readonly a: string;
  readonly b: string;
  readonly comparable: boolean;
  readonly reason?: string;
  readonly differences?: readonly { readonly channel: ChannelCode; readonly mean_a: number | null; readonly mean_b: number | null; readonly delta: number | null }[];
}

export interface AssistantContextInput {
  readonly user: { readonly alias?: string };
  readonly sessions: readonly AssistantSessionInput[];
  readonly selectedSessionId?: string;
  readonly comparison?: AssistantComparisonInput;
  /** Sesiones recientes incluidas además de la seleccionada (por defecto 8). */
  readonly maxSessions?: number;
  /** Límite de caracteres del contexto (por defecto 10.000). */
  readonly maxChars?: number;
  readonly now?: string;
}

const ACTIVITY: Record<string, string> = { caminata: "caminata", running: "running", fuerza: "fuerza", otra: "otra" };
const POSITION: Record<ChannelCode, string> = {
  L_HEEL: "talón izq", L_MEDIAL: "antepié medial izq", L_LATERAL: "antepié lateral izq", R_HEEL: "talón der", R_MEDIAL: "antepié medial der", R_LATERAL: "antepié lateral der",
};
const EVENT: Record<string, string> = {
  sequence_gap: "hueco de secuencia", disconnected: "desconexión", reconnected: "reconexión", connection_lost: "conexión perdida",
  capture_restart: "reinicio de captura", module_lost: "módulo perdido", module_recovered: "módulo recuperado", interrupted: "sesión interrumpida",
};
const CHANNEL_ORDER: ChannelCode[] = ["L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDuration(ms: number | null): string {
  if (ms === null) return "sin cerrar";
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}
const num = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? "n/d" : String(Math.round(v)));
const pct = (v: number | null | undefined): string => (v === null || v === undefined ? "n/d" : `${Math.round(v * 100)} %`);
const footOf = (m: AssistantModuleInput): string => (m.foot === "left" ? "pie izquierdo" : m.foot === "right" ? "pie derecho" : "ambos pies");

function describeSession(s: AssistantSessionInput, detailed: boolean): string {
  const lines: string[] = [];
  const src = s.source === "physical" ? "señal real de sensores FSR" : "SEÑAL SIMULADA (no es una medición)";
  lines.push(`Sesión ${s.id.slice(0, 8)} · ${fmtDate(s.started_at)} · ${ACTIVITY[s.activity] ?? s.activity} · ${fmtDuration(s.duration_ms)} · ${src} · estado ${s.state}${s.context ? ` · contexto: ${s.context}` : ""}`);
  const mods = s.modules.map((m) => `${footOf(m)} (${m.configuration_id}, ${m.channels.map((c) => POSITION[c]).join(", ")})`);
  const all = new Set(s.modules.flatMap((m) => m.channels));
  const missing = CHANNEL_ORDER.filter((c) => !all.has(c)).map((c) => POSITION[c]);
  lines.push(`  Módulos: ${mods.join(" + ") || "sin módulos"}${missing.length ? ` · no disponible: ${missing.join(", ")}` : ""}`);
  if (s.quality) {
    const q = s.quality;
    lines.push(`  Calidad: ${q.records} registros${q.expected ? ` de ${q.expected} esperados` : ""}, ${q.gaps} huecos, ${q.readErrors} lecturas con error, ${q.captures} captura(s)`);
  }
  if (s.metrics) {
    const parts = CHANNEL_ORDER.filter((c) => s.metrics![c] && s.metrics![c]!.unavailable_reason !== "no instrumentado").map((c) => {
      const m = s.metrics![c]!;
      return m.n_valid > 0 ? `${POSITION[c]}: media ${num(m.sample_mean)}, máx ${num(m.sample_max)}` : `${POSITION[c]}: sin lecturas válidas`;
    });
    if (parts.length) lines.push(`  Indicadores (cuentas ADC 0–4095): ${parts.join("; ")}`);
  }
  if (s.distribution) {
    const d = s.distribution;
    const bits = [`antepié ${pct(d.forefoot_share)} / talón ${pct(d.rearfoot_share)}`];
    bits.push(d.bilateral ? `izquierda ${pct(d.left_share)} / derecha ${pct(d.right_share)}` : "izquierda/derecha n/d (requiere ambos pies)");
    if (d.variability !== null) bits.push(`variabilidad ${d.variability.toFixed(2)}`);
    lines.push(`  Reparto: ${bits.join(" · ")}`);
  }
  if (s.bilateral) {
    const b = s.bilateral;
    const asym = b.asymmetry ? Object.entries(b.asymmetry).filter(([, v]) => v !== null).map(([k, v]) => `${k} ${(v as number).toFixed(2)}`).join(", ") : "";
    lines.push(`  Bilateral: desfase estimado ${b.offset_ms === null ? "n/d" : `${Math.round(b.offset_ms)} ms`}, tramo con ambos módulos ${pct(b.complete_fraction)}, izquierda ${pct(b.left_share)} / derecha ${pct(b.right_share)}${asym ? ` · asimetría (izq−der)/(izq+der): ${asym}` : ""}`);
  }
  if (detailed && s.events && s.events.length) {
    const counts = new Map<string, number>();
    for (const e of s.events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    const relevant = [...counts.entries()].filter(([t]) => EVENT[t]).map(([t, n]) => `${EVENT[t]}${n > 1 ? ` ×${n}` : ""}`);
    if (relevant.length) lines.push(`  Eventos: ${relevant.join(", ")}`);
  }
  return lines.join("\n");
}

export function buildAssistantContext(input: AssistantContextInput): string {
  const maxSessions = input.maxSessions ?? 8;
  const maxChars = input.maxChars ?? 10_000;
  const sorted = [...input.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const selected = input.selectedSessionId ? sorted.find((s) => s.id === input.selectedSessionId) : undefined;
  const recent = sorted.filter((s) => s.id !== selected?.id).slice(0, maxSessions);

  const head: string[] = [];
  head.push(`CONTEXTO (datos de la app NSL · generado ${fmtDate(input.now ?? new Date().toISOString())})`);
  head.push(`Persona: ${input.user.alias ?? "usuario de la app"}. Sesiones registradas: ${input.sessions.length}.`);
  head.push("Unidades: cuentas ADC (0–4095) de la señal cruda; sin calibración de fuerza. Posiciones por pie: talón (FSR406), antepié medial y lateral (FSR402).");

  const blocks: string[] = [];
  if (selected) blocks.push(`SESIÓN SELECCIONADA (la que el usuario está mirando)\n${describeSession(selected, true)}`);
  if (input.comparison) {
    const c = input.comparison;
    const diffs = (c.differences ?? []).map((d) => `${POSITION[d.channel]}: ${num(d.mean_a)} → ${num(d.mean_b)} (${d.delta === null ? "n/d" : (d.delta >= 0 ? "+" : "") + Math.round(d.delta)})`).join("; ");
    blocks.push(`COMPARACIÓN entre ${c.a.slice(0, 8)} (A) y ${c.b.slice(0, 8)} (B): ${c.comparable ? "comparables" : `no comparables${c.reason ? ` (${c.reason})` : ""}`}${diffs ? `. Diferencias de media por posición: ${diffs}` : ""}`);
  }
  const recentBlocks = recent.map((s) => describeSession(s, false));

  let out = `${head.join("\n")}\n\n${blocks.join("\n\n")}`;
  if (recentBlocks.length) out += `\n\nSESIONES RECIENTES (más nueva primero)`;
  let included = 0;
  for (const b of recentBlocks) {
    if (out.length + b.length + 2 > maxChars) break;
    out += `\n${b}`;
    included += 1;
  }
  if (included < recentBlocks.length) out += `\n(… ${recentBlocks.length - included} sesión(es) anterior(es) omitida(s) por espacio)`;
  if (!selected && recentBlocks.length === 0) out += "\n\nNo hay sesiones registradas todavía.";
  return out;
}

/** Posición → etiqueta en español, para la app. */
export const POSITION_LABEL: Readonly<Record<ChannelCode, string>> = POSITION;
export { CHANNEL_POSITIONS };
