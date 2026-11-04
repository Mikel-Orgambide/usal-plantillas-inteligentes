import { describe, expect, it } from "vitest";
import { AssistantError, createAssistantClient } from "../src/index";

type FakeFetch = typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createAssistantClient", () => {
  it("envía sistema + contexto + historial + pregunta y devuelve la respuesta sin el razonamiento", async () => {
    const calls: { url: string; body: any }[] = [];
    const fakeFetch: FakeFetch = async (url, init) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ model: "qwen3-14b", choices: [{ message: { content: "<think>pienso</think>En la sesión del 3/11 el talón izquierdo llegó a 3812 cuentas." } }], usage: { prompt_tokens: 900, completion_tokens: 30 } });
    };
    const client = createAssistantClient({ baseUrl: "192.168.0.140:1234/", model: "qwen3-14b", fetch: fakeFetch });
    const out = await client.ask("¿Cuál fue el máximo del talón?", "CONTEXTO…", [{ role: "user", content: "hola" }, { role: "assistant", content: "hola, ¿qué querés saber?" }]);
    expect(calls[0]!.url).toBe("http://192.168.0.140:1234/v1/chat/completions");
    const msgs = calls[0]!.body.messages;
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("CONTEXTO…");
    expect(msgs[0].content).toMatch(/Nunca diagnosticás/);
    expect(msgs.map((m: any) => m.role)).toEqual(["system", "user", "assistant", "user"]);
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
