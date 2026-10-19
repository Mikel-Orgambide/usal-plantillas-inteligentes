import { describe, expect, it } from "vitest";
import { validateSourceRecord } from "@plantillas/contract";
import { MEASUREMENT_BYTES, ProtocolError, decodeMeasurement, encodeMeasurement, parseDeviceInfo, parseStatus } from "../src/index";
import { FIRMWARE_INFO } from "./fake-board";

const bytes = (s: string) => Array.from(new TextEncoder().encode(s));

describe("parseDeviceInfo", () => {
  it("construye la configuración física desde la info del firmware", () => {
    const { info, configuration } = parseDeviceInfo(bytes(JSON.stringify(FIRMWARE_INFO)));
    expect(info.firmware).toBe("0.1.0-h1");
    expect(configuration).toMatchObject({ configuration_id: "ESP32-SYN-001", device_id: "ESP32-9E7EE4", source: "physical", raw_range: { min: 0, max: 4095, resolution_bits: 12 } });
    expect(configuration.channels.map((c) => c.model)).toEqual(Array(6).fill("synthetic"));
  });

  it("rechaza versión de formato desconocida, canales en otro orden o JSON roto", () => {
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...FIRMWARE_INFO, format_version: "2.0" })))).toThrow(ProtocolError);
    const swapped = [...FIRMWARE_INFO.channels];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(() => parseDeviceInfo(bytes(JSON.stringify({ ...FIRMWARE_INFO, channels: swapped })))).toThrow(/orden/);
    expect(() => parseDeviceInfo(bytes("{no es json"))).toThrow(/JSON/);
  });
});

describe("decodeMeasurement", () => {
  const info = { device_id: "ESP32-9E7EE4", configuration_id: "ESP32-SYN-001" };

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

describe("parseStatus", () => {
  it("reconoce capture_started/stopped/dropped y deja el resto como other", () => {
    expect(parseStatus(bytes('{"event":"capture_started","capture_id":"X-B1-C1","dropped":0}'))).toEqual({ event: "capture_started", capture_id: "X-B1-C1", dropped: 0 });
    expect(parseStatus(bytes("basura")).event).toBe("other");
  });
});
