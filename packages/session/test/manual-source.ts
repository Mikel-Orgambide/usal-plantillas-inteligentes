import type { AcquisitionConfiguration, DataSource, SourceEvent, SourceListener } from "@plantillas/contract";
import { SIMULATED_CONFIGURATION, FORMAT_VERSION } from "@plantillas/contract";

/** Fuente controlada a mano para pruebas deterministas del coordinador. */
export class ManualSource implements DataSource {
  readonly configuration: AcquisitionConfiguration;
  readonly calls: string[] = [];
  private listeners = new Set<SourceListener>();
  failStop = false;
  failConnect = false;

  constructor(configuration: AcquisitionConfiguration = SIMULATED_CONFIGURATION) { this.configuration = configuration; }

  subscribe(l: SourceListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  async connect(): Promise<void> {
    this.calls.push("connect");
    if (this.failConnect) throw new Error("placa no encontrada");
  }
  async disconnect(): Promise<void> { this.calls.push("disconnect"); }
  async startCapture(): Promise<void> { this.calls.push("startCapture"); }
  async stopCapture(): Promise<void> {
    this.calls.push("stopCapture");
    if (this.failStop) throw new Error("sin respuesta");
  }
  emit(payload: unknown): void { for (const l of this.listeners) l.onPayload(payload); }
  event(e: SourceEvent): void { for (const l of this.listeners) l.onEvent(e); }
}

export function payload(
  captureId: string,
  sequence: number,
  overrides: Partial<Record<string, unknown>> = {},
  configuration: AcquisitionConfiguration = SIMULATED_CONFIGURATION,
): unknown {
  const codes = configuration.channels.map((c) => c.code);
  return {
    format_version: FORMAT_VERSION,
    device_id: configuration.device_id,
    capture_id: captureId,
    configuration_id: configuration.configuration_id,
    sequence,
    samples: codes.map((c, i) => ({ channel_id: c, time_us: sequence * 20_000 + i * 400, raw_value: 100 + sequence + i, unit: "adc_count", status: "ok" })),
    ...overrides,
  };
}
