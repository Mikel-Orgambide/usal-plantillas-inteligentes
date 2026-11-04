import {
  FORMAT_VERSION,
  SIMULATED_CONFIGURATION,
  type AcquisitionConfiguration,
  type SourceEvent,
} from "@plantillas/contract";
import { createRng, type Rng } from "./random";
import { DEFAULT_SIGNAL, sampleValue, type SignalParams } from "./signal";
import { SCENARIOS, type Fault, type Scenario } from "./scenario";

/**
 * Generador determinista de payloads.
 *
 * Es un iterador puro: no usa temporizadores ni estado global. Con la misma
 * semilla, escenario y parámetros produce exactamente la misma secuencia de
 * salidas, lo que permite fijar fixtures y comparar ejecuciones.
 */

export interface GeneratorOptions {
  readonly seed: number;
  /** Intervalo entre registros en microsegundos. Parámetro del generador, no una frecuencia del ESP32. */
  readonly record_period_us: number;
  /** Desfase simulado entre lecturas consecutivas de un mismo registro (µs). */
  readonly channel_offset_us: number;
  readonly configuration: AcquisitionConfiguration;
  readonly scenario: Scenario;
  readonly signal: SignalParams;
  /** Prefijo para los capture_id generados. */
  readonly capture_prefix: string;
  /**
   * Deriva simulada del reloj de la fuente, en partes por millón: `time_us`
   * avanza (1 + ppm/1e6) veces más rápido que el período nominal. Sirve para
   * probar dos módulos con relojes distintos (ADR 0011). 0 = sin deriva.
   */
  readonly clock_drift_ppm: number;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  seed: 1,
  record_period_us: 20_000,
  channel_offset_us: 400,
  configuration: SIMULATED_CONFIGURATION,
  scenario: SCENARIOS.normal,
  signal: DEFAULT_SIGNAL,
  capture_prefix: "SIM-CAPTURE",
  clock_drift_ppm: 0,
};

export type GeneratorOutput =
  | { readonly kind: "payload"; readonly payload: unknown }
  | { readonly kind: "event"; readonly event: SourceEvent };

interface CaptureState {
  capture_id: string;
  sequence: number;
  /** Tiempo relativo de la captura en curso. */
  time_us: number;
}

export class SimulatedGenerator implements Iterator<GeneratorOutput> {
  readonly options: GeneratorOptions;
  private readonly rng: Rng;
  private capture: CaptureState;
  private captureIndex = 1;
  /** Registros generados en total (incluye los no emitidos por desconexión). */
  private generated = 0;
  private pending: GeneratorOutput[] = [];
  private disconnected = false;
  /** Fallas de una sola vez ya aplicadas (reinicio de captura). */
  private restartsApplied = 0;

  constructor(options: Partial<GeneratorOptions> = {}) {
    this.options = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
    this.rng = createRng(this.options.seed);
    this.capture = { capture_id: this.captureId(1), sequence: 0, time_us: 0 };
    this.pending.push({
      kind: "event",
      event: { type: "capture_started", at_us: 0, capture_id: this.capture.capture_id },
    });
  }

  get currentCaptureId(): string {
    return this.capture.capture_id;
  }

  private captureId(index: number): string {
    return `${this.options.capture_prefix}-${String(this.options.seed).padStart(4, "0")}-${String(index).padStart(3, "0")}`;
  }

  private faultsAt<K extends Fault["kind"]>(kind: K): Extract<Fault, { kind: K }>[] {
    return this.options.scenario.faults.filter((f): f is Extract<Fault, { kind: K }> => f.kind === kind);
  }

  next(): IteratorResult<GeneratorOutput> {
    const queued = this.pending.shift();
    if (queued) return { value: queued, done: false };
    this.produce();
    const out = this.pending.shift();
    if (!out) throw new Error("el generador no produjo salida");
    return { value: out, done: false };
  }

  [Symbol.iterator](): Iterator<GeneratorOutput> {
    return this;
  }

