import { SYSTEM_PROMPT } from "./prompt";

/**
 * Cliente mínimo de un servidor compatible con la API de OpenAI
 * (`/v1/models`, `/v1/chat/completions`), como el de LM Studio (ADR 0012).
 * Sin streaming en esta versión; una petición por pregunta, con tiempo
 * máximo. `fetch` se inyecta para las pruebas.
 */

export type AssistantErrorCode = "network" | "timeout" | "http" | "invalid_response" | "no_model";

export class AssistantError extends Error {
  override readonly name = "AssistantError";
  constructor(readonly code: AssistantErrorCode, message: string, readonly status?: number) {
    super(message);
  }
}

export interface AssistantClientOptions {
  /** Base del servidor, p. ej. `http://192.168.0.140:1234`. */
  readonly baseUrl: string;
  /** Nombre del modelo cargado; si falta, el servidor usa el que tenga cargado. */
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Agrega `/no_think` a la pregunta (modo sin razonamiento de Qwen3). Por defecto `true`. */
  readonly disableThinking?: boolean;
  readonly fetch?: typeof fetch;
  readonly systemPrompt?: string;
}

export interface ChatTurn { readonly role: "user" | "assistant"; readonly content: string }

export interface AssistantAnswer {
  readonly answer: string;
  readonly model: string;
  readonly elapsed_ms: number;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
}

export interface AssistantClient {
  /** GET /v1/models: nombres de los modelos que ofrece el servidor. */
  listModels(): Promise<string[]>;
  /** Una pregunta con el contexto armado localmente y, opcionalmente, los turnos anteriores de esta conversación. */
  ask(question: string, context: string, history?: readonly ChatTurn[]): Promise<AssistantAnswer>;
}

interface ChatCompletion {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function normalizeBase(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "").replace(/\/v1$/, "");
}

/** Quita los bloques de razonamiento que algunos modelos (Qwen3) incluyen en la respuesta. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function createAssistantClient(options: AssistantClientOptions): AssistantClient {
  const base = normalizeBase(options.baseUrl);
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;

  async function request(path: string, init: RequestInit, step: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      if (controller.signal.aborted) throw new AssistantError("timeout", `${step}: el servidor no respondió en ${Math.round(timeoutMs / 1000)} s`);
      throw new AssistantError("network", `${step}: no se pudo contactar al asistente en ${base}`);
    }
    clearTimeout(timer);
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 200); } catch { /* sin cuerpo */ }
      throw new AssistantError("http", `${step}: el servidor respondió ${res.status}${detail ? ` (${detail})` : ""}`, res.status);
    }
    try {
      return await res.json();
    } catch {
      throw new AssistantError("invalid_response", `${step}: la respuesta del servidor no es JSON`);
    }
  }

  return {
    async listModels() {
      const data = (await request("/v1/models", { method: "GET" }, "modelos")) as { data?: { id?: string }[] } | null;
      const ids = (data?.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
      if (ids.length === 0) throw new AssistantError("no_model", "el servidor no tiene ningún modelo cargado");
      return ids;
    },
    async ask(question, context, history = []) {
      const started = Date.now();
      const messages = [
        { role: "system", content: `${options.systemPrompt ?? SYSTEM_PROMPT}\n\n${context}` },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        // Qwen3 razona antes de responder salvo que se le pida lo contrario; `/no_think` lo desactiva
        // (los demás modelos lo ignoran). Ahorra 5–15 s por respuesta y tokens de `max_tokens`.
        { role: "user", content: options.disableThinking === false ? question : `${question}\n/no_think` },
      ];
      const body: Record<string, unknown> = { messages, temperature: options.temperature ?? 0.2, max_tokens: options.maxTokens ?? 400, stream: false };
      if (options.model) body.model = options.model;
      const data = (await request("/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, "respuesta")) as ChatCompletion | null;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") throw new AssistantError("invalid_response", "respuesta: el servidor no devolvió texto");
      const answer: AssistantAnswer = { answer: stripThinking(content), model: data?.model ?? options.model ?? "desconocido", elapsed_ms: Date.now() - started };
      const usage = data?.usage;
      return usage ? { ...answer, ...(usage.prompt_tokens !== undefined ? { prompt_tokens: usage.prompt_tokens } : {}), ...(usage.completion_tokens !== undefined ? { completion_tokens: usage.completion_tokens } : {}) } : answer;
    },
  };
}

export const DEFAULT_ASSISTANT_URL = "http://192.168.0.140:1234";
