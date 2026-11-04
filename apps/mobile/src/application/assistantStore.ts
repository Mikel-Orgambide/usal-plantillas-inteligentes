import { useSyncExternalStore } from "react";
import { CHANNEL_POSITIONS, configuredChannels, type ChannelCode } from "@plantillas/contract";
import { combineChannelMetrics, computeDistribution } from "@plantillas/metrics";
import {
  AssistantError,
  FIXED_ANSWERS,
  MAX_HISTORY_TURNS,
  buildAssistantContext,
  classifyQuestion,
  createAssistantClient,
  shortSessionLabel,
  type AssistantContextInput,
  type AssistantSessionInput,
  type ChatTurn,
} from "@plantillas/assistant";
import { getDatabase } from "../infrastructure/sqlite/database";
import { loadSettings, type Settings } from "../infrastructure/settings/settings";
import { getSupabase, remoteConfigured, supabaseAnonKey, supabaseUrl } from "../infrastructure/supabase/client";
import { ensureSessionMetrics } from "./sessionMetrics";
import { loadSessionDetail } from "./useSessions";
import { resolveLocalUserId, useAuth } from "./authStore";

/**
 * Asistente explicativo (ADR 0012). Arma el contexto desde SQLite (sesiones
 * del usuario activo, indicadores ya calculados), clasifica la pregunta y
 * consulta el asistente en el modo elegido en Ajustes: «nube» (función
 * gestionada del proyecto, con la cuenta iniciada; la clave del proveedor
 * vive en el backend) o «servidor propio» (LM Studio u otro compatible con
 * OpenAI, en la red local). Cada intercambio queda registrado localmente
 * (`assistant_exchange`) como evidencia; no se sincroniza. La conversación
 * vive en memoria y se vacía al cerrar la pantalla del chat.
 */

export interface ChatMessage {
  readonly id: number;
  readonly role: "user" | "assistant";
  readonly text: string;
  /** Respuesta del modelo (se muestra marcada «Generado por IA · revisar»); `false` en las respuestas fijas. */
  readonly generated?: boolean;
  readonly error?: boolean;
  readonly model?: string;
}

interface ChatState {
  readonly messages: readonly ChatMessage[];
  readonly busy: boolean;
}

let state: ChatState = { messages: [], busy: false };
const listeners = new Set<() => void>();
let nextId = 1;
function set(next: ChatState): void { state = next; for (const l of listeners) l(); }

export function useAssistantChat(): ChatState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

export function clearAssistantChat(): void { set({ messages: [], busy: false }); }

const RECENT = 8;

async function sessionInput(id: string, detailed: boolean): Promise<AssistantSessionInput | null> {
  if (detailed) {
    const d = await loadSessionDetail(id, 40);
    if (!d) return null;
    const windows = d.metrics.map((m) => m.metrics);
    const metrics = windows.length ? combineChannelMetrics(windows) : undefined;
    const bil = d.bilateral;
    return {
      id: d.session.id, started_at: d.session.started_at, ended_at: d.session.ended_at, duration_ms: d.session.duration_ms,
      activity: d.session.activity, context: d.session.context, source: d.session.source, state: d.session.state,
      modules: d.modules.map((m) => ({ device_id: m.device_id, configuration_id: m.configuration_id, foot: m.foot, channels: channelsOf(m.configuration_id, d.metrics.find((x) => x.capture.device_id === m.device_id)?.metrics) })),
      quality: d.quality,
      ...(metrics ? { metrics, distribution: computeDistribution(metrics) } : {}),
      bilateral: bil && bil.metrics ? { offset_ms: bil.offset_ms, complete_fraction: bil.complete_fraction, left_share: bil.distribution?.left_share ?? null, right_share: bil.distribution?.right_share ?? null, ...(bil.distribution ? { asymmetry: bil.distribution.asymmetry } : {}) } : null,
      events: d.events.map((e) => ({ type: e.type, received_at: e.received_at, detail: e.detail })),
    };
  }
  const { repository } = await getDatabase();
  const session = await repository.getSession(id);
  if (!session) return null;
  const captures = await repository.getCaptures(id);
  const modules: AssistantSessionInput["modules"][number][] = [];
  let records = 0, expected = 0, readErrors = 0;
  for (const c of captures) {
    const q = await repository.getCaptureQuality(c.id);
    records += q.records; expected += q.max_sequence === null ? 0 : q.max_sequence + 1; readErrors += q.read_errors;
    if (modules.some((m) => m.device_id === c.device_id)) continue;
    const configuration = await repository.getConfiguration(c.configuration_id);
    const channels = configuration ? configuredChannels(configuration) : [];
    const feet = new Set(channels.map((ch) => CHANNEL_POSITIONS[ch].foot));
    modules.push({ device_id: c.device_id, configuration_id: c.configuration_id, foot: feet.size === 1 ? [...feet][0]! : null, channels });
  }
  const events = await repository.getEvents(id);
  const closed = session.state === "completed" || session.state === "incomplete";
  const windows = closed ? (await ensureSessionMetrics(id)).map((m) => m.metrics) : [];
  const metrics = windows.length ? combineChannelMetrics(windows) : undefined;
  return {
    id: session.id, started_at: session.started_at, ended_at: session.ended_at, duration_ms: session.duration_ms,
    activity: session.activity, context: session.context, source: session.source, state: session.state, modules,
    quality: { records, expected, readErrors, gaps: events.filter((e) => e.type === "sequence_gap").length, captures: captures.length },
    ...(metrics ? { metrics, distribution: computeDistribution(metrics) } : {}),
    events: events.map((e) => ({ type: e.type, received_at: e.received_at, detail: e.detail })),
  };
}

