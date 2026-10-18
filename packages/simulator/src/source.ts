import type { AcquisitionConfiguration, DataSource, SourceEvent, SourceListener } from "@plantillas/contract";
import { SimulatedGenerator, type GeneratorOptions } from "./generator";

/**
 * Fuente de datos simulada que implementa `DataSource` sobre el generador
 * determinista, emitiendo cada registro con un temporizador. El contenido es
 * reproducible; el instante real de emisión depende del temporizador del
 * teléfono y no forma parte del contrato.
 */
export interface SimulatedSourceOptions extends Partial<GeneratorOptions> {
  /** Intervalo real entre emisiones en milisegundos. Por defecto, record_period_us / 1000. */
  readonly emit_interval_ms?: number;
}

export class SimulatedDataSource implements DataSource {
  readonly configuration: AcquisitionConfiguration;
  private readonly options: SimulatedSourceOptions;
  private generator: SimulatedGenerator | undefined;
  private listeners = new Set<SourceListener>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private connected = false;

  constructor(options: SimulatedSourceOptions = {}) {
    this.options = options;
    this.configuration = new SimulatedGenerator(options).options.configuration;
  }

  get isCapturing(): boolean {
    return this.timer !== undefined;
  }

  subscribe(listener: SourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    this.emitEvent({ type: "connected", at_us: 0 });
  }

  async disconnect(): Promise<void> {
    await this.stopCapture();
    if (!this.connected) return;
    this.connected = false;
    this.emitEvent({ type: "disconnected", at_us: 0, reason: "requested" });
  }

  async startCapture(): Promise<void> {
    if (!this.connected) throw new Error("la fuente no está conectada");
    if (this.timer !== undefined) return;
    this.generator = new SimulatedGenerator(this.options);
    const interval = this.options.emit_interval_ms ?? this.generator.options.record_period_us / 1000;
    const tick = () => {
      if (!this.generator) return;
      // Vaciar eventos encolados y emitir exactamente un payload por tick.
      for (;;) {
        const out = this.generator.next().value;
        if (out.kind === "event") {
          this.emitEvent(out.event);
          continue;
        }
        this.emitPayload(out.payload);
        break;
      }
      this.timer = setTimeout(tick, interval);
    };
    this.timer = setTimeout(tick, 0);
  }

  async stopCapture(): Promise<void> {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    const captureId = this.generator?.currentCaptureId ?? "";
    this.generator = undefined;
    this.emitEvent({ type: "capture_stopped", at_us: 0, capture_id: captureId });
  }

  private emitPayload(payload: unknown): void {
    for (const l of this.listeners) l.onPayload(payload);
  }

  private emitEvent(event: SourceEvent): void {
    for (const l of this.listeners) l.onEvent(event);
  }
}
