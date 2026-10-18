/**
 * Modos de prueba del simulador. Cada escenario describe qué anomalías
 * introduce el generador y en qué número de registro. Un escenario `normal`
 * no introduce ninguna.
 */

export type Fault =
  /** Una muestra de `channel` sale con status read_error y raw_value null. */
  | { readonly kind: "read_error"; readonly at_sequence: number; readonly channel: string }
  /** No se emiten registros entre from y to (inclusive) y se emite un evento de desconexión. */
  | { readonly kind: "disconnect"; readonly from_sequence: number; readonly to_sequence: number }
  /** La secuencia salta: después de `after_sequence` el siguiente número es after + skip + 1. */
  | { readonly kind: "sequence_gap"; readonly after_sequence: number; readonly skip: number }
  /** El registro `at_sequence` se emite dos veces, idéntico. */
  | { readonly kind: "duplicate"; readonly at_sequence: number }
  /** El registro `at_sequence` se emite dos veces con contenido distinto (conflicto). */
  | { readonly kind: "conflict"; readonly at_sequence: number }
  /** Después de `after_sequence` la captura se reinicia: nuevo capture_id, tiempo y secuencia desde 0. */
  | { readonly kind: "capture_restart"; readonly after_sequence: number }
  /** El registro `at_sequence` viola el contrato: ok con null (contradicción). */
  | { readonly kind: "contradiction"; readonly at_sequence: number; readonly channel: string }
  /** El registro `at_sequence` omite el canal indicado. */
  | { readonly kind: "missing_channel"; readonly at_sequence: number; readonly channel: string };

export interface Scenario {
  readonly name: string;
  readonly faults: readonly Fault[];
}

export const SCENARIOS = {
  normal: { name: "normal", faults: [] },
  read_error: { name: "read_error", faults: [{ kind: "read_error", at_sequence: 3, channel: "R_LATERAL" }] },
  disconnect: { name: "disconnect", faults: [{ kind: "disconnect", from_sequence: 4, to_sequence: 6 }] },
  sequence_gap: { name: "sequence_gap", faults: [{ kind: "sequence_gap", after_sequence: 2, skip: 3 }] },
  duplicate: { name: "duplicate", faults: [{ kind: "duplicate", at_sequence: 2 }] },
  conflict: { name: "conflict", faults: [{ kind: "conflict", at_sequence: 2 }] },
  capture_restart: { name: "capture_restart", faults: [{ kind: "capture_restart", after_sequence: 3 }] },
  contradiction: { name: "contradiction", faults: [{ kind: "contradiction", at_sequence: 1, channel: "L_HEEL" }] },
  missing_channel: { name: "missing_channel", faults: [{ kind: "missing_channel", at_sequence: 1, channel: "L_MEDIAL" }] },
} as const satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof SCENARIOS;
