import { describe, expect, it } from "vitest";
import { AssistantError, createAssistantClient } from "../src/index";

type FakeFetch = typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createAssistantClient · transporte direct (servidor compatible con OpenAI, LM Studio)", () => {
  it("envía sistema + contexto + historial + pregunta y devuelve la respuesta sin el razonamiento", async () => {
    const calls: { url: string; body: any }[] = [];
    const fakeFetch: FakeFetch = async (url, init) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ model: "qwen3-14b", choices: [{ message: { content: "<think>pienso</think>En la sesión del 3/11 el talón izquierdo llegó a 3812 cuentas." } }], usage: { prompt_tokens: 900, completion_tokens: 30 } });
    };
    const client = createAssistantClient({ baseUrl: "192.168.0.140:1234/", model: "qwen3-14b", fetch: fakeFetch });
    expect(client.transport).toBe("direct");
    const out = await client.ask("¿Cuál fue el máximo del talón?", "CONTEXTO…", [{ role: "user", content: "hola" }, { role: "assistant", content: "hola, ¿qué querés saber?" }]);
    expect(calls[0]!.url).toBe("http://192.168.0.140:1234/v1/chat/completions");
    const msgs = calls[0]!.body.messages;
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("CONTEXTO…");
    expect(msgs[0].content).toMatch(/No diagnosticás/);
    expect(msgs[0].content).toMatch(/FICHA DE CONOCIMIENTO/);
    expect(msgs.map((m: any) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(msgs[3].content).toBe("¿Cuál fue el máximo del talón?\n/no_think");
    expect(calls[0]!.body.model).toBe("qwen3-14b");
    expect(calls[0]!.body.stream).toBe(false);
    expect(out.answer).toBe("En la sesión del 3/11 el talón izquierdo llegó a 3812 cuentas.");
    expect(out.model).toBe("qwen3-14b");
    expect(out.prompt_tokens).toBe(900);
  });

  it("lista los modelos y falla con código cuando no hay ninguno", async () => {
    const withModels = createAssistantClient({ baseUrl: "http://h:1234", fetch: async () => jsonResponse({ data: [{ id: "a" }, { id: "b" }] }) });
    expect(await withModels.listModels()).toEqual(["a", "b"]);
    const empty = createAssistantClient({ baseUrl: "http://h:1234", fetch: async () => jsonResponse({ data: [] }) });
    await expect(empty.listModels()).rejects.toMatchObject({ name: "AssistantError", code: "no_model" });
  });

  it("distingue sin red, error HTTP, respuesta inválida y tiempo agotado", async () => {
    const network = createAssistantClient({ baseUrl: "http://h:1234", fetch: async () => { throw new TypeError("Network request failed"); } });
    await expect(network.ask("q", "c")).rejects.toMatchObject({ code: "network" });

    const http = createAssistantClient({ baseUrl: "http://h:1234", fetch: async () => new Response("model not loaded", { status: 503 }) });
    const err = await http.ask("q", "c").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AssistantError);
    expect((err as AssistantError).code).toBe("http");
    expect((err as AssistantError).status).toBe(503);
    expect((err as AssistantError).message).toContain("503");

    const invalid = createAssistantClient({ baseUrl: "http://h:1234", fetch: async () => jsonResponse({ choices: [] }) });
    await expect(invalid.ask("q", "c")).rejects.toMatchObject({ code: "invalid_response" });

    const slow = createAssistantClient({
      baseUrl: "http://h:1234", timeoutMs: 20,
      fetch: (_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))); }),
    });
    await expect(slow.ask("q", "c")).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("createAssistantClient · transporte proxy (función gestionada de Supabase)", () => {
  const options = { transport: "proxy" as const, supabaseUrl: "https://xyz.supabase.co/", anonKey: "pk_test", accessToken: "jwt-123" };

  it("manda pregunta, contexto e historial a /functions/v1/assistant con el token de la cuenta, sin prompt de sistema", async () => {
    const calls: { url: string; method: string; headers: Record<string, string>; body: any }[] = [];
    const fakeFetch: FakeFetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ answer: "<think>…</think>En la sesión del 3/11 el talón llegó a 3812 cuentas.", model: "qwen/qwen3-14b", elapsed_ms: 2100, prompt_tokens: 950, completion_tokens: 28 });
    };
    const client = createAssistantClient({ ...options, fetch: fakeFetch });
    expect(client.transport).toBe("proxy");
    const out = await client.ask("¿Cuál fue el máximo?", "CONTEXTO…", [{ role: "user", content: "hola" }]);
    expect(calls[0]!.url).toBe("https://xyz.supabase.co/functions/v1/assistant");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers.Authorization).toBe("Bearer jwt-123");
    expect(calls[0]!.headers.apikey).toBe("pk_test");
    expect(calls[0]!.body).toEqual({ question: "¿Cuál fue el máximo?\n/no_think", context: "CONTEXTO…", history: [{ role: "user", content: "hola" }] });
    expect(calls[0]!.body.messages).toBeUndefined();
    expect(out).toEqual({ answer: "En la sesión del 3/11 el talón llegó a 3812 cuentas.", model: "qwen/qwen3-14b", elapsed_ms: 2100, prompt_tokens: 950, completion_tokens: 28 });
  });

  it("la prueba de conexión devuelve el modelo configurado en el backend", async () => {
    const client = createAssistantClient({ ...options, fetch: async (_url, init) => (init?.method === "GET" ? jsonResponse({ model: "qwen/qwen3-14b", models: ["qwen/qwen3-14b"] }) : jsonResponse({})) });
    expect(await client.listModels()).toEqual(["qwen/qwen3-14b"]);
  });

  it("traduce 401 a cuenta no autorizada, 429 a límite por hora y errores del servicio con su mensaje", async () => {
    const unauthorized = createAssistantClient({ ...options, fetch: async () => jsonResponse({ error: { code: "unauthorized", message: "la sesión venció" } }, 401) });
    await expect(unauthorized.ask("q", "c")).rejects.toMatchObject({ code: "unauthorized", status: 401 });

    const limited = createAssistantClient({ ...options, fetch: async () => jsonResponse({ error: { code: "rate_limited", message: "se alcanzó el límite de 30 preguntas por hora" } }, 429) });
    const err = await limited.ask("q", "c").catch((e: unknown) => e as AssistantError);
    expect(err).toMatchObject({ code: "rate_limited", status: 429 });
    expect((err as AssistantError).message).toContain("30 preguntas por hora");

    const upstream = createAssistantClient({ ...options, fetch: async () => jsonResponse({ error: { code: "upstream", message: "el proveedor respondió 402 (insufficient credits)" } }, 502) });
    const e2 = await upstream.ask("q", "c").catch((e: unknown) => e as AssistantError);
    expect(e2).toMatchObject({ code: "http", status: 502 });
    expect((e2 as AssistantError).message).toContain("insufficient credits");

    const empty = createAssistantClient({ ...options, fetch: async () => jsonResponse({ answer: "" }) });
    await expect(empty.ask("q", "c")).rejects.toMatchObject({ code: "invalid_response" });
  });
});
