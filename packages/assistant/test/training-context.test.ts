import { describe, expect, it } from "vitest";
import { buildAssistantContext, createAssistantClient, describeTraining, LOG_ENTRY_PROMPT } from "../src/index";

describe("asistente y entrenamiento (ADR 0013)", () => {
  it("el contexto incluye el bloque ENTRENAMIENTO con lo declarado y lo marca como no medido", () => {
    const text = buildAssistantContext({
      user: {}, sessions: [], now: "2026-11-04T20:00:00Z", timeZone: "America/Argentina/Buenos_Aires",
      training: {
        active_routine: { name: "Pierna", origin: "professional", goal: "fuerza", items: ["Sentadilla 3 × 10 · 40 kg", "Caminata 20 min"] },
        today: { date: "2026-11-04", state: "in_progress", routine_name: "Pierna", entries: ["Sentadilla · serie 1 · 10 × 40 kg · RPE 7"], summary: { strength_sets: 1, volume_kg: 400, walk_run_duration_s: 0, rpe_mean: 7, with_discomfort_note: 1 }, linked_sessions: ["4/11 19:57 → Sentadilla serie 1"] },
      },
    });
    expect(text).toContain("ENTRENAMIENTO (declarado por la persona");
    expect(text).toContain("indicada por un profesional");
    expect(text).toContain("volumen 400 kg·rep");
    expect(text).toContain("no interpretar");
    expect(describeTraining({})).toBeNull();
  });
  it("en modo log_entry el cliente directo pide JSON con el prompt de extracción y sin historial", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFake: typeof fetch = async (_u, init) => {
      seen = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ model: "qwen", choices: [{ message: { content: '{"intent":"log_entry","item_name":"Sentadilla","kind":"strength","set_index":2,"reps":10,"weight_kg":40,"duration_s":null,"distance_m":null,"rpe":null,"discomfort_note":null,"notes":null,"missing":[]}' } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const c = createAssistantClient({ baseUrl: "http://x:1234", fetch: fetchFake });
    const out = await c.ask("sentadilla serie 2 10 reps 40 kg", "CONTEXTO", [{ role: "user", content: "hola" }], "log_entry");
    expect(out.answer).toContain('"intent":"log_entry"');
    const messages = seen.messages as { role: string; content: string }[];
    expect(messages[0]!.content.startsWith(LOG_ENTRY_PROMPT)).toBe(true);
    expect(messages.length).toBe(2);
    expect(seen.response_format).toEqual({ type: "json_object" });
    expect(seen.temperature).toBe(0);
  });
  it("en modo log_entry el proxy manda mode: log_entry", async () => {
    let seen: Record<string, unknown> = {};
    const fetchFake: typeof fetch = async (_u, init) => { seen = JSON.parse(String(init?.body)) as Record<string, unknown>; return new Response(JSON.stringify({ answer: "{}", model: "m" }), { status: 200, headers: { "Content-Type": "application/json" } }); };
    const c = createAssistantClient({ transport: "proxy", supabaseUrl: "https://p.supabase.co", anonKey: "k", accessToken: "t", fetch: fetchFake });
    await c.ask("hice 3 series", "CONTEXTO", [], "log_entry");
    expect(seen.mode).toBe("log_entry");
    expect(seen.history).toEqual([]);
  });
});
