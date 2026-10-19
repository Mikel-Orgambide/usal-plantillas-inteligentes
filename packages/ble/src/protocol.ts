import {
  CHANNEL_CODES,
  FORMAT_VERSION,
  isChannelCode,
  type AcquisitionConfiguration,
  type ChannelDefinition,
  type SensorModel,
} from "@plantillas/contract";

/**
 * Protocolo GATT de la plantilla (ADR 0006). Este módulo solo traduce: bytes
 * y JSON de la placa ↔ estructuras del contrato. No valida el significado de
 * los registros; eso lo hace `validateSourceRecord`, igual que con el simulador.
 */

export const SERVICE_UUID = "7a0e0001-5d3f-4b1a-9f4c-2e6b8c1d0001";
export const INFO_UUID = "7a0e0002-5d3f-4b1a-9f4c-2e6b8c1d0001";
export const CONTROL_UUID = "7a0e0003-5d3f-4b1a-9f4c-2e6b8c1d0001";
export const STATUS_UUID = "7a0e0004-5d3f-4b1a-9f4c-2e6b8c1d0001";
export const MEASUREMENT_UUID = "7a0e0005-5d3f-4b1a-9f4c-2e6b8c1d0001";

export const COMMAND_START = 0x01;
export const COMMAND_STOP = 0x02;

/** Tamaño del registro binario y MTU mínimo para recibirlo en una sola notificación (3 bytes de cabecera ATT). */
export const MEASUREMENT_BYTES = 45;
export const MIN_MTU = MEASUREMENT_BYTES + 3;
export const REQUESTED_MTU = 185;
const BINARY_VERSION = 1;
const READ_ERROR_VALUE = 0xffff;

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

export interface DeviceInfo {
  readonly format_version: string;
  readonly device_id: string;
  readonly configuration_id: string;
  readonly firmware: string;
  readonly raw_max: number;
  readonly period_us: number;
  readonly channels: readonly { code: string; installation_id: string; model: string }[];
}

const MODELS: readonly SensorModel[] = ["FSR406", "FSR402", "synthetic"];

function bytesToText(bytes: Uint8Array | readonly number[]): string {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  // La placa envía UTF-8; decodificamos los multibyte sin depender de TextDecoder.
  try { return decodeURIComponent(escape(out)); } catch { return out; }
}

/** Lee la característica `info` (JSON) y construye la configuración de adquisición. La procedencia es física por definición del adaptador. */
export function parseDeviceInfo(raw: Uint8Array | readonly number[]): { info: DeviceInfo; configuration: AcquisitionConfiguration } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytesToText(raw));
  } catch {
    throw new ProtocolError("la característica info no contiene JSON válido");
  }
  const o = parsed as Partial<DeviceInfo>;
  if (typeof o.device_id !== "string" || !o.device_id) throw new ProtocolError("info sin device_id");
  if (typeof o.configuration_id !== "string" || !o.configuration_id) throw new ProtocolError("info sin configuration_id");
  if (o.format_version !== FORMAT_VERSION) throw new ProtocolError(`versión de formato no soportada: ${String(o.format_version)}`);
  if (typeof o.raw_max !== "number" || o.raw_max <= 0) throw new ProtocolError("info sin raw_max");
  if (!Array.isArray(o.channels)) throw new ProtocolError("info sin canales");
  const codes = o.channels.map((c) => c.code);
  if (codes.length !== CHANNEL_CODES.length || CHANNEL_CODES.some((c, i) => codes[i] !== c)) {
    throw new ProtocolError(`canales inesperados: ${codes.join(", ")} (se esperan ${CHANNEL_CODES.join(", ")} en ese orden)`);
  }
  const channels: ChannelDefinition[] = o.channels.map((c) => {
    if (!isChannelCode(c.code)) throw new ProtocolError(`canal desconocido: ${c.code}`);
    if (!MODELS.includes(c.model as SensorModel)) throw new ProtocolError(`modelo desconocido: ${c.model}`);
    return { code: c.code, installation_id: c.installation_id, model: c.model as SensorModel, unit: "adc_count" };
  });
  const info: DeviceInfo = {
    format_version: o.format_version,
    device_id: o.device_id,
    configuration_id: o.configuration_id,
    firmware: typeof o.firmware === "string" ? o.firmware : "desconocido",
    raw_max: o.raw_max,
    period_us: typeof o.period_us === "number" ? o.period_us : 0,
    channels: o.channels,
  };
  const configuration: AcquisitionConfiguration = {
    configuration_id: info.configuration_id,
    device_id: info.device_id,
    source: "physical",
    raw_range: { min: 0, max: info.raw_max, resolution_bits: Math.round(Math.log2(info.raw_max + 1)) },
    channels,
    description: `${info.configuration_id} · firmware ${info.firmware}`,
  };
  return { info, configuration };
}

