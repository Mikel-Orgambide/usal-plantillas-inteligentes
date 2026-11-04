import { SYSTEM_PROMPT } from "./prompt";

/**
 * Cliente del asistente (ADR 0012). Dos transportes con la misma interfaz:
 *
 * - `direct`: un servidor compatible con la API de OpenAI (`/v1/models`,
 *   `/v1/chat/completions`), como LM Studio en la PC del autor. El teléfono
 *   habla con él directamente; el modelo y los parámetros los fija la app.
 * - `proxy`: la función gestionada `assistant` de Supabase (`/functions/v1/assistant`).
 *   La clave del proveedor vive en el backend; el teléfono sólo manda la
 *   pregunta, el contexto y el historial con el token de la cuenta. Es el
 *   modo por defecto: cualquier usuario con cuenta lo usa sin configurar nada.
 *
 * Sin streaming en esta versión; una petición por pregunta, con tiempo
 * máximo. `fetch` se inyecta para las pruebas.
 */

export type AssistantErrorCode = "network" | "timeout" | "http" | "invalid_response" | "no_model" | "unauthorized" | "rate_limited";

export class AssistantError extends Error {
  override readonly name = "AssistantError";
  constructor(readonly code: AssistantErrorCode, message: string, readonly status?: number) {
    super(message);
  }
}

export type AssistantTransport = "direct" | "proxy";

interface CommonOptions {
  readonly timeoutMs?: number;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Agrega `/no_think` a la pregunta (modo sin razonamiento de Qwen3). Por defecto `true`. */
  readonly disableThinking?: boolean;
  readonly fetch?: typeof fetch;
  readonly systemPrompt?: string;
}

export interface DirectClientOptions extends CommonOptions {
  readonly transport?: "direct";
  /** Base del servidor, p. ej. `http://192.168.0.140:1234`. */
  readonly baseUrl: string;
  /** Nombre del modelo cargado; si falta, el servidor usa el que tenga cargado. */
  readonly model?: string;
}

export interface ProxyClientOptions extends CommonOptions {
  readonly transport: "proxy";
  /** URL del proyecto de Supabase, p. ej. `https://xxxx.supabase.co`. */
  readonly supabaseUrl: string;
  /** Clave publicable (cabecera `apikey`). */
  readonly anonKey: string;
  /** Token de acceso de la cuenta iniciada (cabecera `Authorization`). */
  readonly accessToken: string;
  /** Nombre de la función desplegada; por defecto `assistant`. */
  readonly functionName?: string;
}

export type AssistantClientOptions = DirectClientOptions | ProxyClientOptions;

export interface ChatTurn { readonly role: "user" | "assistant"; readonly content: string }

export interface AssistantAnswer {
  readonly answer: string;
  readonly model: string;
  readonly elapsed_ms: number;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
}

export interface AssistantClient {
  readonly transport: AssistantTransport;
  /** Modelos disponibles: los del servidor (`direct`) o el configurado en el backend (`proxy`). */
  listModels(): Promise<string[]>;
  /** Una pregunta con el contexto armado localmente y, opcionalmente, los turnos anteriores de esta conversación. */
  ask(question: string, context: string, history?: readonly ChatTurn[]): Promise<AssistantAnswer>;
}

interface ChatCompletion {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Respuesta de la función gestionada (`supabase/functions/assistant`). */
interface ProxyAnswer {
  answer?: string;
  model?: string;
  elapsed_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  error?: { code?: string; message?: string };
}

function normalizeBase(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "").replace(/\/v1$/, "");
}

/** Quita los bloques de razonamiento que algunos modelos (Qwen3) incluyen en la respuesta. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/** Qwen3 razona antes de responder salvo que se le pida lo contrario; `/no_think` lo desactiva (los demás modelos lo ignoran). */
export function withNoThink(question: string, disableThinking: boolean | undefined): string {
  return disableThinking === false ? question : `${question}\n/no_think`;
}

/**
 * Parámetros de generación compartidos por ambos transportes y por la función
 * gestionada (ajuste del 4/11/2026: algo más de libertad para la lectura
 * descriptiva y respuestas de hasta ~5 oraciones sin cortarse).
 */
export const GENERATION_DEFAULTS = { temperature: 0.4, max_tokens: 600 } as const;

/** Turnos anteriores de la conversación que se envían con cada pregunta. */
export const MAX_HISTORY_TURNS = 6;

