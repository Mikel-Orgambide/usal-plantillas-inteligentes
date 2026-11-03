import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHANNEL_CODES, SIMULATED_CONFIGURATION } from "@plantillas/contract";
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

describe("informe de sesión", () => {
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
