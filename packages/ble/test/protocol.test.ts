import { describe, expect, it } from "vitest";
import { CHANNEL_CODES, validateConfiguration, validateSourceRecord } from "@plantillas/contract";
import { MEASUREMENT_BYTES, ProtocolError, decodeMeasurement, encodeMeasurement, measurementBytes, measurementContextOf, parseDeviceInfo, parseStatus } from "../src/index";
import { LEFT_FIRMWARE_INFO } from "./fake-board";
import { FIRMWARE_INFO } from "./fake-board";

const bytes = (s: string) => Array.from(new TextEncoder().encode(s));

describe("parseDeviceInfo", () => {
  it("construye la configuración física desde la info del firmware", () => {
    const { info, configuration } = parseDeviceInfo(bytes(JSON.stringify(FIRMWARE_INFO)));
    expect(info.firmware).toBe("0.2.1-h6");
    expect(JSON.stringify(FIRMWARE_INFO).length).toBeLessThan(512);
    expect(configuration.channels[0]).toMatchObject({ code: "L_HEEL", installation_id: "ESP32-SYN-001-L_HEEL" });
    expect(configuration).toMatchObject({ configuration_id: "ESP32-SYN-001", device_id: "ESP32-9E7EE4", source: "physical", raw_range: { min: 0, max: 4095, resolution_bits: 12 } });
    expect(configuration.channels.map((c) => c.model)).toEqual(Array(6).fill("synthetic"));
  });

  it("rechaza versión de formato desconocida, canales en otro orden o JSON roto", () => {
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...FIRMWARE_INFO, format_version: "2.0" })))).toThrow(ProtocolError);
    const swapped = [...FIRMWARE_INFO.channels];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    // Forma extendida (por canal) también se acepta.
    const extended = { ...FIRMWARE_INFO, model: undefined, channels: FIRMWARE_INFO.channels.map((code) => ({ code, installation_id: `X-${code}`, model: "FSR402" })) };
    expect(parseDeviceInfo(bytes(JSON.stringify(extended))).configuration.channels[0]).toMatchObject({ installation_id: "X-L_HEEL", model: "FSR402" });
    // Un JSON truncado (como el que produce superar los 512 bytes) se rechaza con motivo.
    expect(() => parseDeviceInfo(bytes(JSON.stringify(FIRMWARE_INFO).slice(0, 100)))).toThrow(/JSON/);
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...FIRMWARE_INFO, channels: swapped })))).toThrow(/orden/);
    expect(() => parseDeviceInfo(bytes("{no es json"))).toThrow(/JSON/);
  });
});

describe("decodeMeasurement", () => {
  const info = { device_id: "ESP32-9E7EE4", configuration_id: "ESP32-SYN-001", channel_codes: CHANNEL_CODES };

  it("decodifica el registro binario de 45 bytes y el validador del contrato lo acepta", () => {
    const raw = encodeMeasurement({ boot: 8, capture: 1, sequence: 298, samples: [810, 746, 622, 72, 70, 67].map((v, i) => ({ time_us: 14950030 + i * 3, value: v })) });
    expect(raw.length).toBe(MEASUREMENT_BYTES);
    const rec = decodeMeasurement(raw, info);
    expect(rec).toMatchObject({ capture_id: "ESP32-9E7EE4-B8-C1", sequence: 298, configuration_id: "ESP32-SYN-001" });
    const { configuration } = parseDeviceInfo(bytes(JSON.stringify(FIRMWARE_INFO)));
    const v = validateSourceRecord(rec, configuration);
    expect(v.ok).toBe(true);
  });

  it("0xFFFF es read_error con raw_value null (nunca cero); 0 es una lectura válida", () => {
    const raw = encodeMeasurement({ boot: 1, capture: 1, sequence: 0, samples: [0, 1, 2, 3, 4, null].map((v) => ({ time_us: 10, value: v })) });
    const rec = decodeMeasurement(raw, info) as { samples: Array<{ raw_value: number | null; status: string }> };
    expect(rec.samples[0]).toMatchObject({ raw_value: 0, status: "ok" });
    expect(rec.samples[5]).toMatchObject({ raw_value: null, status: "read_error" });
  });

  it("enteros de 32 bits sin signo se conservan (sequence y time_us grandes)", () => {
    const raw = encodeMeasurement({ boot: 65535, capture: 65535, sequence: 4_000_000_000, samples: Array.from({ length: 6 }, () => ({ time_us: 4_294_967_295, value: 4095 })) });
    const rec = decodeMeasurement(raw, info) as { sequence: number; capture_id: string; samples: Array<{ time_us: number }> };
    expect(rec.sequence).toBe(4_000_000_000);
    expect(rec.samples[0]!.time_us).toBe(4_294_967_295);
    expect(rec.capture_id).toBe("ESP32-9E7EE4-B65535-C65535");
  });

  it("rechaza tamaño o versión binaria distintos", () => {
    expect(() => decodeMeasurement(new Uint8Array(20), info)).toThrow(/20 bytes/);
    const raw = encodeMeasurement({ boot: 1, capture: 1, sequence: 0, samples: Array.from({ length: 6 }, () => ({ time_us: 0, value: 1 })) });
    raw[0] = 9;
    expect(() => decodeMeasurement(raw, info)).toThrow(/versión binaria/);
  });
});

