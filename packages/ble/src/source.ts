import type { AcquisitionConfiguration, DataSource, SourceEvent, SourceListener } from "@plantillas/contract";
import type { BleLink } from "./link";
import {
  COMMAND_START, COMMAND_STOP, CONTROL_UUID, MEASUREMENT_UUID, MIN_MTU, ProtocolError, STATUS_UUID,
  decodeMeasurement, parseStatus, type DeviceInfo,
} from "./protocol";

export interface BleSourceOptions {
  /** Espera máxima de la confirmación de la placa a start/stop. Una orden enviada no acredita captura iniciada. */
  readonly ackTimeoutMs?: number;
  /** Intenta recuperar el enlace tras un corte. Si no se indica, el corte queda como desconexión. */
  readonly reconnect?: () => Promise<BleLink>;
  readonly reconnectAttempts?: number;
  readonly reconnectDelayMs?: number;
  readonly now?: () => number;
}

/**
 * Fuente física: la misma interfaz que el simulador, sobre la plantilla real.
 * Traduce notificaciones a payloads del contrato (sin validar) y estados de la
 * placa a eventos de fuente. El coordinador y la persistencia no cambian.
 */
export class BleDataSource implements DataSource {
  readonly configuration: AcquisitionConfiguration;
  private link: BleLink;
  private readonly info: Pick<DeviceInfo, "device_id" | "configuration_id">;
  private readonly opts: Required<Omit<BleSourceOptions, "reconnect">> & Pick<BleSourceOptions, "reconnect">;
  private listeners = new Set<SourceListener>();
  private stopMonitors: Array<() => Promise<void>> = [];
  private offDisconnect: (() => void) | undefined;
  private connected = false;
  private capturing = false;
  private requestedDisconnect = false;
  private waiters: Array<{ event: string; resolve: (captureId: string) => void }> = [];
  private t0 = 0;
  private currentCaptureId: string | undefined;
  /** Notificaciones que no se pudieron decodificar (tamaño o versión): se cuentan, no se descartan en silencio. */
  decodeErrors = 0;

  constructor(link: BleLink, configuration: AcquisitionConfiguration, info: Pick<DeviceInfo, "device_id" | "configuration_id">, options: BleSourceOptions = {}) {
    this.link = link;
    this.configuration = configuration;
    this.info = info;
    this.opts = {
      ackTimeoutMs: options.ackTimeoutMs ?? 3000,
      reconnectAttempts: options.reconnectAttempts ?? 5,
      reconnectDelayMs: options.reconnectDelayMs ?? 2000,
      now: options.now ?? (() => Date.now()),
      ...(options.reconnect ? { reconnect: options.reconnect } : {}),
    };
  }

