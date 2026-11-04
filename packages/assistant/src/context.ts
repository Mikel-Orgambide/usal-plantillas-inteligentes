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

/** Resumen de entrenamiento (ADR 0013) para el contexto: lo declarado por la persona, ya resumido por la app. */
export interface AssistantTrainingInput {
  readonly active_routine?: { readonly name: string; readonly origin: "own" | "professional"; readonly goal: string | null; readonly items: readonly string[] };
  /** Entrenamiento de hoy, si hay (en curso o terminado). */
  readonly today?: AssistantWorkoutInput;
  /** Último entrenamiento terminado anterior a hoy. */
  readonly last?: AssistantWorkoutInput;
}
export interface AssistantWorkoutInput {
  readonly date: string;
  readonly state: "planned" | "in_progress" | "completed";
  readonly routine_name: string | null;
  /** Entradas ya descritas («Sentadilla · serie 2 · 10 × 40 kg · RPE 7»). */
  readonly entries: readonly string[];
  readonly summary: { readonly strength_sets: number; readonly volume_kg: number; readonly walk_run_duration_s: number; readonly rpe_mean: number | null; readonly with_discomfort_note: number };
  /** Sesiones de plantillas vinculadas, por etiqueta corta («3/11 17:44 → Sentadilla serie 3»). */
  readonly linked_sessions: readonly string[];
}

export interface AssistantContextInput {
  readonly user: { readonly alias?: string };
  readonly sessions: readonly AssistantSessionInput[];
  readonly training?: AssistantTrainingInput;
  readonly selectedSessionId?: string;
  readonly comparison?: AssistantComparisonInput;
  /** Sesiones recientes incluidas además de la seleccionada (por defecto 8). */
  readonly maxSessions?: number;
  /** Límite de caracteres del contexto (por defecto 10.000). */
  readonly maxChars?: number;
  readonly now?: string;
  /**
   * Zona horaria IANA para fechas y horas (p. ej. «America/Argentina/Buenos_Aires»).
   * Por defecto, la del dispositivo. Las horas guardadas están en UTC (ISO 8601):
   * mostrarlas sin convertir confundía al modelo y a la persona.
   */
  readonly timeZone?: string;
  /** Agrega una comparación precalculada entre la sesión principal y la anterior comparable (por defecto `true`). */
  readonly autoCompare?: boolean;
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

/** Zona del dispositivo, o `undefined` si el motor no expone Intl. */
export function deviceTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}

interface Parts { day: string; month: string; year: string; hour: string; minute: string }

function partsOf(iso: string, timeZone: string | undefined): Parts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  if (timeZone) {
    try {
      const f = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      const out: Record<string, string> = {};
      for (const part of f.formatToParts(d)) out[part.type] = part.value;
      if (out.day && out.month && out.year && out.hour && out.minute) return { day: out.day, month: out.month, year: out.year, hour: out.hour === "24" ? "00" : out.hour, minute: out.minute };
    } catch { /* zona desconocida: hora local del motor */ }
  }
  return { day: p(d.getDate()), month: p(d.getMonth() + 1), year: String(d.getFullYear()), hour: p(d.getHours()), minute: p(d.getMinutes()) };
}

function fmtDate(iso: string, timeZone: string | undefined): string {
  const x = partsOf(iso, timeZone);
  return x ? `${x.day}/${x.month}/${x.year} ${x.hour}:${x.minute}` : iso;
}

/** «3/11 17:44»: forma corta con la que el modelo debe citar la sesión. */
export function shortSessionLabel(iso: string, timeZone: string | undefined = deviceTimeZone()): string {
  const x = partsOf(iso, timeZone);
  return x ? `${Number(x.day)}/${Number(x.month)} ${x.hour}:${x.minute}` : iso;
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "sin cerrar";
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}
const num = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? "n/d" : String(Math.round(v)));
const pct = (v: number | null | undefined): string => (v === null || v === undefined ? "n/d" : `${Math.round(v * 100)} %`);
const footOf = (m: AssistantModuleInput): string => (m.foot === "left" ? "pie izquierdo" : m.foot === "right" ? "pie derecho" : "ambos pies");

