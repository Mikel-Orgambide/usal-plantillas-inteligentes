import { useSyncExternalStore } from "react";
import {
  canAdvance, completeSet, createActivity, describeCursor, jumpTo, restRemaining, skipRest, targetSets, tick, walkElapsed, walkPause, walkRemaining, walkReset, walkStart,
  type ActivityState, type RoutineItem, type WorkoutEntry,
} from "@plantillas/training";
import { addEntry, deleteEntry, finishWorkout, getWorkout, linkSession, setCurrentCursorText, startWorkout, todayWorkout, type EntryDraft, type WorkoutDetail } from "./trainingStore";
import { getRecordingSessionId } from "./sessionStore";

/**
 * Actividad unificada (ADR 0013, ajuste 4/11): el entrenamiento en curso se
 * ejecuta ejercicio por ejercicio desde la misma pantalla que la medición.
 * Vive fuera de React para que el cursor, el descanso y el cronómetro de
 * caminata sigan corriendo al cambiar de pantalla; las pantallas se
 * suscriben. La máquina de estados es pura (`@plantillas/training`): acá sólo
 * se persiste y se le pasa el reloj.
 */

export interface ActivityRun {
  readonly detail: WorkoutDetail;
  readonly items: readonly RoutineItem[];
  readonly state: ActivityState;
  /** Instante del último tick, para que las pantallas rediseñen una vez por segundo. */
  readonly now: number;
}

let run: ActivityRun | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function emit(): void { for (const l of listeners) l(); }
function subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

export function useActivity(): ActivityRun | null {
  return useSyncExternalStore(subscribe, () => run, () => run);
}
export function getActivity(): ActivityRun | null { return run; }

function needsClock(r: ActivityRun | null): boolean {
  return !!r && (r.state.rest !== null || (r.state.walk !== null && r.state.walk.started_at !== null));
}