describe("módulo unilateral (firmware 0.3.0, tres canales)", () => {
  it("acepta la info con un subconjunto de canales y modelos por canal", () => {
    const { info, configuration } = parseDeviceInfo(bytes(JSON.stringify(LEFT_FIRMWARE_INFO)));
    expect(info.channel_codes).toEqual(["L_HEEL", "L_MEDIAL", "L_LATERAL"]);
    expect(configuration.channels.map((c) => c.model)).toEqual(["FSR406", "FSR402", "FSR402"]);
    expect(configuration.channels[0]!.installation_id).toBe("ESP32-FSR-L-001-L_HEEL");
    expect(validateConfiguration(configuration)).toEqual([]);
  });

  it("rechaza canales vacíos, desconocidos o fuera del orden del contrato", () => {
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...LEFT_FIRMWARE_INFO, channels: [] })))).toThrow(/sin canales/);
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...LEFT_FIRMWARE_INFO, channels: ["L_HEEL", "L_LATERAL", "L_MEDIAL"] })))).toThrow(/orden/);
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...LEFT_FIRMWARE_INFO, channels: ["L_HEEL", "L_TOE"] })))).toThrow(/orden|desconocido/);
  });

  it("decodifica el registro de 27 bytes con el tamaño que fija la configuración y el validador lo acepta", () => {
    const { configuration } = parseDeviceInfo(bytes(JSON.stringify(LEFT_FIRMWARE_INFO)));
    const ctx = measurementContextOf(configuration);
    const raw = encodeMeasurement({ boot: 2, capture: 1, sequence: 7, samples: [3501, 3583, 3846].map((v, i) => ({ time_us: 1000 + i, value: v })) });
    expect(raw.length).toBe(measurementBytes(3));
    expect(raw.length).toBe(27);
    const rec = decodeMeasurement(raw, ctx) as { samples: Array<{ channel_id: string }> };
    expect(rec.samples.map((s) => s.channel_id)).toEqual(["L_HEEL", "L_MEDIAL", "L_LATERAL"]);
    expect(validateSourceRecord(rec, configuration).ok).toBe(true);
    // Un registro de seis canales ya no corresponde a esta configuración.
    const seis = encodeMeasurement({ boot: 2, capture: 1, sequence: 8, samples: Array.from({ length: 6 }, () => ({ time_us: 0, value: 1 })) });
    expect(() => decodeMeasurement(seis, ctx)).toThrow(/45 bytes/);
  });
});

describe("parseStatus", () => {
  it("reconoce capture_started/stopped/dropped y deja el resto como other", () => {
    expect(parseStatus(bytes('{"event":"capture_started","capture_id":"X-B1-C1","dropped":0}'))).toEqual({ event: "capture_started", capture_id: "X-B1-C1", dropped: 0 });
    expect(parseStatus(bytes("basura")).event).toBe("other");
  });
});