function channelsOf(_configurationId: string, metrics: Readonly<Partial<Record<ChannelCode, { unavailable_reason?: string }>>> | undefined): ChannelCode[] {
  if (!metrics) return [];
  return (Object.keys(metrics) as ChannelCode[]).filter((c) => metrics[c]?.unavailable_reason !== "no instrumentado");
}

/** Contexto completo para una pregunta: sesiones recientes del usuario activo y, si hay, la seleccionada en detalle. */
export async function buildContext(selectedSessionId?: string): Promise<{ text: string; summary: string }> {
  const { repository } = await getDatabase();
  const userId = await resolveLocalUserId();
  const all = (await repository.listSessions()).filter((s) => s.user_id === userId);
  const closed = all.filter((s) => s.state === "completed" || s.state === "incomplete");
  const ids = closed.slice(0, RECENT).map((s) => s.id);
  if (selectedSessionId && !ids.includes(selectedSessionId)) ids.unshift(selectedSessionId);
  const sessions: AssistantSessionInput[] = [];
  for (const id of ids) {
    const s = await sessionInput(id, id === selectedSessionId);
    if (s) sessions.push(s);
  }
  const alias = aliasOf(userId);
  const input: AssistantContextInput = { user: alias ? { alias } : {}, sessions, ...(selectedSessionId ? { selectedSessionId } : {}), maxSessions: RECENT };
  // El total declarado al modelo es el de todas las sesiones del usuario, aunque sólo se describan las recientes.
  const text = buildAssistantContext({ ...input, sessions }).replace(`Sesiones registradas: ${sessions.length}.`, `Sesiones registradas: ${all.length}.`);
  const summary = `${all.length} sesión(es); ${sessions.length} descritas${selectedSessionId ? `; seleccionada ${selectedSessionId.slice(0, 8)}` : ""}`;
  return { text, summary };
}

/** Seudónimo: nunca el correo. Primeros 8 caracteres del id remoto, o «usuario local». */
function aliasOf(id: string): string | undefined {
  return id === "local" ? undefined : `usuario ${id.slice(0, 8)}`;
}

export interface AskOptions { readonly selectedSessionId?: string }

export class AssistantUnavailable extends Error {
  override readonly name = "AssistantUnavailable";
}

/** Cliente según el modo. En «nube» requiere la cuenta iniciada (el token va en cada pedido). */
async function clientFor(settings: Settings, timeoutMs: number) {
  if (settings.assistantMode === "local") {
    return createAssistantClient({ baseUrl: settings.assistantUrl, ...(settings.assistantModel.trim() ? { model: settings.assistantModel.trim() } : {}), timeoutMs });
  }
  if (!remoteConfigured || !supabaseUrl || !supabaseAnonKey) throw new AssistantUnavailable("Este paquete no tiene configurado el complemento remoto; el asistente en la nube no está disponible.");
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AssistantUnavailable("Para usar el asistente iniciá sesión con tu cuenta (Ajustes → Cuenta).");
  return createAssistantClient({ transport: "proxy", supabaseUrl, anonKey: supabaseAnonKey, accessToken: token, timeoutMs });
}

/** Dirección que queda en el registro local: la del servidor propio o la función gestionada. */
function serverLabel(settings: Settings): string {
  return settings.assistantMode === "local" ? settings.assistantUrl : `${supabaseUrl ?? "supabase"}/functions/v1/assistant`;
}

