/**
 * Reloj inyectable. `nowIso` es tiempo civil (recepción, inicio/cierre);
 * `monotonicMs` es un reloj que no retrocede, para medir duraciones. Ninguno
 * de los dos sustituye al tiempo de adquisición (`time_us`) de la captura.
 */
export interface Clock {
  nowIso(): string;
  monotonicMs(): number;
}

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
  monotonicMs: () => globalThis.performance?.now?.() ?? Date.now(),
};