function syncClock(): void {
  if (needsClock(run) && !timer) {
    timer = setInterval(() => {
      if (!run) return;
      run = { ...run, state: tick(run.state, Date.now()), now: Date.now() };
      emit();
      if (!needsClock(run)) syncClock();
    }, 1000);
  } else if (!needsClock(run) && timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

function publish(next: ActivityRun | null): void {
  run = next;
  setCurrentCursorText(next ? describeCursor(next.items, next.state.cursor) : undefined);
  emit();
  syncClock();
}

async function load(workoutId: string, keepState?: ActivityState): Promise<ActivityRun | null> {
  const detail = await getWorkout(workoutId);
  if (!detail || detail.workout.state === "completed") return null;
  const items = [...(detail.routine?.items ?? [])].sort((a, b) => a.order - b.order);
  const state = keepState ? { ...keepState, cursor: createActivity(items, detail.entries).cursor } : createActivity(items, detail.entries);
  return { detail, items, state, now: Date.now() };
}

/** Inicia (o retoma, si ya hay uno en curso) el entrenamiento de hoy con la rutina elegida, o libre. */
export async function startActivity(routineId: string | null): Promise<string> {
  const id = await startWorkout(routineId);
  publish(await load(id));
  return id;
}

/** Al abrir la app: si quedó un entrenamiento en curso, vuelve a estar disponible. */
export async function resumeActivity(): Promise<void> {
  if (run) return;
  const today = await todayWorkout();
  if (today && today.workout.state === "in_progress") publish(await load(today.workout.id));
}

/** Vincula la sesión de plantillas en curso con el entrenamiento activo (una vez por sesión). */
export async function attachRecordingSession(): Promise<void> {
  const sessionId = getRecordingSessionId();
  if (!run || !sessionId) return;
  if (run.detail.links.some((l) => l.session_id === sessionId)) return;
  await linkSession(sessionId, run.detail.workout.id, null);
  publish(await load(run.detail.workout.id, run.state));
}

/** Ejercicio y serie en curso, o null si la rutina está completa o no hay rutina. */
export function currentItem(r: ActivityRun | null): { item: RoutineItem; setIndex: number; sets: number; index: number } | null {
  if (!r || !r.state.cursor) return null;
  const item = r.items[r.state.cursor.itemIndex];
  if (!item) return null;
  return { item, setIndex: r.state.cursor.setIndex, sets: targetSets(item), index: r.state.cursor.itemIndex };
}

/** Borrador precargado con los objetivos de la serie en curso (o del ejercicio dado). */
export function draftForCurrent(r: ActivityRun, cur: { item: RoutineItem; setIndex: number }, elapsedWalkS?: number): EntryDraft {
  const t = cur.item.target;
  const prev = [...r.detail.entries].reverse().find((e) => e.item_id === cur.item.id);
  return {
    item_id: cur.item.id, item_name: cur.item.name, kind: cur.item.kind, set_index: cur.setIndex,
    reps: t.kind === "strength" ? (prev?.reps ?? t.reps) : null,
    // El peso se precarga con el de la última serie declarada (si lo bajó por cansancio, se mantiene) o el objetivo.
    weight_kg: t.kind === "strength" ? (prev?.weight_kg ?? t.weight_kg) : null,
    duration_s: t.kind === "walk_run" ? (elapsedWalkS ?? (t.duration_min !== null ? Math.round(t.duration_min * 60) : null)) : t.kind === "other" ? null : null,
    distance_m: t.kind === "walk_run" && t.distance_km !== null ? Math.round(t.distance_km * 1000) : null,
    rpe: null, discomfort_note: null, notes: null,
  };
}

/** Declara la serie en curso (con lo que la persona corrigió), la vincula a la sesión que graba y abre el descanso. */
let declaring = false;
export async function declareSet(draft: EntryDraft): Promise<string[]> {
  if (!run) return ["no hay un entrenamiento en curso"];
  // Con el descanso corriendo no se pasa a la siguiente serie (pulido 4/11): primero «Saltar descanso».
  if (!canAdvance(run.state, Date.now())) return ["terminá o saltá el descanso antes de la siguiente serie"];
  // Doble toque en «Listo»: una sola serie.
  if (declaring) return [];
  declaring = true;
  try { return await declareSetNow(draft); } finally { declaring = false; }
}

async function declareSetNow(draft: EntryDraft): Promise<string[]> {
  if (!run) return ["no hay un entrenamiento en curso"];
  const sessionId = getRecordingSessionId() ?? null;
  const r = await addEntry(run.detail.workout.id, draft, sessionId);
  if (r.errors.length) return r.errors;
  if (sessionId) await attachRecordingSession();
  const detail = await getWorkout(run.detail.workout.id);
  if (!detail) return ["no se pudo releer el entrenamiento"];
  const items = run.items;
  const state = completeSet(run.state, items, detail.entries, Date.now());
  publish({ detail, items, state, now: Date.now() });
  return [];
}

/** Serie fuera de la rutina (entrenamiento libre o ejercicio extra): se declara sin mover el cursor. */
export async function declareFreeEntry(draft: EntryDraft): Promise<string[]> {
  if (!run) return ["no hay un entrenamiento en curso"];
  const sessionId = getRecordingSessionId() ?? null;
  const r = await addEntry(run.detail.workout.id, draft, sessionId);
  if (r.errors.length) return r.errors;
  if (sessionId) await attachRecordingSession();
  publish(await load(run.detail.workout.id, run.state));
  return [];
}

export function skipRestNow(): void { if (run) publish({ ...run, state: skipRest(run.state) }); }
/** Salta a otro ejercicio. Devuelve false si no se pudo porque corre el descanso. */
export function jumpToItem(index: number): boolean {
  if (!run) return false;
  const now = Date.now();
  if (!canAdvance(run.state, now)) return false;
  publish({ ...run, state: jumpTo(run.state, run.items, run.detail.entries, index, now) });
  return true;
}
/** Borra una serie declarada y refresca el cursor (la serie vuelve a quedar pendiente). */
export async function removeEntry(id: string): Promise<void> {
  await deleteEntry(id);
  await refreshActivity();
}
export function walkToggle(): void {
  if (!run) return;
  const now = Date.now();
  const running = run.state.walk?.started_at !== null && run.state.walk !== null;
  publish({ ...run, state: running ? walkPause(run.state, now) : walkStart(run.state, now), now });
}
export function walkDiscard(): void { if (run) publish({ ...run, state: walkReset(run.state) }); }

export const restLeft = (r: ActivityRun): number => restRemaining(r.state, r.now);
export const walkSeconds = (r: ActivityRun): number => walkElapsed(r.state, r.now);
export const walkLeft = (r: ActivityRun, item: RoutineItem): number => walkRemaining(item, r.state, r.now);
export const cursorLabel = (r: ActivityRun): string => describeCursor(r.items, r.state.cursor);

/** Cierra el entrenamiento en curso; si quedó vacío se descarta (ver `finishWorkout`). */
export async function finishActivity(notes?: string): Promise<"completed" | "discarded" | "none"> {
  if (!run) return "none";
  const id = run.detail.workout.id;
  publish(null);
  const r = await finishWorkout(id, notes);
  return r === "missing" ? "none" : r;
}
/** ¿El entrenamiento en curso todavía no tiene ninguna serie ni entrada? */
export const isEmptyRun = (r: ActivityRun | null): boolean => !!r && r.detail.entries.length === 0;

/** Refresca desde la base (p. ej. tras cargar una serie por el asistente). */
export async function refreshActivity(): Promise<void> {
  if (!run) return;
  const next = await load(run.detail.workout.id, run.state);
  publish(next);
}

export type { WorkoutEntry };