/** Envía una pregunta: respuesta fija si está fuera de alcance; si no, consulta al servidor. Siempre deja registro. */
export async function askAssistant(question: string, options: AskOptions = {}): Promise<void> {
  const q = question.trim();
  if (!q || state.busy) return;
  const settings = loadSettings();
  const askedAt = new Date().toISOString();
  const userMsg: ChatMessage = { id: nextId++, role: "user", text: q };
  set({ messages: [...state.messages, userMsg], busy: true });
  // Los últimos turnos de esta conversación (sin la pregunta nueva ni los errores).
  const history: ChatTurn[] = state.messages.filter((m) => !m.error).slice(-(MAX_HISTORY_TURNS + 1), -1).map((m) => ({ role: m.role, content: m.text }));
  const scope = classifyQuestion(q);
  const { repository } = await getDatabase();
  const userId = await resolveLocalUserId();

  if (scope !== "in_scope") {
    const text = FIXED_ANSWERS[scope];
    set({ messages: [...state.messages, { id: nextId++, role: "assistant", text, generated: false }], busy: false });
    await repository.addAssistantExchange({ user_id: userId, session_id: options.selectedSessionId ?? null, asked_at: askedAt, question: q, scope, context_chars: 0, context_summary: "respuesta fija, sin consultar al modelo", server_url: null, model: null, answer: text, error: null, elapsed_ms: 0, mode: settings.assistantMode }).catch(() => undefined);
    return;
  }

  let contextText = "", contextSummary = "";
  try {
    const ctx = await buildContext(options.selectedSessionId);
    contextText = ctx.text; contextSummary = ctx.summary;
    const client = await clientFor(settings, 60_000);
    const out = await client.ask(q, contextText, history);
    set({ messages: [...state.messages, { id: nextId++, role: "assistant", text: out.answer, generated: true, model: out.model }], busy: false });
    await repository.addAssistantExchange({ user_id: userId, session_id: options.selectedSessionId ?? null, asked_at: askedAt, question: q, scope, context_chars: contextText.length, context_summary: contextSummary, server_url: serverLabel(settings), model: out.model, answer: out.answer, error: null, elapsed_ms: out.elapsed_ms, mode: settings.assistantMode }).catch(() => undefined);
  } catch (e) {
    const text = describeError(e, settings);
    set({ messages: [...state.messages, { id: nextId++, role: "assistant", text, error: true }], busy: false });
    await repository.addAssistantExchange({ user_id: userId, session_id: options.selectedSessionId ?? null, asked_at: askedAt, question: q, scope, context_chars: contextText.length, context_summary: contextSummary || "no se pudo armar el contexto", server_url: serverLabel(settings), model: settings.assistantMode === "local" ? settings.assistantModel.trim() || null : null, answer: null, error: e instanceof Error ? e.message : String(e), elapsed_ms: Date.now() - Date.parse(askedAt), mode: settings.assistantMode }).catch(() => undefined);
  }
}

/** Reintenta la última pregunta que terminó en error: quita el error y la vuelve a enviar. */
export async function retryLastQuestion(options: AskOptions = {}): Promise<void> {
  if (state.busy) return;
  const msgs = [...state.messages];
  const last = msgs[msgs.length - 1];
  if (!last || !last.error) return;
  const question = [...msgs].reverse().find((m) => m.role === "user");
  if (!question) return;
  const idx = msgs.lastIndexOf(question);
  set({ messages: msgs.slice(0, idx), busy: false });
  await askAssistant(question.text, options);
}

/** Etiqueta corta de la sesión para la cabecera del chat («Sesión del 3/11 · 17:44»), en la hora del teléfono. */
export async function sessionChipLabel(sessionId: string): Promise<string | undefined> {
  const { repository } = await getDatabase();
  const s = await repository.getSession(sessionId);
  return s ? `Sesión del ${shortSessionLabel(s.started_at).replace(" ", " · ")}` : undefined;
}

function describeError(e: unknown, settings: Settings): string {
  if (e instanceof AssistantUnavailable) return e.message;
  const local = settings.assistantMode === "local";
  if (e instanceof AssistantError) {
    switch (e.code) {
      case "network": return local
        ? `No se pudo contactar al asistente en ${settings.assistantUrl}. Comprobá que LM Studio esté corriendo con el servidor activo y «Serve on Local Network», y que el teléfono esté en la misma red.`
        : "No se pudo contactar al asistente. Comprobá la conexión a internet y probá de nuevo.";
      case "timeout": return "El asistente no respondió a tiempo. Probá de nuevo en unos segundos.";
      case "no_model": return local
        ? "El servidor responde pero no tiene ningún modelo cargado. Cargalo en LM Studio (pestaña Developer)."
        : "El servicio del asistente no tiene un modelo configurado.";
      case "unauthorized": return "La cuenta no está autorizada para usar el asistente. Cerrá sesión y volvé a iniciarla.";
      case "rate_limited": return `Se alcanzó el límite de preguntas por hora. ${e.message.replace(/^respuesta: /, "")}`;
      case "http": return `${local ? "El servidor" : "El servicio"} respondió con un error (${e.status ?? "?"}). ${e.message}`;
      default: return `El asistente devolvió una respuesta que no se pudo leer. ${e.message}`;
    }
  }
  return `No se pudo preparar la pregunta: ${e instanceof Error ? e.message : String(e)}`;
}

/** Prueba de conexión desde Ajustes, en el modo indicado: devuelve los modelos disponibles. */
export async function testAssistant(settings: Settings): Promise<string[]> {
  const client = await clientFor(settings, 8_000);
  return client.listModels();
}

/** Texto corto del error de una prueba de conexión. */
export function describeAssistantError(e: unknown, settings: Settings): string {
  return describeError(e, settings);
}

export function useAssistantEnabled(): boolean {
  // La hoja de cuenta puede cambiar el usuario; el ajuste se relee al renderizar.
  useAuth();
  return loadSettings().assistantEnabled;
}
