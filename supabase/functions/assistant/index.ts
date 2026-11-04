// Función gestionada del asistente explicativo (ADR 0012, modo «nube»).
//
// El teléfono manda la pregunta, el contexto armado localmente y el historial
// de la conversación con el token de su cuenta; esta función verifica la
// cuenta, aplica el prompt de sistema, limita tamaños y cantidad de preguntas
// por hora, y reenvía al proveedor compatible con OpenAI configurado en los
// secretos del proyecto. La clave del proveedor nunca sale del backend.
//
// Secretos (supabase secrets set …):
//   ASSISTANT_API_KEY   clave del proveedor (obligatoria)
//   ASSISTANT_BASE_URL  base de la API, por defecto https://openrouter.ai/api/v1
//   ASSISTANT_MODEL     modelo, por defecto qwen/qwen3-14b (el mismo que las pruebas locales)
//   ASSISTANT_HOURLY_LIMIT  preguntas por usuario y hora, por defecto 30
//   ASSISTANT_REFERER / ASSISTANT_TITLE  cabeceras opcionales de OpenRouter
//
// GET  → { model }                      (prueba de conexión desde Ajustes)
// POST { question, context, history?, temperature?, max_tokens? }
//      → { answer, model, elapsed_ms, prompt_tokens?, completion_tokens? }
// Errores: { error: { code, message } } con 400/401/413/429/502/504.
//
// Registro de uso en `assistant_usage` (migración 0004): fecha, usuario,
// modelo, longitudes y tiempo; nunca el texto de la pregunta ni del contexto.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const API_KEY = Deno.env.get("ASSISTANT_API_KEY") ?? "";
const BASE_URL = (Deno.env.get("ASSISTANT_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const MODEL = Deno.env.get("ASSISTANT_MODEL") ?? "qwen/qwen3-14b";
const HOURLY_LIMIT = Number(Deno.env.get("ASSISTANT_HOURLY_LIMIT") ?? "30");
const REFERER = Deno.env.get("ASSISTANT_REFERER") ?? "";
const TITLE = Deno.env.get("ASSISTANT_TITLE") ?? "NSL · Plantillas inteligentes";

const MAX_QUESTION_CHARS = 1_000;
const MAX_CONTEXT_CHARS = 12_000;
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 4_000;
const PROVIDER_TIMEOUT_MS = 55_000;

// Mismas instrucciones que `packages/assistant/src/prompt.ts`. Si cambia allí, cambia acá.
const SYSTEM_PROMPT = `Sos el asistente de NSL · Plantillas inteligentes, una app que registra señales de sensores de presión (FSR) bajo el pie y las organiza en sesiones.

Reglas:
1. Respondé sólo con lo que figura en el CONTEXTO. Si un dato no está, decí «no tengo ese dato en la app» y no lo inventes.
2. Explicás mediciones ya calculadas: sesiones, duración, calidad del registro, indicadores (media, máximo, reparto antepié/talón, izquierda/derecha, asimetría), eventos y comparaciones. No calculás números nuevos ni promediás por tu cuenta.
3. Las unidades son cuentas ADC (0–4095) de la señal cruda: no son newtons, kilos ni presión; no las conviertas. Un valor mayor significa más lectura del sensor, no más fuerza medida.
4. Nunca diagnosticás, no recomendás tratamientos ni ejercicios, no hablás de lesiones, fatiga ni rendimiento como conclusión. Si la pregunta va por ahí, decí que eso corresponde a un profesional y volvé a lo que sí podés explicar.
5. Citá siempre la sesión y la fecha de la que hablás (por ejemplo «en la sesión del 3/11 a las 17:44»). Si la señal es simulada, aclaralo: no es una medición real.
6. Las posiciones «no disponible» no son cero: no estaban instrumentadas en esa sesión. Los huecos o desconexiones no significan ausencia de apoyo.
7. Respondé en español rioplatense neutro (vos), breve: dos a cinco oraciones, sin listas largas ni encabezados. Sin emojis.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function fail(status: number, code: string, message: string): Response {
  return json(status, { error: { code, message } });
}

interface Turn { role: "user" | "assistant"; content: string }

interface Payload {
  question: string;
  context: string;
  history: Turn[];
  temperature: number;
  max_tokens: number;
}

function parsePayload(raw: unknown): Payload | Response {
  if (typeof raw !== "object" || raw === null) return fail(400, "bad_request", "el cuerpo debe ser un objeto JSON");
  const o = raw as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question.trim() : "";
  const context = typeof o.context === "string" ? o.context : "";
  if (!question) return fail(400, "bad_request", "falta la pregunta");
  if (question.length > MAX_QUESTION_CHARS) return fail(413, "question_too_long", `la pregunta supera ${MAX_QUESTION_CHARS} caracteres`);
  if (context.length > MAX_CONTEXT_CHARS) return fail(413, "context_too_long", `el contexto supera ${MAX_CONTEXT_CHARS} caracteres`);
  const history: Turn[] = [];
  if (Array.isArray(o.history)) {
    for (const t of o.history.slice(-MAX_HISTORY_TURNS)) {
      if (typeof t !== "object" || t === null) continue;
      const turn = t as Record<string, unknown>;
      if ((turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && turn.content.trim()) {
        history.push({ role: turn.role, content: turn.content.slice(0, MAX_HISTORY_CHARS) });
      }
    }
  }
  const temperature = typeof o.temperature === "number" && o.temperature >= 0 && o.temperature <= 1 ? o.temperature : 0.2;
  const max_tokens = typeof o.max_tokens === "number" && o.max_tokens > 0 && o.max_tokens <= 800 ? Math.floor(o.max_tokens) : 400;
  return { question, context, history, temperature, max_tokens };
}

/** Quita los bloques de razonamiento que algunos modelos (Qwen3) incluyen en la respuesta. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return fail(401, "unauthorized", "falta el token de la cuenta");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return fail(401, "unauthorized", "la cuenta no es válida o la sesión venció; iniciá sesión de nuevo");
  // Los usuarios anónimos de Supabase no tienen correo: se rechazan (el asistente es sólo para cuentas).
  if (data.user.is_anonymous) return fail(401, "unauthorized", "el asistente requiere una cuenta");
  return { userId: data.user.id };
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Cantidad de preguntas enviadas al proveedor por este usuario en la última hora. */
async function usedInLastHour(userId: string): Promise<number> {
  if (!SERVICE_ROLE_KEY) return 0;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin()
    .from("assistant_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("forwarded", true)
    .gte("asked_at", since);
  if (error) {
    console.warn("assistant_usage: no se pudo contar el uso", error.message);
    return 0;
  }
  return count ?? 0;
}

interface UsageRow {
  user_id: string;
  model: string;
  question_chars: number;
  context_chars: number;
  history_turns: number;
  forwarded: boolean;
  status: string;
  elapsed_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

async function recordUsage(row: UsageRow): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  const { error } = await admin().from("assistant_usage").insert({ ...row, asked_at: new Date().toISOString() });
  if (error) console.warn("assistant_usage: no se pudo registrar", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return fail(405, "method_not_allowed", "sólo GET y POST");

  const who = await authenticate(req);
  if (who instanceof Response) return who;

  if (!API_KEY) return fail(503, "not_configured", "el servicio no tiene configurada la clave del proveedor (ASSISTANT_API_KEY)");

  if (req.method === "GET") return json(200, { model: MODEL, models: [MODEL], provider: BASE_URL, hourly_limit: HOURLY_LIMIT });

  let raw: unknown;
  try { raw = await req.json(); } catch { return fail(400, "bad_request", "el cuerpo no es JSON"); }
  const payload = parsePayload(raw);
  if (payload instanceof Response) return payload;

  const used = await usedInLastHour(who.userId);
  const base: Omit<UsageRow, "status" | "elapsed_ms" | "prompt_tokens" | "completion_tokens" | "forwarded"> = {
    user_id: who.userId, model: MODEL, question_chars: payload.question.length, context_chars: payload.context.length, history_turns: payload.history.length,
  };
  if (used >= HOURLY_LIMIT) {
    await recordUsage({ ...base, forwarded: false, status: "rate_limited", elapsed_ms: null, prompt_tokens: null, completion_tokens: null });
    return fail(429, "rate_limited", `se alcanzó el límite de ${HOURLY_LIMIT} preguntas por hora; probá más tarde`);
  }

  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${payload.context}` },
    ...payload.history,
    { role: "user", content: payload.question },
  ];
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` };
  if (REFERER) headers["HTTP-Referer"] = REFERER;
  if (TITLE) headers["X-Title"] = TITLE;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, messages, temperature: payload.temperature, max_tokens: payload.max_tokens, stream: false }),
    });
  } catch {
    clearTimeout(timer);
    const timedOut = controller.signal.aborted;
    await recordUsage({ ...base, forwarded: true, status: timedOut ? "timeout" : "network", elapsed_ms: Date.now() - started, prompt_tokens: null, completion_tokens: null });
    return timedOut
      ? fail(504, "timeout", "el proveedor no respondió a tiempo")
      : fail(502, "upstream", "no se pudo contactar al proveedor");
  }
  clearTimeout(timer);

  const text = await res.text();
  if (!res.ok) {
    await recordUsage({ ...base, forwarded: true, status: `upstream_${res.status}`, elapsed_ms: Date.now() - started, prompt_tokens: null, completion_tokens: null });
    return fail(502, "upstream", `el proveedor respondió ${res.status}${text ? ` (${text.slice(0, 160)})` : ""}`);
  }
  let data: { model?: string; choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  try { data = JSON.parse(text); } catch {
    await recordUsage({ ...base, forwarded: true, status: "invalid_response", elapsed_ms: Date.now() - started, prompt_tokens: null, completion_tokens: null });
    return fail(502, "upstream", "la respuesta del proveedor no es JSON");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    await recordUsage({ ...base, forwarded: true, status: "empty", elapsed_ms: Date.now() - started, prompt_tokens: null, completion_tokens: null });
    return fail(502, "upstream", "el proveedor no devolvió texto");
  }
  const elapsed_ms = Date.now() - started;
  await recordUsage({
    ...base, forwarded: true, status: "ok", elapsed_ms,
    prompt_tokens: data.usage?.prompt_tokens ?? null, completion_tokens: data.usage?.completion_tokens ?? null,
  });
  return json(200, {
    answer: stripThinking(content),
    model: data.model ?? MODEL,
    elapsed_ms,
    ...(data.usage?.prompt_tokens !== undefined ? { prompt_tokens: data.usage.prompt_tokens } : {}),
    ...(data.usage?.completion_tokens !== undefined ? { completion_tokens: data.usage.completion_tokens } : {}),
  });
});