  subscribe(listener: SourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.link.mtu < MIN_MTU) {
      throw new ProtocolError(`MTU negociado ${this.link.mtu}: no alcanza para un registro (${MIN_MTU} mínimo)`);
    }
    this.t0 = this.opts.now();
    this.requestedDisconnect = false;
    await this.attach();
    this.connected = true;
    this.emitEvent({ type: "connected", at_us: 0 });
  }

  async disconnect(): Promise<void> {
    await this.stopCapture();
    this.requestedDisconnect = true;
    await this.detach();
    if (!this.connected) return;
    this.connected = false;
    this.emitEvent({ type: "disconnected", at_us: this.atUs(), reason: "requested" });
  }

  async startCapture(): Promise<void> {
    if (!this.connected) throw new Error("la fuente no está conectada");
    if (this.capturing) return;
    const ack = this.waitFor("capture_started");
    await this.link.write(CONTROL_UUID, [COMMAND_START]);
    const captureId = await ack;
    this.capturing = true;
    this.currentCaptureId = captureId;
    this.emitEvent({ type: "capture_started", at_us: this.atUs(), capture_id: captureId });
  }

  async stopCapture(): Promise<void> {
    if (!this.capturing) return;
    this.capturing = false;
    try {
      const ack = this.waitFor("capture_stopped");
      await this.link.write(CONTROL_UUID, [COMMAND_STOP]);
      const captureId = await ack;
      this.emitEvent({ type: "capture_stopped", at_us: this.atUs(), capture_id: captureId });
    } catch (error) {
      // Sin confirmación (p. ej. enlace cortado): se informa; la sesión se cierra igual con lo recibido.
      this.emitEvent({ type: "source_error", at_us: this.atUs(), message: `la placa no confirmó la detención: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  private async attach(): Promise<void> {
    this.stopMonitors.push(await this.link.monitor(STATUS_UUID, (v) => this.onStatus(v)));
    this.stopMonitors.push(await this.link.monitor(MEASUREMENT_UUID, (v) => this.onMeasurement(v)));
    this.offDisconnect = this.link.onDisconnected((reason) => void this.onLinkLost(reason));
  }

  private async detach(): Promise<void> {
    this.offDisconnect?.();
    this.offDisconnect = undefined;
    const stops = this.stopMonitors;
    this.stopMonitors = [];
    for (const s of stops) { try { await s(); } catch { /* el enlace pudo haberse cortado */ } }
  }

  private onMeasurement(value: readonly number[]): void {
    let payload: unknown;
    try {
      payload = decodeMeasurement(value, this.info);
    } catch {
      this.decodeErrors += 1;
      return;
    }
    for (const l of this.listeners) l.onPayload(payload);
  }

  private onStatus(value: readonly number[]): void {
    const msg = parseStatus(value);
    if (msg.event === "other") return;
    const pending = this.waiters.filter((w) => w.event === msg.event);
    this.waiters = this.waiters.filter((w) => w.event !== msg.event);
    for (const w of pending) w.resolve(msg.capture_id);
  }

  private waitFor(event: "capture_started" | "capture_stopped"): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const waiter = { event, resolve: (id: string) => { clearTimeout(timer); resolve(id); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`sin confirmación de ${event} en ${this.opts.ackTimeoutMs} ms`));
      }, this.opts.ackTimeoutMs);
      this.waiters.push(waiter);
    });
  }

  private async onLinkLost(reason: string): Promise<void> {
    if (this.requestedDisconnect || !this.connected) return;
    this.offDisconnect?.();
    this.offDisconnect = undefined;
    this.stopMonitors = [];
    this.emitEvent({ type: "disconnected", at_us: this.atUs(), reason });
    if (!this.opts.reconnect) { this.connected = false; this.capturing = false; return; }
    for (let attempt = 1; attempt <= this.opts.reconnectAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, this.opts.reconnectDelayMs));
      if (this.requestedDisconnect) return;
      try {
        this.link = await this.opts.reconnect();
        await this.attach();
        this.emitEvent({ type: "reconnected", at_us: this.atUs() });
        if (this.capturing) await this.resumeCapture();
        return;
      } catch { /* siguiente intento */ }
    }
    this.connected = false;
    this.capturing = false;
    this.emitEvent({ type: "source_error", at_us: this.atUs(), message: `no se pudo reconectar tras ${this.opts.reconnectAttempts} intentos` });
  }

  /**
   * Tras reconectar, se reenvía start. La placa confirma con el capture_id
   * vigente: si es el mismo, siguió capturando durante el corte (lo perdido
   * es un hueco de secuencia); si es otro (p. ej. se reinició), es una captura
   * nueva y se informa como reinicio para que no se mezcle con la anterior.
   */
  private async resumeCapture(): Promise<void> {
    try {
      const ack = this.waitFor("capture_started");
      await this.link.write(CONTROL_UUID, [COMMAND_START]);
      const captureId = await ack;
      if (captureId !== this.currentCaptureId) {
        const previous = this.currentCaptureId ?? "";
        this.currentCaptureId = captureId;
        this.emitEvent({ type: "capture_restarted", at_us: this.atUs(), capture_id: captureId, previous_capture_id: previous });
      }
    } catch (error) {
      this.emitEvent({ type: "source_error", at_us: this.atUs(), message: `la placa no confirmó la captura al reconectar: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  private atUs(): number {
    return Math.max(0, Math.round((this.opts.now() - this.t0) * 1000));
  }

  private emitEvent(event: SourceEvent): void {
    for (const l of this.listeners) l.onEvent(event);
  }
}
