import { CHANNEL_CODES, CHANNEL_POSITIONS, configuredChannels, type AcquisitionConfiguration, type ChannelCode } from "@plantillas/contract";
import { computeBilateral, computeDistribution, describeValues, notInstrumented, type BilateralMetrics, type ChannelMetrics, type LoadDistribution } from "@plantillas/metrics";
import { bundleConfigurations, type SessionBundle } from "@plantillas/storage";

/**
 * Informe de sesión para revisión profesional (ADR 0010).
 *
 * Función pura: recibe el paquete de sesión (el mismo JSON del respaldo por
 * sesión, etapa 10) y devuelve un documento HTML autocontenido —estilos y
 * gráficos SVG inline— pensado para convertirse en PDF A4. Describe mediciones
 * y su calidad; no interpreta ni diagnostica: esa lectura corresponde al
 * profesional (cierre del 27/10/2026). Separa siempre origen de la señal
 * (`physical` / `simulated`) de transporte, y las posiciones no instrumentadas
 * se listan como «no disponible», nunca como cero.
 */

export interface ReportOptions {
  /** Alias con el que identificar a la persona; si falta se usa un seudónimo derivado del id de usuario. Nunca un correo. */
  readonly alias?: string;
  /** Transporte usado (lo sabe la app; el paquete no lo guarda). */
  readonly transport?: "BLE" | "USB" | "simulador";
  /** Versión de la app que genera el informe. */
  readonly appVersion?: string;
  /** Fecha de generación (ISO); por defecto `new Date()`. */
  readonly generatedAt?: string;
  /** Marca clara en SVG (data URI o markup inline). Si falta, la marca se dibuja con texto. */
  readonly logoSvg?: string;
  /** Sesiones compatibles (misma configuración y origen) para la sección 7. */
  readonly comparable?: readonly { id: string; started_at: string; activity: string }[];
}

export interface ReportInput {
  readonly bundle: SessionBundle;
  readonly options?: ReportOptions;
}

const INK = "#16181c";
const INK_SOFT = "#5a636e";
const LINE = "#d6dbe1";
const ACCENT = "#5b3fb8";
const ACCENT_SOFT = "#5b3fb81a";
const PAPER = "#ffffff";