  /** Genera el siguiente registro y encola payloads/eventos según el escenario. */
  private produce(): void {
    const seq = this.capture.sequence;
    const t0 = this.capture.time_us;

    // Desconexión: la fuente sigue adquiriendo (secuencia avanza) pero no transmite.
    const disconnect = this.faultsAt("disconnect").find((f) => seq >= f.from_sequence && seq <= f.to_sequence);
    if (disconnect && !this.disconnected) {
      this.disconnected = true;
      this.pending.push({ kind: "event", event: { type: "disconnected", at_us: t0, reason: "simulated_link_loss" } });
    }
    if (!disconnect && this.disconnected) {
      this.disconnected = false;
      this.pending.push({ kind: "event", event: { type: "reconnected", at_us: t0 } });
    }

    const payload = this.buildPayload(seq, t0);
    this.generated += 1;

    if (!this.disconnected) {
      this.pending.push({ kind: "payload", payload });
      if (this.faultsAt("duplicate").some((f) => f.at_sequence === seq)) {
        this.pending.push({ kind: "payload", payload: cloneJson(payload) });
      }
      if (this.faultsAt("conflict").some((f) => f.at_sequence === seq)) {
        const altered = cloneJson(payload) as { samples: { raw_value: number | null }[] };
        const first = altered.samples[0];
        if (first && typeof first.raw_value === "number") first.raw_value = first.raw_value + 1;
        this.pending.push({ kind: "payload", payload: altered });
      }
    }

    // Avance de secuencia y tiempo.
    const gap = this.faultsAt("sequence_gap").find((f) => f.after_sequence === seq);
    const step = gap ? gap.skip + 1 : 1;
    this.capture.sequence = seq + step;
    this.capture.time_us = t0 + Math.round(step * this.options.record_period_us * (1 + this.options.clock_drift_ppm / 1e6));

    // El reinicio se aplica una sola vez por falla: la captura nueva vuelve a secuencia 0
    // y no debe disparar la misma falla otra vez.
    const restart = this.faultsAt("capture_restart")[this.restartsApplied];
    if (restart && restart.after_sequence === seq) {
      this.restartsApplied += 1;
      const previous = this.capture.capture_id;
      this.captureIndex += 1;
      this.capture = { capture_id: this.captureId(this.captureIndex), sequence: 0, time_us: 0 };
      this.pending.push({
        kind: "event",
        event: { type: "capture_restarted", at_us: t0, capture_id: this.capture.capture_id, previous_capture_id: previous },
      });
    }

    if (this.pending.length === 0) {
      // Registro suprimido por desconexión: producir el siguiente hasta emitir algo.
      this.produce();
    }
  }

  private buildPayload(seq: number, t0: number): unknown {
    const { configuration, signal, channel_offset_us } = this.options;
    const readErrors = this.faultsAt("read_error").filter((f) => f.at_sequence === seq);
    const contradictions = this.faultsAt("contradiction").filter((f) => f.at_sequence === seq);
    const missing = this.faultsAt("missing_channel").filter((f) => f.at_sequence === seq);

    const samples = configuration.channels
      .filter((ch) => !missing.some((m) => m.channel === ch.code))
      .map((ch, i) => {
        const time_us = t0 + i * channel_offset_us;
        const value = sampleValue(ch.code, time_us, signal, configuration.raw_range, this.rng);
        if (readErrors.some((f) => f.channel === ch.code)) {
          return { channel_id: ch.code, time_us, raw_value: null, unit: ch.unit, status: "read_error" };
        }
        if (contradictions.some((f) => f.channel === ch.code)) {
          return { channel_id: ch.code, time_us, raw_value: null, unit: ch.unit, status: "ok" };
        }
        return { channel_id: ch.code, time_us, raw_value: value, unit: ch.unit, status: "ok" };
      });

    return {
      format_version: FORMAT_VERSION,
      device_id: configuration.device_id,
      capture_id: this.capture.capture_id,
      configuration_id: configuration.configuration_id,
      sequence: seq,
      samples,
    };
  }
}

/** Toma las primeras `count` salidas del generador. */
export function take(generator: SimulatedGenerator, count: number): GeneratorOutput[] {
  const out: GeneratorOutput[] = [];
  for (let i = 0; i < count; i++) out.push(generator.next().value);
  return out;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
