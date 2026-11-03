import { describe, expect, it } from "vitest";
import { LEFT_MODULE_CONFIGURATION, SIMULATED_CONFIGURATION, validateSourceRecord, type SourceRecord } from "../src/index";
import { clone, loadFixture } from "./fixtures";

const config = SIMULATED_CONFIGURATION;

function expectErrorCodes(input: unknown, ...codes: string[]) {
  const result = validateSourceRecord(input, config);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  for (const code of codes) {
    expect(result.errors.map((e) => e.code), JSON.stringify(result.errors)).toContain(code);
  }
}

describe("validación del contrato v1.0", () => {
  it("C01 - registro completo válido: seis canales asociados correctamente", () => {
    const result = validateSourceRecord(loadFixture("registro_valido.json"), config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.samples.map((s) => s.channel_id)).toEqual([
      "L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL",
    ]);
    expect(result.record.sequence).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("C02 - cero con estado ok se conserva como cero digital válido", () => {
    const result = validateSourceRecord(loadFixture("registro_con_cero.json"), config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const heel = result.record.samples.find((s) => s.channel_id === "L_HEEL");
    expect(heel?.raw_value).toBe(0);
    expect(heel?.status).toBe("ok");
    expect(result.warnings.map((w) => w.code)).toEqual(["adc_boundary"]);
  });

  it("C03 - null con read_error se conserva como error explícito", () => {
    const result = validateSourceRecord(loadFixture("registro_con_read_error.json"), config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lateral = result.record.samples.find((s) => s.channel_id === "R_LATERAL");
    expect(lateral).toEqual({ channel_id: "R_LATERAL", time_us: 2000, raw_value: null, unit: "adc_count", status: "read_error" });
    expect(result.record.samples.filter((s) => s.status === "ok")).toHaveLength(5);
  });

  it("C04 - estado y valor contradictorios producen error explícito, no corrección", () => {
    const okConNull = clone(loadFixture("registro_valido.json")) as SourceRecord;
    (okConNull.samples[0] as { raw_value: number | null }).raw_value = null;
    expectErrorCodes(okConNull, "status_value_mismatch");

    const errorConValor = clone(loadFixture("registro_con_read_error.json")) as SourceRecord;
    (errorConValor.samples[5] as { raw_value: number | null }).raw_value = 0;
    expectErrorCodes(errorConValor, "status_value_mismatch");
  });

  it("C05 - versión desconocida se rechaza antes del procesamiento", () => {
    const r = clone(loadFixture("registro_valido.json")) as Record<string, unknown>;
    r["format_version"] = "2.0";
    expectErrorCodes(r, "unsupported_version");
  });

  it("C06 - canal ausente, duplicado o desconocido: incompatibilidad identificada sin rellenar con cero", () => {
    const ausente = clone(loadFixture("registro_valido.json")) as { samples: unknown[] };
    ausente.samples.pop();
    expectErrorCodes(ausente, "missing_channel");

    const duplicado = clone(loadFixture("registro_valido.json")) as { samples: { channel_id: string }[] };
    duplicado.samples[5]!.channel_id = "L_HEEL";
    expectErrorCodes(duplicado, "duplicate_channel", "missing_channel");

    const desconocido = clone(loadFixture("registro_valido.json")) as { samples: { channel_id: string }[] };
    desconocido.samples[2]!.channel_id = "L_TOE";
    expectErrorCodes(desconocido, "unknown_channel", "missing_channel");
  });

  it("C06b - configuración unilateral: exige exactamente sus tres canales, ni más ni menos", () => {
    const base = clone(loadFixture("registro_valido.json")) as SourceRecord & { samples: unknown[] };
    const unilateral = { ...base, device_id: LEFT_MODULE_CONFIGURATION.device_id, configuration_id: LEFT_MODULE_CONFIGURATION.configuration_id };
    const tres = { ...unilateral, samples: base.samples.slice(0, 3) };
    const ok = validateSourceRecord(tres, LEFT_MODULE_CONFIGURATION);
    expect(ok.ok, JSON.stringify(ok)).toBe(true);
    if (ok.ok) expect(ok.record.samples.map((s) => s.channel_id)).toEqual(["L_HEEL", "L_MEDIAL", "L_LATERAL"]);

    // Un registro de seis canales contra la configuración de tres: el pie derecho no está declarado.
    const seis = validateSourceRecord(unilateral, LEFT_MODULE_CONFIGURATION);
    expect(seis.ok).toBe(false);
    if (!seis.ok) expect(seis.errors.map((e) => e.code)).toContain("channel_not_in_configuration");

    const dos = { ...unilateral, samples: base.samples.slice(0, 2) };
    const faltante = validateSourceRecord(dos, LEFT_MODULE_CONFIGURATION);
    expect(faltante.ok).toBe(false);
    if (!faltante.ok) expect(faltante.errors.map((e) => e.code)).toContain("missing_channel");
  });

  it("C07 - campos no finitos o fuera del tipo admitido: error representacional", () => {
    const infinito = clone(loadFixture("registro_valido.json")) as { samples: { raw_value: unknown }[] };
    infinito.samples[0]!.raw_value = Number.POSITIVE_INFINITY;
    expectErrorCodes(infinito, "invalid_integer");

    const decimal = clone(loadFixture("registro_valido.json")) as { samples: { time_us: unknown }[] };
    decimal.samples[0]!.time_us = 12.5;
    expectErrorCodes(decimal, "invalid_integer");

    const negativo = clone(loadFixture("registro_valido.json")) as { sequence: unknown };
    negativo.sequence = -1;
    expectErrorCodes(negativo, "negative_value");

    const enorme = clone(loadFixture("registro_valido.json")) as { samples: { time_us: unknown }[] };
    enorme.samples[0]!.time_us = 2 ** 53;
    expectErrorCodes(enorme, "unsafe_integer");

    const cadena = clone(loadFixture("registro_valido.json")) as { sequence: unknown };
    cadena.sequence = "7";
    expectErrorCodes(cadena, "invalid_integer");
  });

  it("valores fuera del rango declarado son errores de contrato; en el límite, advertencia", () => {
    const fuera = clone(loadFixture("registro_valido.json")) as { samples: { raw_value: unknown }[] };
    fuera.samples[0]!.raw_value = 4096;
    expectErrorCodes(fuera, "out_of_range");

    const limite = validateSourceRecord(loadFixture("registro_valor_limite.json"), config);
    expect(limite.ok).toBe(true);
    if (!limite.ok) return;
    expect(limite.warnings).toHaveLength(1);
    expect(limite.warnings[0]?.path).toBe("samples[5].raw_value");
  });

  it("identificadores vacíos, faltantes o que no coinciden con la configuración se rechazan", () => {
    const vacio = clone(loadFixture("registro_valido.json")) as Record<string, unknown>;
    vacio["capture_id"] = "";
    expectErrorCodes(vacio, "empty_identifier");

    const sinSeq = clone(loadFixture("registro_valido.json")) as Record<string, unknown>;
    delete sinSeq["sequence"];
    expectErrorCodes(sinSeq, "missing_field");

    const otraConfig = clone(loadFixture("registro_valido.json")) as Record<string, unknown>;
    otraConfig["configuration_id"] = "SIM-CONFIG-999";
    expectErrorCodes(otraConfig, "configuration_mismatch");

    const otroDispositivo = clone(loadFixture("registro_valido.json")) as Record<string, unknown>;
    otroDispositivo["device_id"] = "ESP32-REAL";
    expectErrorCodes(otroDispositivo, "device_mismatch");
  });

  it("una entrada que no es un objeto o sin lista de muestras se rechaza sin excepción", () => {
    expectErrorCodes(null, "not_an_object");
    expectErrorCodes("texto", "not_an_object");
    expectErrorCodes([], "not_an_object");
    const sinSamples = clone(loadFixture("registro_valido.json")) as Record<string, unknown>;
    sinSamples["samples"] = "nada";
    expectErrorCodes(sinSamples, "samples_not_array");
  });

  it("una unidad distinta de la declarada se rechaza", () => {
    const r = clone(loadFixture("registro_valido.json")) as { samples: { unit: string }[] };
    r.samples[3]!.unit = "newton";
    expectErrorCodes(r, "invalid_unit");
  });
});