export function captureIdOf(deviceId: string, boot: number, capture: number): string {
  return `${deviceId}-B${boot}-C${capture}`;
}

/**
 * Registro binario little-endian de 45 bytes → registro del contrato (sin validar).
 * u8 versión · u16 boot · u16 captura · u32 sequence · 6 × (u32 time_us, u16 valor); 0xFFFF = read_error.
 */
export function decodeMeasurement(bytes: Uint8Array | readonly number[], info: Pick<DeviceInfo, "device_id" | "configuration_id">): Record<string, unknown> {
  if (bytes.length !== MEASUREMENT_BYTES) throw new ProtocolError(`registro de ${bytes.length} bytes (se esperan ${MEASUREMENT_BYTES})`);
  const b = bytes;
  const u16 = (i: number) => (b[i]! | (b[i + 1]! << 8)) >>> 0;
  const u32 = (i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
  if (b[0] !== BINARY_VERSION) throw new ProtocolError(`versión binaria desconocida: ${b[0]}`);
  const boot = u16(1);
  const capture = u16(3);
  const sequence = u32(5);
  const samples = CHANNEL_CODES.map((code, i) => {
    const off = 9 + i * 6;
    const value = u16(off + 4);
    const error = value === READ_ERROR_VALUE;
    return { channel_id: code, time_us: u32(off), raw_value: error ? null : value, unit: "adc_count", status: error ? "read_error" : "ok" };
  });
  return {
    format_version: FORMAT_VERSION,
    device_id: info.device_id,
    capture_id: captureIdOf(info.device_id, boot, capture),
    configuration_id: info.configuration_id,
    sequence,
    samples,
  };
}

/** Codifica un registro con el mismo formato que la placa (para pruebas y para el simulador de enlace). */
export function encodeMeasurement(r: { boot: number; capture: number; sequence: number; samples: readonly { time_us: number; value: number | null }[] }): Uint8Array {
  const out = new Uint8Array(MEASUREMENT_BYTES);
  let p = 0;
  const put16 = (v: number) => { out[p++] = v & 0xff; out[p++] = (v >>> 8) & 0xff; };
  const put32 = (v: number) => { for (let i = 0; i < 4; i++) out[p++] = (v >>> (8 * i)) & 0xff; };
  out[p++] = BINARY_VERSION;
  put16(r.boot);
  put16(r.capture);
  put32(r.sequence);
  for (const s of r.samples) { put32(s.time_us); put16(s.value === null ? READ_ERROR_VALUE : s.value); }
  return out;
}

export type StatusMessage =
  | { readonly event: "capture_started" | "capture_stopped"; readonly capture_id: string; readonly dropped: number }
  | { readonly event: "dropped"; readonly capture_id: string; readonly dropped: number }
  | { readonly event: "other"; readonly raw: string };

export function parseStatus(raw: Uint8Array | readonly number[]): StatusMessage {
  const text = bytesToText(raw);
  try {
    const o = JSON.parse(text) as { event?: string; capture_id?: string; dropped?: number };
    if ((o.event === "capture_started" || o.event === "capture_stopped" || o.event === "dropped") && typeof o.capture_id === "string") {
      return { event: o.event, capture_id: o.capture_id, dropped: typeof o.dropped === "number" ? o.dropped : 0 };
    }
  } catch { /* no es JSON: se informa como "other" */ }
  return { event: "other", raw: text };
}
