import { describe, expect, it } from "vitest";
import { describeValues, notInstrumented, computeDistribution } from "@plantillas/metrics";
import type { ChannelCode } from "@plantillas/contract";
import { buildAssistantContext, type AssistantSessionInput } from "../src/index";

const ok = (values: number[]) => describeValues(values.map((raw_value) => ({ raw_value, status: "ok" as const })));

function leftMetrics() {
  return {
    L_HEEL: ok([3800, 3812, 3790]), L_MEDIAL: ok([3100, 3145, 3200]), L_LATERAL: ok([3390, 3400, 3380]),
    R_HEEL: notInstrumented(), R_MEDIAL: notInstrumented(), R_LATERAL: notInstrumented(),
  } as Record<ChannelCode, ReturnType<typeof ok>>;
}

const LEFT: AssistantSessionInput = {
  id: "ca49daed-8884-40a7-9564-aaa0a82bfc8d", started_at: "2026-11-03T20:44:30.000Z", ended_at: "2026-11-03T20:45:02.000Z", duration_ms: 31953,
  activity: "caminata", context: "banco protoboard", source: "physical", state: "completed",
  modules: [{ device_id: "ESP32-9E7EE4", configuration_id: "ESP32-FSR-L-001", foot: "left", channels: ["L_HEEL", "L_MEDIAL", "L_LATERAL"] }],
  quality: { records: 609, expected: 609, readErrors: 0, gaps: 0, captures: 1 },
  metrics: leftMetrics(),
  distribution: computeDistribution(leftMetrics()),
  events: [{ type: "connected", received_at: "2026-11-03T20:44:30.000Z" }, { type: "sequence_gap", received_at: "2026-11-03T20:44:40.000Z" }],
};

const SIM: AssistantSessionInput = {
  id: "11111111-2222-3333-4444-555555555555", started_at: "2026-10-20T10:00:00.000Z", ended_at: "2026-10-20T10:01:00.000Z", duration_ms: 60000,
  activity: "running", context: null, source: "simulated", state: "completed",
  modules: [{ device_id: "SIM-001", configuration_id: "SIM-CONFIG-001", foot: null, channels: ["L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"] }],
};

describe("buildAssistantContext", () => {
  it("describe una sesión física de tres canales con el pie derecho como no disponible y sin convertir unidades", () => {
    const ctx = buildAssistantContext({ user: { alias: "M." }, sessions: [LEFT], selectedSessionId: LEFT.id, now: "2026-11-04T12:00:00.000Z" });
    expect(ctx).toContain("SESIÓN SELECCIONADA");
    expect(ctx).toContain("Sesión ca49daed");
    expect(ctx).toContain("señal real de sensores FSR");
    expect(ctx).toContain("pie izquierdo (ESP32-FSR-L-001");
    expect(ctx).toContain("no disponible: talón der, antepié medial der, antepié lateral der");
    expect(ctx).toContain("talón izq: media 3801, máx 3812");
    expect(ctx).toContain("izquierda/derecha n/d (requiere ambos pies)");
    expect(ctx).toContain("hueco de secuencia");
    expect(ctx).toContain("cuentas ADC");
    expect(ctx).not.toMatch(/newton|kg\b|presión plantar medida/i);
    expect(ctx).not.toContain("@");
  });

  it("marca la señal simulada, ordena por fecha y recorta por espacio", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...SIM, id: `s${i}-${"x".repeat(30)}`, started_at: `2026-10-${String((i % 28) + 1).padStart(2, "0")}T10:00:00.000Z` }));
    const ctx = buildAssistantContext({ user: {}, sessions: [...many, LEFT], maxSessions: 10, maxChars: 2500, now: "2026-11-04T12:00:00.000Z" });
    expect(ctx).toContain("SEÑAL SIMULADA");
    expect(ctx.indexOf("Sesión ca49daed")).toBeLessThan(ctx.indexOf("Sesión s"));
    expect(ctx.length).toBeLessThanOrEqual(2700);
    expect(ctx).toMatch(/omitida\(s\) por espacio/);
    expect(ctx).toContain("Sesiones registradas: 31");
  });

  it("incluye la comparación y el bloque bilateral cuando existen", () => {
    const bilateral: AssistantSessionInput = {
      ...LEFT, id: "bbbbbbbb-0000-0000-0000-000000000000",
      modules: [...LEFT.modules, { device_id: "ESP32-AAAAAA", configuration_id: "ESP32-FSR-R-001", foot: "right", channels: ["R_HEEL", "R_MEDIAL", "R_LATERAL"] }],
      bilateral: { offset_ms: 42.4, complete_fraction: 0.93, left_share: 0.52, right_share: 0.48, asymmetry: { heel: 0.04, medial: null, lateral: -0.02 } },
    };
    const ctx = buildAssistantContext({
      user: {}, sessions: [bilateral, LEFT], selectedSessionId: bilateral.id,
      comparison: { a: bilateral.id, b: LEFT.id, comparable: false, reason: "configuración distinta" },
    });
    expect(ctx).toContain("pie izquierdo (ESP32-FSR-L-001");
    expect(ctx).toContain("pie derecho (ESP32-FSR-R-001");
    expect(ctx).toContain("desfase estimado 42 ms, tramo con ambos módulos 93 %");
    expect(ctx).toContain("asimetría (izq−der)/(izq+der): heel 0.04, lateral -0.02");
    expect(ctx).toContain("no comparables (configuración distinta)");
  });

  it("sin sesiones lo dice en lugar de inventar", () => {
    expect(buildAssistantContext({ user: {}, sessions: [] })).toContain("No hay sesiones registradas todavía.");
  });
});
