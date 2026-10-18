import { describe, expect, it } from "vitest";
import {
  SIMULATED_CONFIGURATION,
  classifySequence,
  normalizeRecord,
  recordKeyOf,
  validateSourceRecord,
} from "../src/index";
import { loadFixture } from "./fixtures";

function validRecord() {
  const r = validateSourceRecord(loadFixture("registro_valido.json"), SIMULATED_CONFIGURATION);
  if (!r.ok) throw new Error("fixture inválido");
  return r.record;
}

describe("normalización", () => {
  it("añade procedencia, sesión y recepción sin alterar las muestras", () => {
    const record = validRecord();
    const normalized = normalizeRecord(record, {
      source: "simulated",
      session_id: "SIM-SESSION-001",
      received_at: "2026-10-18T21:00:00-03:00",
    });
    expect(normalized.source).toBe("simulated");
    expect(normalized.session_id).toBe("SIM-SESSION-001");
    expect(normalized.samples).toEqual(record.samples);
    expect(normalized.samples).not.toBe(record.samples);
    expect(normalized.samples[0]?.time_us).toBe(0);
  });

  it("rechaza sesión vacía y fechas inválidas", () => {
    const record = validRecord();
    expect(() => normalizeRecord(record, { source: "simulated", session_id: "", received_at: "2026-10-18T21:00:00-03:00" })).toThrow();
    expect(() => normalizeRecord(record, { source: "simulated", session_id: "S", received_at: "ayer" })).toThrow();
  });

  it("la clave externa combina dispositivo, captura y secuencia", () => {
    expect(recordKeyOf(validRecord())).toBe("SIM-001|SIM-CAPTURE-001|0");
  });
});

describe("clasificación de secuencia", () => {
  it("primer registro y siguiente", () => {
    expect(classifySequence(undefined, 0)).toEqual({ kind: "first" });
    expect(classifySequence(0, 1)).toEqual({ kind: "next" });
  });

  it("C08 - repetición del mismo identificador se reconoce como duplicado", () => {
    expect(classifySequence(4, 4)).toEqual({ kind: "duplicate" });
  });

  it("C10 - salto de secuencia produce una discontinuidad con el rango faltante", () => {
    expect(classifySequence(4, 8)).toEqual({ kind: "gap", missing_from: 5, missing_to: 7, missing_count: 3 });
  });

  it("C12 - registro fuera de orden se identifica sin reordenar silenciosamente", () => {
    expect(classifySequence(10, 7)).toEqual({ kind: "out_of_order", behind_by: 3 });
  });
});
