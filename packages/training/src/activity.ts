import type { RoutineItem, WorkoutEntry } from "./types";

/**
 * Actividad unificada (ADR 0013, ajuste 4/11): la rutina se ejecuta ejercicio
 * por ejercicio dentro de la sesión. Este módulo es la máquina de estados pura
 * (sin reloj propio ni base): el cursor (ejercicio y serie en curso), el
 * descanso entre series y el cronómetro de caminata. La app la persiste y le
 * pasa `now` para que las pruebas sean deterministas.
 */

/** Descanso por defecto entre series cuando el ejercicio no declara uno. */
export const DEFAULT_REST_S = 90;

export interface ActivityCursor {
  /** Índice del ejercicio en la rutina (0..n-1). */
  readonly itemIndex: number;
  /** Serie que toca ahora (1..sets). */
  readonly setIndex: number;
}

export interface RestState {
  readonly item_id: string;
  readonly duration_s: number;
  /** Instante en ms (reloj del teléfono) en que termina. */
  readonly ends_at: number;
}

export interface WalkState {
  /** Instante en que arrancó el tramo en curso; null si está en pausa. */
  readonly started_at: number | null;
  /** Segundos acumulados de tramos anteriores. */
  readonly accumulated_s: number;
}

export interface ActivityState {
  /** null cuando no quedan ejercicios pendientes (rutina completa) o no hay rutina. */
  readonly cursor: ActivityCursor | null;
  readonly rest: RestState | null;
  readonly walk: WalkState | null;
}

/** Series objetivo de un ejercicio: las declaradas para fuerza, una para caminata u otro. */
export function targetSets(item: RoutineItem): number {
  return item.target.kind === "strength" ? item.target.sets : 1;
}

/** Series ya declaradas de un ejercicio. */
export function doneSets(item: RoutineItem, entries: readonly WorkoutEntry[]): number {
  return entries.filter((e) => e.item_id === item.id).length;
}

/** Primer ejercicio, en orden, con series pendientes; null si la rutina está completa. */
export function nextCursor(items: readonly RoutineItem[], entries: readonly WorkoutEntry[]): ActivityCursor | null {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i]!;
    const done = doneSets(item, entries);
    if (done < targetSets(item)) return { itemIndex: i, setIndex: done + 1 };
  }
  return null;
}

export function createActivity(items: readonly RoutineItem[], entries: readonly WorkoutEntry[]): ActivityState {
  return { cursor: nextCursor(items, entries), rest: null, walk: null };
}

/** Descanso declarado del ejercicio (null → por defecto; 0 → sin descanso). */
export function restSecondsOf(item: RoutineItem): number {
  return item.rest_sec === null ? DEFAULT_REST_S : item.rest_sec;
}

/**
 * Se declaró una serie del ejercicio en curso: avanza el cursor y abre el
 * descanso si el ejercicio lo tiene y todavía quedan series (de este u otro
 * ejercicio). `entries` ya incluye la serie recién guardada.
 */
export function completeSet(state: ActivityState, items: readonly RoutineItem[], entries: readonly WorkoutEntry[], now: number): ActivityState {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const current = state.cursor ? ordered[state.cursor.itemIndex] : undefined;
  const cursor = nextCursor(items, entries);
  const restS = current ? restSecondsOf(current) : 0;
  const rest: RestState | null = current && cursor && restS > 0 ? { item_id: current.id, duration_s: restS, ends_at: now + restS * 1000 } : null;
  return { cursor, rest, walk: null };
}

/**
 * ¿Se puede pasar a otra serie o ejercicio? No mientras corre el descanso
 * (pulido 4/11): primero termina o se salta explícitamente con «Saltar
 * descanso», así el contador nunca queda corriendo para un ejercicio que ya
 * no es el actual.
 */
export function isResting(state: ActivityState, now: number): boolean {
  return state.rest !== null && now < state.rest.ends_at;
}
export function canAdvance(state: ActivityState, now: number): boolean {
  return !isResting(state, now);
}

/**
 * Salta a un ejercicio concreto (la persona elige otro orden); la serie es la
 * siguiente pendiente de ese ejercicio. Con el descanso corriendo no hace
 * nada: se cancela sólo con `skipRest`.
 */
export function jumpTo(state: ActivityState, items: readonly RoutineItem[], entries: readonly WorkoutEntry[], itemIndex: number, now: number = Date.now()): ActivityState {
  if (isResting(state, now)) return state;
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const item = ordered[itemIndex];
  if (!item) return state;
  return { cursor: { itemIndex, setIndex: Math.min(doneSets(item, entries) + 1, targetSets(item)) }, rest: null, walk: null };
}

export function skipRest(state: ActivityState): ActivityState {
  return { ...state, rest: null };
}

/** Segundos que faltan del descanso (0 si terminó o no hay). */
export function restRemaining(state: ActivityState, now: number): number {
  if (!state.rest) return 0;
  return Math.max(0, Math.ceil((state.rest.ends_at - now) / 1000));
}

/** El descanso terminó: se limpia solo cuando el reloj lo supera. */
export function tick(state: ActivityState, now: number): ActivityState {
  if (state.rest && now >= state.rest.ends_at) return { ...state, rest: null };
  return state;
}

// ---------------------------------------------------------------- caminata / carrera

export function walkStart(state: ActivityState, now: number): ActivityState {
  const walk = state.walk ?? { started_at: null, accumulated_s: 0 };
  if (walk.started_at !== null) return state;
  return { ...state, rest: null, walk: { ...walk, started_at: now } };
}

export function walkPause(state: ActivityState, now: number): ActivityState {
  if (!state.walk || state.walk.started_at === null) return state;
  return { ...state, walk: { started_at: null, accumulated_s: state.walk.accumulated_s + (now - state.walk.started_at) / 1000 } };
}

/** Segundos transcurridos de la caminata (tramos anteriores + el que corre). */
export function walkElapsed(state: ActivityState, now: number): number {
  if (!state.walk) return 0;
  return Math.round(state.walk.accumulated_s + (state.walk.started_at !== null ? (now - state.walk.started_at) / 1000 : 0));
}

export function walkReset(state: ActivityState): ActivityState {
  return { ...state, walk: null };
}

/** Segundos que faltan para el objetivo de tiempo de una caminata (0 si no hay objetivo o ya se cumplió). */
export function walkRemaining(item: RoutineItem, state: ActivityState, now: number): number {
  if (item.target.kind !== "walk_run" || item.target.duration_min === null) return 0;
  return Math.max(0, Math.round(item.target.duration_min * 60) - walkElapsed(state, now));
}

/** Texto del cursor para cabeceras y para el asistente: «Ejercicio 2 de 5 · Sentadilla · serie 1 de 3». */
export function describeCursor(items: readonly RoutineItem[], cursor: ActivityCursor | null): string {
  if (!cursor) return items.length ? "Rutina completa" : "Sin rutina";
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const item = ordered[cursor.itemIndex];
  if (!item) return "Sin rutina";
  const sets = targetSets(item);
  return `Ejercicio ${cursor.itemIndex + 1} de ${ordered.length} · ${item.name}${sets > 1 ? ` · serie ${cursor.setIndex} de ${sets}` : ""}`;
}