function makeRequest(options: CommonOptions, describeTarget: string) {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  return async function request(url: string, init: RequestInit, step: string): Promise<{ status: number; body: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal: controller.signal });
    } catch {
      clearTimeout(timer);
      if (controller.signal.aborted) throw new AssistantError("timeout", `${step}: el asistente no respondió en ${Math.round(timeoutMs / 1000)} s`);
      throw new AssistantError("network", `${step}: no se pudo contactar al asistente en ${describeTarget}`);
    }
    clearTimeout(timer);
    let body: unknown = null;
    let text = "";
    try { text = await res.text(); } catch { /* sin cuerpo */ }
    if (text) {
      try { body = JSON.parse(text); } catch { body = null; }
    }
    if (!res.ok) {
      const detail = (body as ProxyAnswer | null)?.error?.message ?? text.slice(0, 200);
      if (res.status === 401 || res.status === 403) throw new AssistantError("unauthorized", `${step}: la cuenta no está autorizada${detail ? ` (${detail})` : ""}`, res.status);
      if (res.status === 429) throw new AssistantError("rate_limited", `${step}: ${detail || "se alcanzó el límite de preguntas por hora"}`, res.status);
      throw new AssistantError("http", `${step}: el servidor respondió ${res.status}${detail ? ` (${detail})` : ""}`, res.status);
    }
    if (body === null) throw new AssistantError("invalid_response", `${step}: la respuesta del servidor no es JSON`);
    return { status: res.status, body };
  };
}

function tokensOf(answer: AssistantAnswer, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): AssistantAnswer {
  if (!usage) return answer;
  return {
    ...answer,
    ...(usage.prompt_tokens !== undefined ? { prompt_tokens: usage.prompt_tokens } : {}),
    ...(usage.completion_tokens !== undefined ? { completion_tokens: usage.completion_tokens } : {}),
  };
}

function createDirectClient(options: DirectClientOptions): AssistantClient {
  const base = normalizeBase(options.baseUrl);
  const request = makeRequest(options, base);
  return {
    transport: "direct",
    async listModels() {
      const { body } = await request(`${base}/v1/models`, { method: "GET" }, "modelos");
      const data = body as { data?: { id?: string }[] } | null;
      const ids = (data?.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
      if (ids.length === 0) throw new AssistantError("no_model", "el servidor no tiene ningún modelo cargado");
      return ids;
    },
    async ask(question, context, history = []) {
      const started = Date.now();
      const messages = [
        { role: "system", content: `${options.systemPrompt ?? SYSTEM_PROMPT}\n\n${context}` },
        ...history.slice(-MAX_HISTORY_TURNS).map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: withNoThink(question, options.disableThinking) },
      ];
      const body: Record<string, unknown> = {
        messages,
        temperature: options.temperature ?? GENERATION_DEFAULTS.temperature,
        max_tokens: options.maxTokens ?? GENERATION_DEFAULTS.max_tokens,
        stream: false,
      };
      if (options.model) body.model = options.model;
      const res = await request(`${base}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, "respuesta");
      const data = res.body as ChatCompletion | null;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") throw new AssistantError("invalid_response", "respuesta: el servidor no devolvió texto");
      return tokensOf({ answer: stripThinking(content), model: data?.model ?? options.model ?? "desconocido", elapsed_ms: Date.now() - started }, data?.usage);
    },
  };
}

function createProxyClient(options: ProxyClientOptions): AssistantClient {
  const base = options.supabaseUrl.trim().replace(/\/+$/, "");
  const url = `${base}/functions/v1/${options.functionName ?? "assistant"}`;
  const request = makeRequest(options, "el servicio del asistente");
  const headers = {
    "Content-Type": "application/json",
    apikey: options.anonKey,
    Authorization: `Bearer ${options.accessToken}`,
  };
  return {
    transport: "proxy",
    async listModels() {
      const { body } = await request(url, { method: "GET", headers }, "modelos");
      const data = body as { model?: string; models?: string[] } | null;
      const ids = data?.models ?? (data?.model ? [data.model] : []);
      if (ids.length === 0) throw new AssistantError("no_model", "el servicio no tiene un modelo configurado");
      return ids;
    },
    async ask(question, context, history = []) {
      const started = Date.now();
      // El prompt de sistema y los parámetros los fija la función; el teléfono manda sólo los datos.
      const payload = {
        question: withNoThink(question, options.disableThinking),
        context,
        history: history.slice(-MAX_HISTORY_TURNS).map((t) => ({ role: t.role, content: t.content })),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      };
      const { body } = await request(url, { method: "POST", headers, body: JSON.stringify(payload) }, "respuesta");
      const data = body as ProxyAnswer | null;
      if (data?.error) throw new AssistantError("http", `respuesta: ${data.error.message ?? data.error.code ?? "error del servicio"}`);
      if (typeof data?.answer !== "string" || data.answer.trim() === "") throw new AssistantError("invalid_response", "respuesta: el servicio no devolvió texto");
      return tokensOf({ answer: stripThinking(data.answer), model: data.model ?? "desconocido", elapsed_ms: data.elapsed_ms ?? Date.now() - started }, data);
    },
  };
}

export function createAssistantClient(options: AssistantClientOptions): AssistantClient {
  return options.transport === "proxy" ? createProxyClient(options) : createDirectClient(options);
}

export const DEFAULT_ASSISTANT_URL = "http://192.168.0.140:1234";
