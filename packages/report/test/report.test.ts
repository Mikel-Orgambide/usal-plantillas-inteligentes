import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHANNEL_CODES, RIGHT_MODULE_CONFIGURATION, SIMULATED_CONFIGURATION } from "@plantillas/contract";
import { validateBundle, type SessionBundle } from "@plantillas/storage";
import { buildComparisonReportHtml, buildSessionReportHtml, reportFileName } from "../src";

const physical = validateBundle(JSON.parse(readFileSync(new URL("./fixtures/fisica-3-canales.json", import.meta.url), "utf-8")));

function simulatedBundle(): SessionBundle {
  const records = Array.from({ length: 50 }, (_, i) => ({
    capture_id: "SIM-001-C1", sequence: i, format_version: "1.0", received_at: new Date(1_700_000_000_000 + i * 50).toISOString(),
    samples: CHANNEL_CODES.map((code, k) => ({ channel_id: code, time_us: i * 50_000 + k * 100, raw_value: i === 7 && k === 5 ? null : 500 + k * 300 + (i % 5) * 10, unit: "adc_count" as const, status: (i === 7 && k === 5 ? "read_error" : "ok") as "ok" | "read_error" })),
  }));
  return {
    format: "plantillas-session-bundle-1", exported_at: "2026-11-03T20:00:00.000Z", schema_version: 3,
    configuration: SIMULATED_CONFIGURATION,
    session: { id: "11111111-2222-3333-4444-555555555555", user_id: "local", activity: "running", context: "demo", source: "simulated", state: "completed", started_at: "2026-11-03T19:00:00.000Z", ended_at: "2026-11-03T19:00:02.500Z", duration_ms: 2500, created_at: "2026-11-03T19:00:00.000Z", updated_at: "2026-11-03T19:00:02.500Z" },
    captures: [{ device_id: "SIM-001", configuration_id: "SIM-CONFIG-001", external_capture_id: "SIM-001-C1", source: "simulated", started_at: "2026-11-03T19:00:00.000Z" }],
    records, events: [{ type: "session_started", at_us: null, received_at: "2026-11-03T19:00:00.000Z", detail: null } as SessionBundle["events"][number]], results: [],
  };
}

/** Sesión bilateral (ADR 0011): el módulo izquierdo real más un módulo derecho espejado con reloj desfasado 300 ms. */
function bilateralBundle(): SessionBundle {
  const left = physical;
  const t0 = Date.parse(left.records[0]!.received_at);
  const rightRecords = left.records.map((r) => ({
    ...r, capture_id: "ESP32-000001-B1-C1",
    received_at: new Date(Date.parse(r.received_at) + 20).toISOString(),
    samples: r.samples.map((s) => ({ ...s, channel_id: s.channel_id.replace("L_", "R_") as typeof s.channel_id, time_us: s.time_us + 300_000, raw_value: s.raw_value === null ? null : Math.round(s.raw_value * 0.8) })),
  })).filter((r) => Date.parse(r.received_at) - t0 < 4000); // el derecho se pierde a los 4 s
  return {
    ...left,
    configurations: [left.configuration, RIGHT_MODULE_CONFIGURATION],
    captures: [...left.captures, { device_id: RIGHT_MODULE_CONFIGURATION.device_id, configuration_id: RIGHT_MODULE_CONFIGURATION.configuration_id, external_capture_id: "ESP32-000001-B1-C1", source: "physical", started_at: left.captures[0]!.started_at }],
    records: [...left.records, ...rightRecords],
    events: [...left.events, { type: "module_lost", at_us: null, received_at: new Date(t0 + 4000).toISOString(), detail: JSON.stringify({ device_id: RIGHT_MODULE_CONFIGURATION.device_id, foot: "right" }), capture_id: null } as SessionBundle["events"][number]],
  };
}

