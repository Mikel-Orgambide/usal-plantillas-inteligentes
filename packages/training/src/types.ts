/**
 * Rutinas y entrenamiento (ADR 0013, etapa 15).
 *
 * El módulo organiza y registra lo que el usuario declara: una rutina (propia
 * o indicada por un profesional), sus ejercicios con valores objetivo, y las
 * ejecuciones (entrenamientos) con lo realmente hecho por serie. Lo que la
 * app no mide (repeticiones, pesos, esfuerzo percibido, molestias) se anota;
 * lo que sí mide (las sesiones de plantillas) se vincula a un ejercicio o a
 * una serie. No prescribe rutinas, no ajusta cargas ni interpreta el dolor.
 */

export type RoutineOrigin = "own" | "professional";
export type ItemKind = "strength" | "walk_run" | "other";
export type WorkoutState = "planned" | "in_progress" | "completed";

export interface Routine {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
  readonly goal: string | null;
  readonly origin: RoutineOrigin;
  /** Indicaciones del profesional que la entregó (texto libre, declarado por el usuario). */
  readonly professional_note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly archived: boolean;
}

export interface StrengthTarget { readonly kind: "strength"; readonly sets: number; readonly reps: number; readonly weight_kg: number | null }
export interface WalkRunTarget { readonly kind: "walk_run"; readonly duration_min: number | null; readonly distance_km: number | null; readonly pace_note: string | null }
export interface OtherTarget { readonly kind: "other"; readonly instructions: string }
export type ItemTarget = StrengthTarget | WalkRunTarget | OtherTarget;

export interface RoutineItem {
  readonly id: string;
  readonly routine_id: string;
  readonly order: number;
  readonly kind: ItemKind;
  readonly name: string;
  readonly target: ItemTarget;
  readonly instructions: string | null;
  readonly rest_sec: number | null;
}

export interface Workout {
  readonly id: string;
  readonly user_id: string;
  readonly routine_id: string | null;
  /** Fecha local del entrenamiento, `YYYY-MM-DD`. */
  readonly date: string;
  readonly started_at: string | null;
  readonly ended_at: string | null;
  readonly state: WorkoutState;
  readonly notes: string | null;
}

export interface WorkoutEntry {
  readonly id: string;
  readonly workout_id: string;
  readonly item_id: string | null;
  /** Nombre del ejercicio copiado al momento de registrar (la rutina puede cambiar después). */
  readonly item_name: string;
  readonly kind: ItemKind;
  readonly set_index: number | null;
  readonly reps: number | null;
  readonly weight_kg: number | null;
  readonly duration_s: number | null;
  readonly distance_m: number | null;
  /** Esfuerzo percibido 1–10, declarado por el usuario. */
  readonly rpe: number | null;
  /** Molestia o dolor como nota libre del usuario: se guarda tal cual, no se interpreta ni se mide. */
  readonly discomfort_note: string | null;
  readonly notes: string | null;
  readonly recorded_at: string;
}

/** Vínculo entre una sesión de plantillas (lo medido) y un entrenamiento (lo declarado), opcionalmente con una serie. */
export interface SessionLink {
  readonly session_id: string;
  readonly workout_id: string;
  readonly entry_id: string | null;
}
