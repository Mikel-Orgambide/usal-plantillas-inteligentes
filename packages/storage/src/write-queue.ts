import type { NormalizedRecord } from "@plantillas/contract";
import type { InsertOutcome, SessionRepository } from "./repository";

/**
 * Cola de escritura: acumula registros normalizados y los guarda en lotes
 * acotados dentro de una transacción. La recepción no espera a la base: el
 * productor encola y sigue. `flush()` devuelve cuando lo pendiente está
 * confirmado (commit), que es el único momento en que se puede afirmar que
 * un dato está persistido.
 */

export interface WriteQueueOptions {
  /** Cantidad máxima de registros por transacción. */
  readonly batchSize: number;
  /** Tiempo máximo (ms) que un registro espera en cola antes de forzar un lote. */
  readonly maxLatencyMs: number;
  readonly onBatch?: (outcomes: readonly InsertOutcome[]) => void;
  readonly onError?: (error: unknown, records: readonly NormalizedRecord[]) => void;
}

export const DEFAULT_WRITE_QUEUE_OPTIONS: WriteQueueOptions = { batchSize: 25, maxLatencyMs: 250 };

export interface WriteQueueStats {
  readonly enqueued: number;
  readonly committed: number;
  readonly duplicates: number;
  readonly conflicts: number;
  readonly rejected: number;
  readonly failedBatches: number;
  readonly pending: number;
}

export class WriteQueue {
  private readonly options: WriteQueueOptions;
  private pending: NormalizedRecord[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> = Promise.resolve();
  private closed = false;
  private counters = { enqueued: 0, committed: 0, duplicates: 0, conflicts: 0, rejected: 0, failedBatches: 0 };

  constructor(
    private readonly repository: SessionRepository,
    private readonly captureId: number,
    options: Partial<WriteQueueOptions> = {},
  ) {
    this.options = { ...DEFAULT_WRITE_QUEUE_OPTIONS, ...options };
  }

  get stats(): WriteQueueStats {
    return { ...this.counters, pending: this.pending.length };
  }

  enqueue(record: NormalizedRecord): void {
    if (this.closed) throw new Error("la cola está cerrada");
    this.pending.push(record);
    this.counters.enqueued += 1;
    if (this.pending.length >= this.options.batchSize) {
      this.scheduleFlush(0);
    } else if (this.timer === undefined) {
      this.scheduleFlush(this.options.maxLatencyMs);
    }
  }

  /** Guarda todo lo pendiente y espera la confirmación. */
  async flush(): Promise<void> {
    this.clearTimer();
    await this.drain();
  }

  /** Vacía la cola y la deja inutilizable. */
  async close(): Promise<void> {
    await this.flush();
    this.closed = true;
  }

  private scheduleFlush(delay: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /** Serializa los lotes: nunca hay dos transacciones de esta cola a la vez. */
  private drain(): Promise<void> {
    this.inFlight = this.inFlight.then(async () => {
      while (this.pending.length > 0) {
        const batch = this.pending.splice(0, this.options.batchSize);
        try {
          const outcomes = await this.repository.insertRecords(this.captureId, batch);
          for (const o of outcomes) {
            if (o.outcome === "inserted") this.counters.committed += 1;
            else if (o.outcome === "duplicate") this.counters.duplicates += 1;
            else if (o.outcome === "conflict") this.counters.conflicts += 1;
            else this.counters.rejected += 1;
          }
          this.options.onBatch?.(outcomes);
        } catch (error) {
          this.counters.failedBatches += 1;
          this.options.onError?.(error, batch);
        }
      }
    });
    return this.inFlight;
  }
}