describe("informe de sesión", () => {
  it("sesión bilateral con dos módulos: izquierda/derecha sobre tramos completos, desfase declarado y módulo perdido", () => {
    const b = bilateralBundle();
    const html = buildSessionReportHtml(b, { appVersion: "0.13.0", generatedAt: "2026-11-04T10:00:00.000Z", transport: "BLE" });
    expect(html).toContain("dos módulos autónomos, uno por pie");
    expect(html).toContain("Módulo derecho");
    expect(html).toContain("6 de 6");
    expect(html).toContain("Izquierdo / derecho (tramos completos)");
    expect(html).toMatch(/Desfase estimado entre módulos<\/td><td>(2[6-9]\d|3[0-3]\d) ms/);
    expect(html).not.toContain("n/d · requiere ambos pies");
    expect(html).toContain("no es sincronización");
    // seis series + barras
    expect((html.match(/<svg /g) ?? []).length).toBe(7);
    const cmp = buildComparisonReportHtml(b, b, { generatedAt: "2026-11-04T10:00:00.000Z" });
    expect(cmp).toContain("ESP32-FSR-L-001 + ESP32-FSR-R-001");
    expect(cmp).toContain("tramos completos");
  });

  it("sesión física de tres canales: lista el pie derecho como no disponible y las métricas bilaterales como n/d", () => {
    const html = buildSessionReportHtml(physical, { appVersion: "0.12.0", generatedAt: "2026-11-03T21:00:00.000Z", transport: "BLE" });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("ESP32-FSR-L-001");
    expect(html).toContain('<span class="tag">physical</span>');
    expect(html).toContain("Señal adquirida de sensores FSR");
    expect((html.match(/no disponible \(posición no instrumentada/g) ?? []).length).toBe(3);
    expect(html).toContain("n/d · requiere ambos pies");
    expect(html).toContain("3 de 6");
    // tres series + barras
    expect((html.match(/<svg /g) ?? []).length).toBe(4);
    expect(html).toContain("no constituye diagnóstico");
    expect(html).not.toMatch(/[\w.]+@[\w.]+\.\w+/);
    expect(html).toContain("generado el 03/11/2026");
  });

  it("sesión simulada de seis canales: lo declara como señal simulada y calcula izquierda/derecha", () => {
    const html = buildSessionReportHtml(simulatedBundle());
    expect(html).toContain('<span class="tag">simulated</span>');
    expect(html).toContain("no acredita medición plantar");
    expect(html).not.toContain("requiere ambos pies");
    expect(html).toContain("6 de 6");
    expect(html).toContain("Muestras válidas / con error</td><td>299 / 1");
    expect((html.match(/<svg /g) ?? []).length).toBe(7);
  });

  it("seudónimo y nombre de archivo", () => {
    const html = buildSessionReportHtml(physical, { alias: "Participante 01" });
    expect(html).toContain("Participante 01");
    expect(buildSessionReportHtml(physical)).toContain("usuario local");
    expect(reportFileName(physical)).toBe("informe-2026-11-03-ca49daed.pdf");
  });

  it("comparación: dos sesiones compatibles y una incompatible", () => {
    const ok = buildComparisonReportHtml(physical, physical);
    expect(ok).toContain("comparten configuración y origen");
    expect(ok).toContain("+0");
    const bad = buildComparisonReportHtml(physical, simulatedBundle());
    expect(bad).toContain("no son comparables");
    expect(bad).toContain("no disponible en ambas sesiones");
  });
});

describe("entrenamiento asociado (ADR 0013)", () => {
  it("una sesión vinculada muestra la sección 7b marcada como declarada; sin vínculo no aparece", () => {
    const linked: SessionBundle = {
      ...physical,
      training: {
        workout: { id: "W1", routine_id: "R1", date: "2026-11-04", started_at: "2026-11-04T20:00:00Z", ended_at: null, state: "in_progress", notes: null },
        routine_name: "Pierna",
        entry: { id: "E1", workout_id: "W1", item_id: null, item_name: "Sentadilla", kind: "strength", set_index: 3, reps: 8, weight_kg: 45, duration_s: null, distance_m: null, rpe: 8, discomfort_note: "molestia leve en el talón", notes: null, recorded_at: "2026-11-04T20:05:00Z", session_id: null },
        entries: [{ id: "E1", workout_id: "W1", item_id: null, item_name: "Sentadilla", kind: "strength", set_index: 3, reps: 8, weight_kg: 45, duration_s: null, distance_m: null, rpe: 8, discomfort_note: "molestia leve en el talón", notes: null, recorded_at: "2026-11-04T20:05:00Z", session_id: null }],
      },
    };
    const html = buildSessionReportHtml(linked);
    expect(html).toContain("7b. Entrenamiento asociado");
    expect(html).toContain("declarado por el usuario");
    expect(html).toContain("Sentadilla · serie 3 · 8 × 45 kg · RPE 8");
    expect(html).toContain("molestia leve en el talón");
    expect(html).toContain("sin interpretación");
    expect(buildSessionReportHtml(physical)).not.toContain("Entrenamiento asociado");
  });

  it("actividad unificada: las series declaradas durante la sesión (session_id) se marcan sin necesidad de un vínculo por serie", () => {
    const sid = physical.session.id;
    const mk = (id: string, set: number, session_id: string | null) => ({ id, workout_id: "W1", item_id: null, item_name: "Sentadilla", kind: "strength" as const, set_index: set, reps: 10, weight_kg: 40, duration_s: null, distance_m: null, rpe: null, discomfort_note: null, notes: null, recorded_at: "2026-11-04T20:05:00Z", session_id });
    const bundle: SessionBundle = {
      ...physical,
      training: { workout: { id: "W1", routine_id: null, date: "2026-11-04", started_at: "2026-11-04T20:00:00Z", ended_at: null, state: "in_progress", notes: null }, routine_name: null, entry: null, entries: [mk("E1", 1, sid), mk("E2", 2, sid), mk("E3", 3, null)] },
    };
    const html = buildSessionReportHtml(bundle);
    expect(html).toContain("2 serie(s) declaradas durante la sesión");
    expect(html.match(/esta sesión<\/span>/g)?.length).toBe(2);
  });
});