const ZONE_LABEL: Record<string, string> = { heel: "talón", forefoot_medial: "antepié medial", forefoot_lateral: "antepié lateral" };
const FOOT_LABEL: Record<string, string> = { left: "izquierdo", right: "derecho" };
const ACTIVITY_LABEL: Record<string, string> = { caminata: "Caminata", running: "Running", fuerza: "Fuerza", otra: "Otra" };

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/d";
  return v.toLocaleString("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/d" : `${(v * 100).toFixed(1).replace(".", ",")} %`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtDuration(ms: number | null | undefined): string {
  if (!ms && ms !== 0) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}
function pseudonym(userId: string, alias?: string): string {
  if (alias && alias.trim()) return alias.trim();
  return userId === "local" ? "usuario local" : `usuario ${userId.replace(/-/g, "").slice(0, 8)}`;
}

/** Nombre de archivo sugerido para el PDF. */
export function reportFileName(bundle: SessionBundle): string {
  return `informe-${bundle.session.started_at.slice(0, 10)}-${bundle.session.id.slice(0, 8)}.pdf`;
}

interface Analysis {
  /** Configuraciones de la sesión: una por módulo (ADR 0011). */
  readonly configurations: readonly AcquisitionConfiguration[];
  /** Métricas bilaterales sobre tramos con ambos módulos; `null` con un solo módulo. */
  readonly bilateral: BilateralMetrics | null;
  readonly channels: ChannelCode[];
  readonly metrics: Readonly<Record<ChannelCode, ChannelMetrics>>;
  readonly distribution: LoadDistribution;
  readonly series: Readonly<Partial<Record<ChannelCode, { t: number[]; v: (number | null)[] }>>>;
  readonly quality: {
    received: number; valid: number; invalid: number; gaps: number; missing: number;
    disconnections: number; reconnections: number; restarts: number; rate: number | null; spanSeconds: number | null;
  };
}

function analyse(b: SessionBundle): Analysis {
  const configurations = bundleConfigurations(b);
  const channels = CHANNEL_CODES.filter((c) => configurations.some((cfg) => configuredChannels(cfg).includes(c)));
  const perChannel: Partial<Record<ChannelCode, { raw_value: number | null; status: "ok" | "read_error" }[]>> = {};
  const series: Partial<Record<ChannelCode, { t: number[]; v: (number | null)[] }>> = {};
  for (const c of channels) { perChannel[c] = []; series[c] = { t: [], v: [] }; }
  const records = [...b.records].sort((x, y) => x.capture_id === y.capture_id ? x.sequence - y.sequence : x.capture_id < y.capture_id ? -1 : 1);
  let invalid = 0;
  for (const r of records) {
    for (const s of r.samples) {
      const bucket = perChannel[s.channel_id as ChannelCode];
      if (!bucket) continue;
      bucket.push({ raw_value: s.raw_value, status: s.status });
      if (s.status !== "ok") invalid += 1;
      const ser = series[s.channel_id as ChannelCode]!;
      ser.t.push(s.time_us / 1e6);
      ser.v.push(s.status === "ok" ? s.raw_value : null);
    }
  }
  const metrics = Object.fromEntries(CHANNEL_CODES.map((c) => [c, perChannel[c] ? describeValues(perChannel[c]!) : notInstrumented()])) as Record<ChannelCode, ChannelMetrics>;
  // Saltos de secuencia dentro de cada captura.
  let gaps = 0, missing = 0;
  const byCapture = new Map<string, number[]>();
  for (const r of records) { const l = byCapture.get(r.capture_id) ?? []; l.push(r.sequence); byCapture.set(r.capture_id, l); }
  for (const seqs of byCapture.values()) for (let i = 1; i < seqs.length; i++) { const d = seqs[i]! - seqs[i - 1]!; if (d > 1) { gaps += 1; missing += d - 1; } }
  const count = (t: string) => b.events.filter((e) => e.type === t).length;
  // Duración observada de la señal: del primer al último time_us de cualquier canal.
  let tMin = Number.POSITIVE_INFINITY, tMax = Number.NEGATIVE_INFINITY;
  for (const c of channels) for (const t of series[c]!.t) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
  const spanSeconds = Number.isFinite(tMin) && tMax > tMin ? tMax - tMin : null;
  const rate = spanSeconds && records.length > 1 ? (records.length - 1) / spanSeconds / Math.max(1, configurations.length) : null;
  let bilateral: BilateralMetrics | null = null;
  if (configurations.length === 2) {
    const devByCapture = new Map(b.captures.map((c) => [c.external_capture_id, c.device_id]));
    bilateral = computeBilateral(records.map((r) => ({ device_id: devByCapture.get(r.capture_id) ?? "", received_at: r.received_at, samples: r.samples })));
  }
  return {
    configurations, bilateral,
    channels, metrics, distribution: computeDistribution(metrics), series,
    quality: {
      received: records.length, valid: records.length * channels.length - invalid, invalid, gaps, missing,
      disconnections: count("disconnected"), reconnections: count("reconnected"), restarts: count("capture_restarted"),
      rate, spanSeconds,
    },
  };
}

/** Submuestreo por tramos: conserva el máximo de cada tramo para que no desaparezcan los apoyos cortos. */
function downsample(t: number[], v: (number | null)[], maxPoints: number): { t: number[]; v: (number | null)[] } {
  if (t.length <= maxPoints) return { t, v };
  const step = Math.ceil(t.length / maxPoints);
  const ot: number[] = [], ov: (number | null)[] = [];
  for (let i = 0; i < t.length; i += step) {
    let best: number | null = null;
    for (let j = i; j < Math.min(i + step, t.length); j++) { const x = v[j]; if (x !== null && x !== undefined && (best === null || x > best)) best = x; }
    ot.push(t[i]!); ov.push(best);
  }
  return { t: ot, v: ov };
}

function seriesSvg(code: ChannelCode, s: { t: number[]; v: (number | null)[] }, spanSeconds: number | null): string {
  const W = 640, H = 150, L = 44, R = 8, T = 8, B = 24;
  const { t, v } = downsample(s.t, s.v, 600);
  const tmax = spanSeconds && spanSeconds > 0 ? spanSeconds : Math.max(1, t[t.length - 1] ?? 1);
  const x = (tt: number) => L + (tt / tmax) * (W - L - R);
  const y = (val: number) => T + (1 - val / 4095) * (H - T - B);
  let d = ""; let pen = false;
  for (let i = 0; i < t.length; i++) {
    const val = v[i];
    if (val === null || val === undefined) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${x(t[i]!).toFixed(1)},${y(val).toFixed(1)} `; pen = true;
  }
  const ticks = [0, 2048, 4095].map((val) => `<text x="${L - 6}" y="${(y(val) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${INK_SOFT}">${val}</text><line x1="${L}" x2="${W - R}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="${LINE}" stroke-width="0.6"/>`).join("");
  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${x(f * tmax).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${INK_SOFT}">${(f * tmax).toFixed(0)} s</text>`).join("");
  const pos = CHANNEL_POSITIONS[code];
  return `<figure><figcaption>${esc(code)} · pie ${FOOT_LABEL[pos.foot]}, ${ZONE_LABEL[pos.zone]} · cuentas ADC (0–4095) en función del tiempo de adquisición</figcaption>
<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Serie temporal ${esc(code)}">${ticks}${xt}<path d="${d.trim()}" fill="none" stroke="${ACCENT}" stroke-width="1.2" stroke-linejoin="round"/></svg></figure>`;
}

function barsSvg(channels: ChannelCode[], metrics: Readonly<Record<ChannelCode, ChannelMetrics>>): string {
  const W = 640, H = 120, L = 44, R = 8, T = 10, B = 28;
  const n = channels.length; const bw = (W - L - R) / n;
  const y = (val: number) => T + (1 - val / 4095) * (H - T - B);
  const bars = channels.map((c, i) => {
    const m = metrics[c].sample_mean ?? 0;
    const x0 = L + i * bw + bw * 0.2;
    return `<rect x="${x0.toFixed(1)}" y="${y(m).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${(H - B - y(m)).toFixed(1)}" fill="${ACCENT}" opacity="0.85"/><text x="${(x0 + bw * 0.3).toFixed(1)}" y="${(y(m) - 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="${INK}">${num(metrics[c].sample_mean)}</text><text x="${(x0 + bw * 0.3).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9" fill="${INK_SOFT}">${esc(c)}</text>`;
  }).join("");
  return `<figure><figcaption>Media por posición instrumentada (cuentas ADC)</figcaption><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Media por canal"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="${LINE}"/>${bars}</svg></figure>`;
}

function brandHtml(logoSvg?: string): string {
  if (logoSvg) return `<div class="brand">${logoSvg}</div>`;
  return `<div class="brand brand-text"><span class="dot"></span>NSL</div>`;
}

function css(): string {
  return `
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Manrope, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${INK}; background: ${PAPER}; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  header { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1.5px solid ${INK}; padding-bottom: 6pt; margin-bottom: 14pt; }
  header .title { font-size: 13pt; font-weight: 600; }
  header .sub { color: ${INK_SOFT}; font-size: 9pt; }
  .brand svg { height: 22pt; width: auto; display: block; }
  .brand-text { font-weight: 800; font-size: 20pt; letter-spacing: -0.04em; display: flex; align-items: baseline; }
  .brand-text .dot { display: inline-block; width: 0.26em; height: 0.26em; border-radius: 50%; background: ${ACCENT}; margin-right: 0.12em; }
  h2 { font-size: 11.5pt; margin: 14pt 0 6pt; padding-left: 8pt; border-left: 3px solid ${ACCENT}; }
  table { border-collapse: collapse; width: 100%; margin: 4pt 0 6pt; font-size: 9.5pt; }
  th, td { text-align: left; padding: 3pt 6pt; border-bottom: 1px solid ${LINE}; vertical-align: top; }
  th { color: ${INK_SOFT}; font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .kv td:first-child { color: ${INK_SOFT}; width: 34%; }
  .tag { display: inline-block; padding: 1pt 6pt; border-radius: 999px; background: ${ACCENT_SOFT}; color: ${ACCENT}; font-size: 9pt; font-weight: 600; }
  .muted { color: ${INK_SOFT}; }
  .nd { color: ${INK_SOFT}; font-style: italic; }
  figure { margin: 6pt 0 10pt; break-inside: avoid; }
  figcaption { font-size: 9pt; color: ${INK_SOFT}; margin-bottom: 2pt; }
  .note { background: #f5f6f8; border: 1px solid ${LINE}; border-radius: 6pt; padding: 8pt 10pt; font-size: 9.5pt; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8.5pt; color: ${INK_SOFT}; border-top: 1px solid ${LINE}; padding-top: 4pt; display: flex; justify-content: space-between; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
  `;
}

function page(title: string, bodyHtml: string, o: ReportOptions): string {
  const generated = fmtDate(o.generatedAt ?? new Date().toISOString());
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css()}</style></head><body>
<header><div><div class="title">${esc(title)}</div><div class="sub">Describe mediciones y su calidad; la interpretación corresponde al profesional. No constituye diagnóstico.</div></div>${brandHtml(o.logoSvg)}</header>
${bodyHtml}
<footer><span>NSL · Plantillas inteligentes · Proyecto Final de Ingeniería en Informática (USAL)${o.appVersion ? ` · app ${esc(o.appVersion)}` : ""}</span><span>generado el ${generated}</span></footer>
</body></html>`;
}

function sectionIdentification(b: SessionBundle, o: ReportOptions): string {
  const s = b.session;
  return `<h2>1. Identificación</h2><table class="kv">
<tr><td>Persona</td><td>${esc(pseudonym(s.user_id, o.alias))} <span class="muted">(seudónimo; el informe no incluye datos de contacto)</span></td></tr>
<tr><td>Sesión</td><td><code>${esc(s.id)}</code></td></tr>
<tr><td>Inicio / fin</td><td>${fmtDate(s.started_at)} → ${fmtDate(s.ended_at)}</td></tr>
<tr><td>Duración</td><td>${fmtDuration(s.duration_ms)} · estado: ${esc(s.state)}</td></tr>
<tr><td>Actividad</td><td>${esc(ACTIVITY_LABEL[s.activity] ?? s.activity)}</td></tr>
<tr><td>Contexto declarado</td><td>${s.context ? esc(s.context) : '<span class="nd">sin contexto</span>'}</td></tr>
</table>`;
}

function sectionMount(_b: SessionBundle, a: Analysis): string {
  const c = a.configurations[0]!;
  const rows = CHANNEL_CODES.map((code) => {
    const pos = CHANNEL_POSITIONS[code];
    const ch = a.configurations.flatMap((cfg) => cfg.channels).find((x) => x.code === code);
    return ch
      ? `<tr><td><code>${code}</code></td><td>${FOOT_LABEL[pos.foot]}</td><td>${ZONE_LABEL[pos.zone]}</td><td>${esc(ch.model)}</td><td>${esc(ch.installation_id)}</td><td>${esc(ch.unit)}</td></tr>`
      : `<tr class="nd"><td><code>${code}</code></td><td>${FOOT_LABEL[pos.foot]}</td><td>${ZONE_LABEL[pos.zone]}</td><td colspan="3">no disponible (posición no instrumentada en esta configuración)</td></tr>`;
  }).join("");
  const feet = new Set(a.channels.map((x) => CHANNEL_POSITIONS[x].foot));
  const configRows = a.configurations.map((cfg) => `<tr><td>${a.configurations.length > 1 ? `Módulo ${FOOT_LABEL[CHANNEL_POSITIONS[cfg.channels[0]!.code].foot]}` : "Configuración"}</td><td><code>${esc(cfg.configuration_id)}</code> · dispositivo <code>${esc(cfg.device_id)}</code> · ${esc(cfg.description ?? "—")}</td></tr>`).join("");
  return `<h2>2. Montaje y canales</h2><table class="kv">
${configRows}
<tr><td>Rango de valores</td><td>${num(c.raw_range.min)}–${num(c.raw_range.max)} cuentas · ${c.raw_range.resolution_bits} bits</td></tr>
<tr><td>Posiciones instrumentadas</td><td>${a.channels.length} de ${CHANNEL_CODES.length} · ${feet.size === 2 ? `ambos pies${a.configurations.length === 2 ? " (dos módulos autónomos, uno por pie)" : ""}` : `sólo pie ${[...feet].map((f) => FOOT_LABEL[f]).join(", ")}`}</td></tr>
</table>
<table><thead><tr><th>Código</th><th>Pie</th><th>Zona</th><th>Modelo anunciado</th><th>Unidad instalada</th><th>Unidad de medida</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">El modelo es la denominación comercial del sensor; no acredita fabricante ni rango de fuerza.</p>`;
}

function sectionSource(b: SessionBundle, o: ReportOptions): string {
  const physical = b.configuration.source === "physical";
  const transport = o.transport ?? (physical ? "BLE" : "simulador");
  return `<h2>3. Origen de la señal y transporte</h2>
<p><span class="tag">${physical ? "physical" : "simulated"}</span> ${physical
    ? "Señal adquirida de sensores FSR mediante el sistema embebido."
    : "Señal simulada generada por software; <strong>no acredita medición plantar</strong> y sirve sólo para probar el recorrido de datos."}</p>
<p>Transporte: ${esc(transport)}. El origen de la señal y el transporte son propiedades independientes: una placa real que transmite valores sintéticos sigue siendo señal simulada.</p>`;
}

function bilateralRows(bil: BilateralMetrics | null): string {
  if (!bil) return "";
  if (bil.offset_ms === null) return `<tr><td>Correspondencia entre módulos</td><td class="nd">${esc(bil.unavailable_reason ?? "n/d")}</td></tr>`;
  return `<tr><td>Correspondencia entre módulos</td><td>desfase estimado ${num(Math.abs(bil.offset_ms))} ms entre los relojes de ambos módulos, por instante de recepción (no se corrige) · ${pct(bil.complete_fraction)} del tiempo con ambos presentes${bil.complete_intervals.length > 1 ? ` en ${bil.complete_intervals.length} tramos` : ""}</td></tr>`;
}

function sectionQuality(a: Analysis): string {
  const q = a.quality;
  return `<h2>4. Calidad del registro</h2><table class="kv">
<tr><td>Registros recibidos</td><td>${num(q.received)}</td></tr>
<tr><td>Muestras válidas / con error</td><td>${num(q.valid)} / ${num(q.invalid)}</td></tr>
<tr><td>Saltos de secuencia</td><td>${num(q.gaps)}${q.missing ? ` (${num(q.missing)} registros faltantes)` : ""}</td></tr>
<tr><td>Desconexiones / reconexiones</td><td>${num(q.disconnections)} / ${num(q.reconnections)}${q.restarts ? ` · reinicios de captura: ${num(q.restarts)}` : ""}</td></tr>
${bilateralRows(a.bilateral)}
<tr><td>Tasa efectiva</td><td>${q.rate === null ? "n/d" : `${num(q.rate, 1)} registros/s`} sobre ${q.spanSeconds === null ? "n/d" : `${num(q.spanSeconds, 1)} s`} de señal</td></tr>
</table>
<p class="muted">Un salto de secuencia o una desconexión marca un intervalo sin datos; esos intervalos no deben leerse como ausencia de apoyo.</p>`;
}

function sectionIndicators(a: Analysis): string {
  const rows = CHANNEL_CODES.map((c) => {
    const m = a.metrics[c];
    if (!a.channels.includes(c)) return `<tr class="nd"><td><code>${c}</code></td><td colspan="4">no disponible</td></tr>`;
    return `<tr><td><code>${c}</code></td><td class="num">${num(m.sample_mean)}</td><td class="num">${num(m.sample_max)}</td><td class="num">${num(m.sample_sd_population)}</td><td class="num">${num(m.n_valid)}</td></tr>`;
  }).join("");
  const d = a.distribution;
  const bil = d.bilateral;
  return `<h2>5. Indicadores</h2>
<table><thead><tr><th>Posición</th><th class="num">Media</th><th class="num">Máximo</th><th class="num">Desvío (σ)</th><th class="num">n válidas</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">Valores en cuentas ADC (0–4095), algoritmo ${esc(a.metrics[a.channels[0] ?? "L_HEEL"].metric_version)}; la media es muestral, no ponderada por tiempo.</p>
<table class="kv">
<tr><td>Antepié / talón</td><td>${pct(d.forefoot_share)} / ${pct(d.rearfoot_share)} <span class="muted">(sobre las posiciones instrumentadas)</span></td></tr>
<tr><td>Izquierdo / derecho</td><td>${bil ? `${pct(d.left_share)} / ${pct(d.right_share)}` : '<span class="nd">n/d · requiere ambos pies</span>'}</td></tr>
<tr><td>Asimetría por zona</td><td>${bil ? `talón ${num(d.asymmetry.heel, 2)} · medial ${num(d.asymmetry.medial, 2)} · lateral ${num(d.asymmetry.lateral, 2)}` : '<span class="nd">n/d · requiere ambos pies</span>'}</td></tr>
<tr><td>Variabilidad (σ/media promedio)</td><td>${num(d.variability, 2)}</td></tr>
</table>${bilateralBlock(a.bilateral)}`;
}

/** Bloque bilateral (ADR 0011): sólo tramos con ambos módulos; declara desfase y fracción completa. */
function bilateralBlock(bil: BilateralMetrics | null): string {
  if (!bil) return "";
  const d = bil.distribution;
  if (!d || d.left_share === null) return `<p class="muted">Izquierda/derecha con dos módulos: <span class="nd">n/d</span> · ${esc(bil.unavailable_reason ?? d?.unavailable_reason ?? "sin tramo con ambos módulos presentes")}.</p>`;
  return `<table class="kv">
<tr><td>Izquierdo / derecho (tramos completos)</td><td>${pct(d.left_share)} / ${pct(d.right_share)} <span class="muted">· sobre ${pct(bil.complete_fraction)} de la sesión con ambos módulos presentes</span></td></tr>
<tr><td>Asimetría por zona (tramos completos)</td><td>talón ${num(d.asymmetry.heel, 2)} · medial ${num(d.asymmetry.medial, 2)} · lateral ${num(d.asymmetry.lateral, 2)}</td></tr>
<tr><td>Desfase estimado entre módulos</td><td>${num(Math.abs(bil.offset_ms ?? 0))} ms <span class="muted">· estimado por recepción, incluye latencia BLE y deriva; no es sincronización</span></td></tr>
</table>`;
}

function sectionCharts(a: Analysis): string {
  const series = a.channels.map((c) => seriesSvg(c, a.series[c]!, a.quality.spanSeconds)).join("");
  return `<h2>6. Gráficos</h2>${series}${a.channels.length ? barsSvg(a.channels, a.metrics) : ""}`;
}

function sectionComparability(b: SessionBundle, o: ReportOptions): string {
  const list = o.comparable && o.comparable.length
    ? `<ul>${o.comparable.map((s) => `<li>${fmtDate(s.started_at)} · ${esc(ACTIVITY_LABEL[s.activity] ?? s.activity)} · <code>${esc(s.id.slice(0, 8))}</code></li>`).join("")}</ul>`
    : `<p class="muted">No se indicaron otras sesiones compatibles al generar este informe.</p>`;
  return `<h2>7. Comparabilidad</h2>
<p>Esta sesión es comparable sólo con sesiones de la misma configuración (<code>${esc(bundleConfigurations(b).map((c) => c.configuration_id).join(" + "))}</code>) y el mismo origen de señal (${esc(b.configuration.source)}). Cambiar sensores, resistencias, ubicación o montaje crea otra configuración y rompe la comparabilidad.</p>${list}
<p>Las cuentas ADC no son newtons ni presión: no se dispone de calibración de fuerza, y la misma lectura en dos sensores de distinto modelo o ubicación no implica la misma carga.</p>`;
}

/** Entrenamiento asociado (ADR 0013): lo declarado por la persona que acompaña a esta sesión medida. */
function sectionTraining(b: SessionBundle): string {
  const t = b.training;
  if (!t) return "";
  const e = t.entry;
  const fmtEntry = (x: NonNullable<SessionBundle["training"]>["entries"][number]) => {
    const parts = [esc(x.item_name)];
    if (x.set_index !== null) parts.push(`serie ${x.set_index}`);
    if (x.kind === "strength" && (x.reps !== null || x.weight_kg !== null)) parts.push(`${x.reps ?? ""}${x.weight_kg !== null ? ` × ${x.weight_kg} kg` : ""}`.trim());
    if (x.duration_s !== null) parts.push(`${Math.round(x.duration_s / 60)} min`);
    if (x.distance_m !== null) parts.push(`${(x.distance_m / 1000).toFixed(1)} km`);
    if (x.rpe !== null) parts.push(`RPE ${x.rpe}`);
    return parts.join(" · ");
  };
  const rows = t.entries.map((x) => `<tr><td>${fmtEntry(x)}${e && x.id === e.id ? ' <span class="tag">esta sesión</span>' : ""}</td><td>${x.discomfort_note ? `<em>${esc(x.discomfort_note)}</em>` : '<span class="nd">—</span>'}</td><td>${x.notes ? esc(x.notes) : '<span class="nd">—</span>'}</td></tr>`).join("");
  return `<h2>7b. Entrenamiento asociado <span class="tag">declarado por el usuario</span></h2>
<table class="kv"><tr><td>Rutina</td><td>${t.routine_name ? esc(t.routine_name) : '<span class="nd">sin rutina</span>'}</td></tr>
<tr><td>Entrenamiento</td><td>${esc(t.workout.date)} · ${t.workout.state === "completed" ? "terminado" : t.workout.state === "in_progress" ? "en curso" : "planificado"}</td></tr>
<tr><td>Vinculada a</td><td>${e ? fmtEntry(e) : "el entrenamiento completo (sin serie)"}</td></tr></table>
<table><thead><tr><th>Serie declarada</th><th>Molestia (texto del usuario)</th><th>Notas</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="nd">sin series registradas</td></tr>'}</tbody></table>
<p class="muted">Repeticiones, pesos, duraciones y esfuerzo percibido son declarados por la persona y no se miden con los sensores; las notas de molestia se transcriben sin interpretación.</p>`;
}

function sectionLimits(): string {
  return `<h2>8. Limitaciones y lectura</h2><div class="note">
<p>Los valores son unidades digitales del conversor sin calibración de fuerza ni de presión. Los sensores resistivos presentan deriva bajo carga constante y su respuesta depende de la colocación y del soporte, por lo que cambios entre sesiones pueden deberse al montaje y no a la persona. Tres posiciones por pie no constituyen un mapa de presión ni una medida de la carga total del pie, y los intervalos sin datos no se interpretan como ausencia de apoyo.</p>
<p><strong>Este informe describe mediciones y su calidad; no constituye diagnóstico ni recomendación clínica.</strong> La interpretación, y cualquier decisión derivada, corresponde al profesional que lo revisa, junto con el resto de su evaluación.</p></div>`;
}

/** Informe de una sesión. */
export function buildSessionReportHtml(bundle: SessionBundle, options: ReportOptions = {}): string {
  const a = analyse(bundle);
  const body = [
    sectionIdentification(bundle, options), sectionMount(bundle, a), sectionSource(bundle, options),
    sectionQuality(a), sectionIndicators(a), sectionCharts(a), sectionComparability(bundle, options), sectionTraining(bundle), sectionLimits(),
  ].join("\n");
  return page("Informe de sesión para revisión profesional", body, options);
}

/** Informe de comparación entre dos sesiones compatibles (A y B), con diferencias por posición. */
export function buildComparisonReportHtml(aBundle: SessionBundle, bBundle: SessionBundle, options: ReportOptions = {}): string {
  const A = analyse(aBundle), B = analyse(bBundle);
  const cfgId = (b: SessionBundle) => bundleConfigurations(b).map((c) => c.configuration_id).join(" + ");
  const compatible = cfgId(aBundle) === cfgId(bBundle) && aBundle.configuration.source === bBundle.configuration.source;
  const common = A.channels.filter((c) => B.channels.includes(c));
  const col = (b: SessionBundle, an: Analysis, label: string) => `<div><p><span class="tag">${label}</span> ${fmtDate(b.session.started_at)} · ${esc(ACTIVITY_LABEL[b.session.activity] ?? b.session.activity)} · ${fmtDuration(b.session.duration_ms)} · <code>${esc(b.session.id.slice(0, 8))}</code></p>
<table class="kv"><tr><td>Configuración</td><td><code>${esc(cfgId(b))}</code> · ${esc(b.configuration.source)}</td></tr>
<tr><td>Registros / saltos</td><td>${num(an.quality.received)} / ${num(an.quality.gaps)}</td></tr>
<tr><td>Antepié / talón</td><td>${pct(an.distribution.forefoot_share)} / ${pct(an.distribution.rearfoot_share)}</td></tr>
<tr><td>Izq / der</td><td>${an.bilateral ? (an.bilateral.distribution?.left_share != null ? `${pct(an.bilateral.distribution.left_share)} / ${pct(an.bilateral.distribution.right_share)} <span class="muted">(tramos completos, ${pct(an.bilateral.complete_fraction)}; desfase ${num(Math.abs(an.bilateral.offset_ms ?? 0))} ms)</span>` : '<span class="nd">n/d · sin tramo con ambos módulos</span>') : an.distribution.bilateral ? `${pct(an.distribution.left_share)} / ${pct(an.distribution.right_share)}` : '<span class="nd">n/d · requiere ambos pies</span>'}</td></tr></table></div>`;
  const rows = CHANNEL_CODES.map((c) => {
    if (!common.includes(c)) return `<tr class="nd"><td><code>${c}</code></td><td colspan="5">no disponible en ambas sesiones</td></tr>`;
    const ma = A.metrics[c].sample_mean, mb = B.metrics[c].sample_mean;
    const diff = ma !== null && mb !== null ? mb - ma : null;
    const rel = ma && diff !== null ? diff / ma : null;
    return `<tr><td><code>${c}</code></td><td class="num">${num(ma)}</td><td class="num">${num(mb)}</td><td class="num">${diff === null ? "n/d" : (diff >= 0 ? "+" : "") + num(diff)}</td><td class="num">${rel === null ? "n/d" : (rel >= 0 ? "+" : "") + pct(rel)}</td><td class="num">${num(A.metrics[c].sample_max)} → ${num(B.metrics[c].sample_max)}</td></tr>`;
  }).join("");
  const body = `
<h2>1. Identificación</h2><p>Persona: ${esc(pseudonym(aBundle.session.user_id, options.alias))} <span class="muted">(seudónimo)</span>.</p>
<div class="cols">${col(aBundle, A, "A")}${col(bBundle, B, "B")}</div>
<h2>2. Comparabilidad</h2><p>${compatible ? "Las dos sesiones comparten configuración y origen de señal, por lo que sus valores son comparables en las posiciones instrumentadas en ambas." : "<strong>Las sesiones no son comparables</strong>: difieren en configuración u origen de señal. Las diferencias de la tabla no deben interpretarse."}</p>
<h2>3. Diferencias por posición (B − A)</h2>
<table><thead><tr><th>Posición</th><th class="num">Media A</th><th class="num">Media B</th><th class="num">Diferencia</th><th class="num">Relativa</th><th class="num">Máximo A → B</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">Cuentas ADC; una diferencia puede responder al montaje, a la colocación o a la actividad, no necesariamente a un cambio de la persona.</p>
<h2>4. Gráficos</h2><div class="cols">${common.map((c) => `<div>${seriesSvg(c, A.series[c]!, A.quality.spanSeconds)}</div><div>${seriesSvg(c, B.series[c]!, B.quality.spanSeconds)}</div>`).join("")}</div>
${sectionLimits().replace("8. ", "5. ")}`;
  return page("Informe de comparación para revisión profesional", body, options);
}