function describeSession(s: AssistantSessionInput, detailed: boolean, tz: string | undefined): string {
  const lines: string[] = [];
  const src = s.source === "physical" ? "señal real de sensores FSR" : "SEÑAL SIMULADA (no es una medición)";
  lines.push(`Sesión ${s.id.slice(0, 8)} · ${fmtDate(s.started_at, tz)} (citala como «${shortSessionLabel(s.started_at, tz)}») · ${ACTIVITY[s.activity] ?? s.activity} · ${fmtDuration(s.duration_ms)} · ${src} · estado ${s.state}${s.context ? ` · contexto: ${s.context}` : ""}`);
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
      if (m.n_valid === 0) return `${POSITION[c]}: sin lecturas válidas`;
      if (m.sample_max === 0) return `${POSITION[c]}: 0 en toda la sesión (instrumentado, sin carga registrada; n ${m.n_valid})`;
      const sat = m.sample_max !== null && m.sample_max >= 4095 ? " (llegó al tope 4095)" : "";
      return `${POSITION[c]}: media ${num(m.sample_mean)}, máx ${num(m.sample_max)}${sat}, desvío ${num(m.sample_sd_population)}, n ${m.n_valid}`;
    });
    if (parts.length) lines.push(`  Indicadores (cuentas ADC 0–4095): ${parts.join("; ")}`);
  }
  if (s.distribution) {
    const d = s.distribution;
    const bits = [d.forefoot_share === null && d.unavailable_reason ? `antepié/talón n/d (${d.unavailable_reason})` : `antepié ${pct(d.forefoot_share)} / talón ${pct(d.rearfoot_share)}`];
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

/** Clave de comparabilidad: mismo origen de señal y mismas configuraciones de módulos. */
function comparabilityKey(s: AssistantSessionInput): string {
  return `${s.source}|${s.modules.map((m) => m.configuration_id).sort().join("+")}`;
}

function hasMetrics(s: AssistantSessionInput): boolean {
  return !!s.metrics && CHANNEL_ORDER.some((c) => (s.metrics![c]?.n_valid ?? 0) > 0);
}

const signed = (v: number, digits = 0): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

/**
 * Comparación precalculada entre la sesión principal (B) y la anterior
 * comparable (A): diferencias de media y máximo por posición (absolutas y
 * porcentuales), cambio del reparto en puntos porcentuales y diferencias de
 * condiciones. El modelo no calcula: lee estas cifras. Si la sesión anterior
 * no es comparable, se dice por qué.
 */
export function describeAutoComparison(sorted: readonly AssistantSessionInput[], target: AssistantSessionInput, tz: string | undefined): string | null {
  if (!hasMetrics(target)) return null;
  const older = sorted.filter((s) => s.id !== target.id && s.started_at < target.started_at && hasMetrics(s));
  if (older.length === 0) return null;
  const key = comparabilityKey(target);
  const prev = older.find((s) => comparabilityKey(s) === key);
  const immediate = older[0]!;
  const lines: string[] = [];
  const label = (s: AssistantSessionInput) => `${s.id.slice(0, 8)} del ${shortSessionLabel(s.started_at, tz)}`;
  if (!prev) {
    const why = immediate.source !== target.source ? "origen de señal distinto (real vs simulada)" : `configuración distinta (${immediate.modules.map((m) => m.configuration_id).join("+")} vs ${target.modules.map((m) => m.configuration_id).join("+")})`;
    return `COMPARACIÓN: la sesión anterior (${label(immediate)}) NO es comparable con ${label(target)}: ${why}. No hay otra sesión anterior comparable.`;
  }
  const config = target.modules.map((m) => m.configuration_id).join(" + ");
  lines.push(`COMPARACIÓN PRECALCULADA: B = ${label(target)} frente a A = ${label(prev)} (anterior comparable: misma configuración ${config}, ${target.source === "physical" ? "señal real" : "señal simulada"})`);
  if (prev.id !== immediate.id) lines.push(`  (la inmediatamente anterior, ${label(immediate)}, no es comparable y se omitió)`);
  for (const c of CHANNEL_ORDER) {
    const a = prev.metrics?.[c], b = target.metrics?.[c];
    if (!a || !b || a.n_valid === 0 || b.n_valid === 0 || a.sample_mean === null || b.sample_mean === null) continue;
    const d = b.sample_mean - a.sample_mean;
    const rel = a.sample_mean > 0 ? ` (${signed((d / a.sample_mean) * 100)} %)` : "";
    const max = a.sample_max !== null && b.sample_max !== null ? `; máx ${num(a.sample_max)} → ${num(b.sample_max)}` : "";
    lines.push(`  ${POSITION[c]}: media ${num(a.sample_mean)} → ${num(b.sample_mean)}, ${signed(d)}${rel}${max}`);
  }
  const da = prev.distribution, db = target.distribution;
  if (da && db && da.forefoot_share !== null && db.forefoot_share !== null) {
    lines.push(`  Reparto antepié/talón: ${pct(da.forefoot_share)}/${pct(da.rearfoot_share)} → ${pct(db.forefoot_share)}/${pct(db.rearfoot_share)} (antepié ${signed((db.forefoot_share - da.forefoot_share) * 100)} puntos porcentuales)`);
  }
  if (da && db && da.left_share !== null && db.left_share !== null) {
    lines.push(`  Reparto izquierda/derecha: ${pct(da.left_share)}/${pct(da.right_share)} → ${pct(db.left_share)}/${pct(db.right_share)} (izquierda ${signed((db.left_share - da.left_share) * 100)} pp)`);
  }
  const cond: string[] = [];
  cond.push(prev.activity === target.activity ? `misma actividad (${ACTIVITY[target.activity] ?? target.activity})` : `actividad distinta (${prev.activity} vs ${target.activity})`);
  cond.push(`duración ${fmtDuration(prev.duration_ms)} vs ${fmtDuration(target.duration_ms)}`);
  if ((prev.context ?? "") !== (target.context ?? "")) cond.push(`contexto declarado distinto («${prev.context ?? "sin contexto"}» vs «${target.context ?? "sin contexto"}»)`);
  lines.push(`  Condiciones: ${cond.join("; ")}.`);
  return lines.join("\n");
}

export function buildAssistantContext(input: AssistantContextInput): string {
  const maxSessions = input.maxSessions ?? 8;
  const maxChars = input.maxChars ?? 10_000;
  const tz = input.timeZone ?? deviceTimeZone();
  // Más nueva primero, por instante de inicio (ISO 8601 en UTC: el orden de texto es el temporal).
  const sorted = [...input.sessions].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const selected = input.selectedSessionId ? sorted.find((s) => s.id === input.selectedSessionId) : undefined;
  const recent = sorted.filter((s) => s.id !== selected?.id).slice(0, maxSessions);

  const head: string[] = [];
  head.push(`CONTEXTO (datos de la app NSL · generado ${fmtDate(input.now ?? new Date().toISOString(), tz)})`);
  head.push(`Fechas y horas en la hora local del teléfono${tz ? ` (${tz})` : ""}.`);
  head.push(`Persona: ${input.user.alias ?? "usuario de la app"}. Sesiones registradas: ${input.sessions.length}.`);
  head.push("Unidades: cuentas ADC (0–4095) de la señal cruda; sin calibración de fuerza. Posiciones por pie: talón (FSR406), antepié medial y lateral (FSR402).");

  const blocks: string[] = [];
  if (selected) blocks.push(`SESIÓN SELECCIONADA (la que el usuario está mirando)\n${describeSession(selected, true, tz)}`);
  if (input.comparison) {
    const c = input.comparison;
    const diffs = (c.differences ?? []).map((d) => `${POSITION[d.channel]}: ${num(d.mean_a)} → ${num(d.mean_b)} (${d.delta === null ? "n/d" : (d.delta >= 0 ? "+" : "") + Math.round(d.delta)})`).join("; ");
    blocks.push(`COMPARACIÓN entre ${c.a.slice(0, 8)} (A) y ${c.b.slice(0, 8)} (B): ${c.comparable ? "comparables" : `no comparables${c.reason ? ` (${c.reason})` : ""}`}${diffs ? `. Diferencias de media por posición: ${diffs}` : ""}`);
  } else if (input.autoCompare !== false) {
    const target = selected ?? sorted.find(hasMetrics);
    const auto = target ? describeAutoComparison(sorted, target, tz) : null;
    if (auto) blocks.push(auto);
  }
  if (input.training) {
    const t = describeTraining(input.training);
    if (t) blocks.push(t);
  }
  const recentBlocks = recent.map((s) => describeSession(s, false, tz));

  let out = `${head.join("\n")}${blocks.length ? `\n\n${blocks.join("\n\n")}` : ""}`;
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

function describeWorkout(label: string, w: AssistantWorkoutInput): string {
  const st = w.state === "in_progress" ? "en curso" : w.state === "completed" ? "terminado" : "planificado";
  const lines = [`${label}: ${w.date}${w.routine_name ? ` · rutina «${w.routine_name}»` : ""} · ${st}.`];
  if (w.entries.length) lines.push(`Series declaradas: ${w.entries.join("; ")}.`);
  const s = w.summary;
  lines.push(`Totales declarados: ${s.strength_sets} series de fuerza, volumen ${s.volume_kg} kg·rep, caminata/carrera ${Math.round(s.walk_run_duration_s / 60)} min${s.rpe_mean !== null ? `, RPE medio ${s.rpe_mean}` : ""}${s.with_discomfort_note ? `, ${s.with_discomfort_note} nota(s) de molestia (texto de la persona, no interpretar)` : ""}.`);
  if (w.linked_sessions.length) lines.push(`Sesiones de plantillas vinculadas: ${w.linked_sessions.join("; ")}.`);
  return lines.join("\n");
}

/** Bloque ENTRENAMIENTO: rutina activa, entrenamiento de hoy y último terminado. Todo declarado por la persona. */
export function describeTraining(t: AssistantTrainingInput): string | null {
  const parts: string[] = [];
  if (t.active_routine) parts.push(`Rutina activa «${t.active_routine.name}» (${t.active_routine.origin === "professional" ? "indicada por un profesional" : "propia"}${t.active_routine.goal ? `, objetivo: ${t.active_routine.goal}` : ""}): ${t.active_routine.items.join("; ") || "sin ejercicios"}.`);
  if (t.today) parts.push(describeWorkout("Entrenamiento de hoy", t.today));
  if (t.last) parts.push(describeWorkout("Último entrenamiento", t.last));
  if (!parts.length) return null;
  return `ENTRENAMIENTO (declarado por la persona; la app no mide repeticiones, pesos ni esfuerzo)\n${parts.join("\n")}`;
}

/** Posición → etiqueta en español, para la app. */
export const POSITION_LABEL: Readonly<Record<ChannelCode, string>> = POSITION;
export { CHANNEL_POSITIONS };
