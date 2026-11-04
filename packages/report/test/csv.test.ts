import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RIGHT_MODULE_CONFIGURATION } from "@plantillas/contract";
import { validateBundle, type SessionBundle } from "@plantillas/storage";
import { CSV_HEADER, buildSessionCsv, csvFileName } from "../src";

const physical = validateBundle(JSON.parse(readFileSync(new URL("./fixtures/fisica-3-canales.json", import.meta.url), "utf-8")));

function bilateral(): SessionBundle {
  const left = physical;
  const rightRecords = left.records.slice(0, 10).map((r) => ({
    ...r, capture_id: "ESP32-000001-B1-C1",
    samples: r.samples.map((s, k) => ({ ...s, channel_id: s.channel_id.replace("L_", "R_") as typeof s.channel_id, raw_value: k === 1 ? null : s.raw_value, status: (k === 1 ? "read_error" : "ok") as "ok" | "read_error" })),
  }));
  return {
    ...left,
    configurations: [left.configuration, RIGHT_MODULE_CONFIGURATION],
    captures: [...left.captures, { device_id: RIGHT_MODULE_CONFIGURATION.device_id, configuration_id: RIGHT_MODULE_CONFIGURATION.configuration_id, external_capture_id: "ESP32-000001-B1-C1", source: "physical", started_at: left.captures[0]!.started_at }],
    records: [...left.records, ...rightRecords],
  };
}

describe("exportación CSV de sesión", () => {
  it("sesión física de tres canales: BOM, cabecera, una fila por muestra, pie y zona del contrato", () => {
    const csv = buildSessionCsv(physical);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.replace("﻿", "").split("\r\n").filter(Boolean);
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    const samples = physical.records.reduce((n, r) => n + r.samples.length, 0);
    expect(lines.length - 1).toBe(samples);
    expect(samples).toBe(physical.records.length * 3);
    const first = lines[1]!.split(",");
    expect(first[0]).toBe(physical.session.id);
    expect(first[1]).toBe(physical.configuration.device_id);
    expect(first[3]).toBe("0");
    expect(first[5]).toBe("L_HEEL");
    expect(first[6]).toBe("left");
    expect(first[7]).toBe("heel");
    expect(first[10]).toBe("adc_count");
    expect(first[11]).toBe("ok");
    for (const l of lines.slice(1)) expect(l.split(",")[9]).toMatch(/^\d*$/); // raw_value entero o vacío, sin coma decimal
    expect(csvFileName(physical)).toBe(`sesion-${physical.session.started_at.slice(0, 10)}-${physical.session.id.slice(0, 8)}.csv`);
  });

  it("sesión bilateral: las muestras de cada módulo llevan su device_id y captura; read_error con valor vacío, nunca cero", () => {
    const b = bilateral();
    const lines = buildSessionCsv(b).replace("﻿", "").split("\r\n").filter(Boolean).slice(1);
    const right = lines.filter((l) => l.includes(",R_"));
    expect(right.length).toBe(10 * 3);
    expect(right[0]!.split(",")[1]).toBe(RIGHT_MODULE_CONFIGURATION.device_id);
    expect(right[0]!.split(",")[2]).toBe("ESP32-000001-B1-C1");
    const errors = right.filter((l) => l.endsWith(",read_error"));
    expect(errors.length).toBe(10);
    for (const l of errors) expect(l.split(",")[9]).toBe("");
    const left = lines.filter((l) => l.includes(",L_"));
    expect(left.length).toBe(physical.records.length * 3);
  });
});
