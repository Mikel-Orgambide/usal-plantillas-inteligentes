import { useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import {
  askForMissing, describeEntry, proposalMissing, summarizeWorkout, validateEntry, validateItem, validateProposal, validateRoutine,
  isRoutineCategory,
  type ItemKind, type ItemTarget, type LogEntryProposal, type Routine, type RoutineCategory, type RoutineItem, type SessionLink, type Workout, type WorkoutEntry, type WorkoutSummary,
} from "@plantillas/training";
import type { AssistantTrainingInput, AssistantWorkoutInput } from "@plantillas/assistant";
import { TrainingRepository, type RoutineItemRow } from "@plantillas/storage";
import { getDatabase } from "../infrastructure/sqlite/database";
import { resolveLocalUserId } from "./authStore";

/**
 * Rutinas y entrenamiento (ADR 0013, etapa 15). Lo declarado por la persona
 * (rutinas, ejercicios objetivo, series hechas, esfuerzo, notas) vive en
 * SQLite junto a lo medido, pero separado: el único nexo es `session_link`.
 * El módulo no prescribe rutinas ni ajusta cargas; registra y organiza.
 *
 * Estado en memoria: un contador de versión que avisa a las pantallas que
 * algo cambió (patrón simple, sin duplicar los datos fuera de la base), y el
 * «vínculo pendiente» que Grabación consume cuando se inicia una sesión desde
 * un ejercicio.
 */

let version = 0;
const listeners = new Set<() => void>();
function bump(): void { version += 1; for (const l of listeners) l(); }

/** Re-renderiza cuando cambia algo del entrenamiento. */
export function useTrainingVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => { const l = () => setV(version); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return v;
}

async function repo(): Promise<TrainingRepository> {
  const { driver } = await getDatabase();
  return new TrainingRepository(driver);
}

const now = () => new Date().toISOString();
export const todayDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ------------------------------------------------------------ rutinas

export interface RoutineWithItems { readonly routine: Routine; readonly items: readonly RoutineItem[] }

function toItem(r: RoutineItemRow): RoutineItem {
  return { id: r.id, routine_id: r.routine_id, order: r.order, kind: r.kind, name: r.name, target: r.target as ItemTarget, instructions: r.instructions, rest_sec: r.rest_sec };
}

export async function listRoutines(includeArchived = false): Promise<RoutineWithItems[]> {
  const tr = await repo();
  const userId = await resolveLocalUserId();
  const out: RoutineWithItems[] = [];
  for (const routine of await tr.listRoutines(userId, includeArchived)) out.push({ routine, items: (await tr.getItems(routine.id)).map(toItem) });
  return out;
}

export async function getRoutine(id: string): Promise<RoutineWithItems | undefined> {
  const tr = await repo();
  const routine = await tr.getRoutine(id);
  if (!routine) return undefined;
  return { routine, items: (await tr.getItems(id)).map(toItem) };
}

export interface RoutineDraft {
  readonly id?: string;
  readonly name: string;
  readonly goal: string;
  readonly origin: Routine["origin"];
  readonly professional_note: string;
  /** Tipo de rutina opcional (pulido 4/11). */
  readonly category?: RoutineCategory | null;
  readonly items: readonly { id?: string; kind: ItemKind; name: string; target: ItemTarget; instructions: string; rest_sec: number | null }[];
}

/** Crea o actualiza una rutina con sus ejercicios. Devuelve los errores de validación (vacío = guardada). */
export async function saveRoutine(draft: RoutineDraft): Promise<{ id: string; errors: string[] }> {
  const errors = validateRoutine({ name: draft.name, origin: draft.origin, category: draft.category ?? null });
  draft.items.forEach((i, idx) => validateItem({ name: i.name, kind: i.kind, target: i.target, rest_sec: i.rest_sec }).forEach((e) => errors.push(`ejercicio ${idx + 1}: ${e}`)));
  if (draft.items.length === 0) errors.push("agregá al menos un ejercicio");
  const id = draft.id ?? Crypto.randomUUID();
  if (errors.length) return { id, errors };
  const tr = await repo();
  const userId = await resolveLocalUserId();
  const existing = draft.id ? await tr.getRoutine(draft.id) : undefined;
  const ts = now();
  await tr.saveRoutine({
    id, user_id: existing?.user_id ?? userId, name: draft.name.trim(), goal: draft.goal.trim() || null, origin: draft.origin,
    professional_note: draft.professional_note.trim() || null, created_at: existing?.created_at ?? ts, updated_at: ts, archived: existing?.archived ?? false,
    category: draft.category ?? null,
  });
  await tr.replaceItems(id, draft.items.map((i) => ({ id: i.id ?? Crypto.randomUUID(), kind: i.kind, name: i.name.trim(), target: i.target, instructions: i.instructions.trim() || null, rest_sec: i.rest_sec })));
  bump();
  return { id, errors: [] };
}

export async function archiveRoutine(id: string, archived = true): Promise<void> {
  const tr = await repo();
  await tr.setRoutineArchived(id, archived, now());
  bump();
}

export async function duplicateRoutine(id: string): Promise<string | undefined> {
  const r = await getRoutine(id);
  if (!r) return undefined;
  const { id: newId } = await saveRoutine({
    name: `${r.routine.name} (copia)`, goal: r.routine.goal ?? "", origin: r.routine.origin, professional_note: r.routine.professional_note ?? "", category: r.routine.category ?? null,
    items: r.items.map((i) => ({ kind: i.kind, name: i.name, target: i.target, instructions: i.instructions ?? "", rest_sec: i.rest_sec })),
  });
  return newId;
}

// ------------------------------------------------------------ entrenamientos

export interface WorkoutDetail {
  readonly workout: Workout;
  readonly routine: RoutineWithItems | undefined;
  readonly entries: readonly WorkoutEntry[];
  readonly summary: WorkoutSummary;
  readonly links: readonly SessionLink[];
}

export async function getWorkout(id: string): Promise<WorkoutDetail | undefined> {
  const tr = await repo();
  const workout = await tr.getWorkout(id);
  if (!workout) return undefined;
  const entries = await tr.getEntries(id);
  return { workout, routine: workout.routine_id ? await getRoutine(workout.routine_id) : undefined, entries, summary: summarizeWorkout(entries), links: await tr.getWorkoutLinks(id) };
}

/** Entrenamiento de hoy: el que está en curso o el último de la fecha de hoy. */
export async function todayWorkout(): Promise<WorkoutDetail | undefined> {
  const tr = await repo();
  const userId = await resolveLocalUserId();
  const open = await tr.openWorkout(userId);
  const w = open ?? (await tr.listWorkouts(userId, { date: todayDate(), limit: 1 }))[0];
  return w ? getWorkout(w.id) : undefined;
}

/** Entrenamiento de una fecha (para Hoy navegando días e Historial): el último de ese día. */
export async function workoutForDay(day: string): Promise<WorkoutDetail | undefined> {
  if (day === todayDate()) return todayWorkout();
  const tr = await repo();
  const w = (await tr.listWorkouts(await resolveLocalUserId(), { date: day, limit: 1 }))[0];
  return w ? getWorkout(w.id) : undefined;
}

export async function listWorkouts(limit = 100): Promise<Workout[]> {
  const tr = await repo();
  return tr.listWorkouts(await resolveLocalUserId(), { limit });
}

export interface WorkoutListItem {
  readonly workout: Workout; readonly routine_name: string | null; readonly summary: WorkoutSummary; readonly links: number;
  /** Tipo del entrenamiento (copiado de la rutina al iniciar o, si es anterior a v8, el de la rutina). */
  readonly category: RoutineCategory | null;
  /** Series o entradas declaradas; 0 = entrenamiento vacío. */
  readonly entry_count: number;
}

/** Entrenamientos con nombre de rutina y resumen, para Historial. */
export async function listWorkoutsDetailed(limit = 300): Promise<WorkoutListItem[]> {
  const tr = await repo();
  const rows = await tr.listWorkouts(await resolveLocalUserId(), { limit });
  const routines = new Map<string, { name: string; category: RoutineCategory | null }>();
  const out: WorkoutListItem[] = [];
  for (const w of rows) {
    let routineName: string | null = null;
    let category: RoutineCategory | null = isRoutineCategory(w.category) ? w.category : null;
    if (w.routine_id) {
      if (!routines.has(w.routine_id)) {
        const r = await tr.getRoutine(w.routine_id);
        routines.set(w.routine_id, { name: r?.name ?? "", category: isRoutineCategory(r?.category) ? r!.category as RoutineCategory : null });
      }
      const r = routines.get(w.routine_id)!;
      routineName = r.name || null;
      category = category ?? r.category;
    }
    const entries = await tr.getEntries(w.id);
    out.push({ workout: w, routine_name: routineName, summary: summarizeWorkout(entries), links: (await tr.getWorkoutLinks(w.id)).length, category, entry_count: entries.length });
  }
  return out;
}

/** Inicia un entrenamiento (con rutina o libre). Si ya hay uno en curso, lo devuelve. */
export async function startWorkout(routineId: string | null): Promise<string> {
  const tr = await repo();
  const userId = await resolveLocalUserId();
  const open = await tr.openWorkout(userId);
  if (open) return open.id;
  const id = Crypto.randomUUID();
  const routine = routineId ? await tr.getRoutine(routineId) : undefined;
  const category = isRoutineCategory(routine?.category) ? routine!.category as RoutineCategory : null;
  await tr.saveWorkout({ id, user_id: userId, routine_id: routineId, date: todayDate(), started_at: now(), ended_at: null, state: "in_progress", notes: null, category });
  bump();
  return id;
}

/**
 * Cierra el entrenamiento. Sin ninguna serie ni entrada declarada no se
 * guarda un entrenamiento vacío (pulido 4/11): se descarta y se devuelve
 * `"discarded"`. Sus vínculos con sesiones se borran en cascada; las
 * sesiones medidas no se tocan.
 */
export async function finishWorkout(id: string, notes?: string): Promise<"completed" | "discarded" | "missing"> {
  const tr = await repo();
  const w = await tr.getWorkout(id);
  if (!w) return "missing";
  if ((await tr.getEntries(id)).length === 0 && !notes?.trim()) {
    await tr.deleteWorkout(id);
    bump();
    return "discarded";
  }
  await tr.saveWorkout({ ...w, ended_at: now(), state: "completed", notes: notes?.trim() || w.notes });
  bump();
  return "completed";
}

export async function deleteWorkout(id: string): Promise<void> {
  const tr = await repo();
  await tr.deleteWorkout(id);
  bump();
}

export interface EntryDraft {
  readonly item_id: string | null;
  readonly item_name: string;
  readonly kind: ItemKind;
  readonly set_index: number | null;
  readonly reps: number | null;
  readonly weight_kg: number | null;
  readonly duration_s: number | null;
  readonly distance_m: number | null;
  readonly rpe: number | null;
  readonly discomfort_note: string | null;
  readonly notes: string | null;
}

/** Agrega una serie declarada al entrenamiento. Devuelve el id o los errores. */
export async function addEntry(workoutId: string, d: EntryDraft, sessionId: string | null = null): Promise<{ id?: string; errors: string[] }> {
  const errors = validateEntry(d);
  if (errors.length) return { errors };
  const tr = await repo();
  const id = Crypto.randomUUID();
  await tr.saveEntry({ id, workout_id: workoutId, ...d, item_name: d.item_name.trim(), recorded_at: now(), session_id: sessionId });
  bump();
  return { id, errors: [] };
}

/** Series declaradas durante una sesión de plantillas (actividad unificada), con su entrenamiento. */
export async function entriesForSession(sessionId: string): Promise<{ entries: WorkoutEntry[]; workout: Workout | undefined; routine_name: string | null }> {
  const tr = await repo();
  const entries = await tr.getEntriesBySession(sessionId);
  const workout = entries[0] ? await tr.getWorkout(entries[0].workout_id) : undefined;
  const routine = workout?.routine_id ? await tr.getRoutine(workout.routine_id) : undefined;
  return { entries, workout, routine_name: routine?.name ?? null };
}

export async function deleteEntry(id: string): Promise<void> {
  const tr = await repo();
  await tr.deleteEntry(id);
  bump();
}

/** Número de la próxima serie de un ejercicio en el entrenamiento (1 si no hay). */
export function nextSetIndex(entries: readonly WorkoutEntry[], itemId: string | null, itemName: string): number {
  const done = entries.filter((e) => (itemId ? e.item_id === itemId : e.item_name.trim().toLowerCase() === itemName.trim().toLowerCase()));
  return done.length + 1;
}

// ------------------------------------------------------------ vínculo sesión ↔ entrenamiento

export interface PendingLink { readonly workout_id: string; readonly entry_id: string | null; readonly label: string }
let pendingLink: PendingLink | undefined;

/** Grabación iniciada desde un ejercicio: el vínculo se aplica cuando la sesión se crea (sessionStore). */
export function setPendingLink(link: PendingLink | undefined): void { pendingLink = link; }
export function getPendingLink(): PendingLink | undefined { return pendingLink; }

export async function applyPendingLink(sessionId: string): Promise<void> {
  if (!pendingLink) return;
  const link = pendingLink;
  pendingLink = undefined;
  const tr = await repo();
  await tr.linkSession({ session_id: sessionId, workout_id: link.workout_id, entry_id: link.entry_id });
  bump();
}

export async function linkSession(sessionId: string, workoutId: string, entryId: string | null): Promise<void> {
  const tr = await repo();
  await tr.linkSession({ session_id: sessionId, workout_id: workoutId, entry_id: entryId });
  bump();
}

export async function unlinkSession(sessionId: string): Promise<void> {
  const tr = await repo();
  await tr.unlinkSession(sessionId);
  bump();
}

export interface SessionLinkInfo { readonly workout: Workout; readonly entry: WorkoutEntry | undefined; readonly routine_name: string | null; readonly label: string }

/** Para el detalle de sesión: «Vinculada a Sentadilla · serie 3». */
export async function sessionLinkInfo(sessionId: string): Promise<SessionLinkInfo | undefined> {
  const tr = await repo();
  const link = await tr.getSessionLink(sessionId);
  if (!link) return undefined;
  const workout = await tr.getWorkout(link.workout_id);
  if (!workout) return undefined;
  const entry = link.entry_id ? await tr.getEntry(link.entry_id) : undefined;
  const routine = workout.routine_id ? await tr.getRoutine(workout.routine_id) : undefined;
  const label = entry ? `${entry.item_name}${entry.set_index !== null ? ` · serie ${entry.set_index}` : ""}` : routine ? `entrenamiento «${routine.name}»` : "entrenamiento del día";
  return { workout, entry, routine_name: routine?.name ?? null, label };
}

// ------------------------------------------------------------ carga asistida (ADR 0013)

export interface ConfirmedProposal { readonly id: string; readonly text: string }

/** Guarda una propuesta confirmada en el entrenamiento de hoy (lo crea sin rutina si no existe). */
export async function saveProposal(p: LogEntryProposal): Promise<{ ok: true; entry: ConfirmedProposal } | { ok: false; errors: string[] }> {
  const missing = proposalMissing(p);
  if (missing.length) return { ok: false, errors: [askForMissing(missing)] };
  const errors = validateProposal(p);
  if (errors.length) return { ok: false, errors };
  const today = await todayWorkout();
  const workoutId = today && today.workout.state === "in_progress" ? today.workout.id : await startWorkout(today?.routine?.routine.id ?? null);
  // Si la rutina activa tiene un ejercicio con ese nombre, se vincula a él (nombre exacto o contenido).
  const detail = await getWorkout(workoutId);
  const name = (p.item_name ?? "").trim();
  const item = detail?.routine?.items.find((i) => i.name.toLowerCase() === name.toLowerCase()) ?? detail?.routine?.items.find((i) => i.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(i.name.toLowerCase()));
  const kind: ItemKind = p.kind ?? item?.kind ?? "strength";
  const entries = detail?.entries ?? [];
  const draft: EntryDraft = {
    item_id: item?.id ?? null, item_name: item?.name ?? name, kind,
    set_index: p.set_index ?? nextSetIndex(entries, item?.id ?? null, item?.name ?? name),
    reps: p.reps, weight_kg: p.weight_kg, duration_s: p.duration_s, distance_m: p.distance_m, rpe: p.rpe, discomfort_note: p.discomfort_note, notes: p.notes,
  };
  const r = await addEntry(workoutId, draft);
  if (!r.id) return { ok: false, errors: r.errors };
  const saved = (await repo()).getEntry(r.id);
  const e = await saved;
  return { ok: true, entry: { id: r.id, text: e ? describeEntry(e) : draft.item_name } };
}

// ------------------------------------------------------------ contexto para el asistente

/** La actividad en curso (activityStore) registra acá el texto del ejercicio y serie actuales, para el asistente. */
let currentCursorText: string | undefined;
export function setCurrentCursorText(text: string | undefined): void { currentCursorText = text; }

function workoutInput(d: WorkoutDetail, linkedLabels: readonly string[]): AssistantWorkoutInput {
  return {
    date: d.workout.date, state: d.workout.state, routine_name: d.routine?.routine.name ?? null,
    ...(d.workout.state === "in_progress" && currentCursorText ? { current: currentCursorText } : {}),
    entries: d.entries.map(describeEntry),
    summary: { strength_sets: d.summary.strength_sets, volume_kg: d.summary.volume_kg, walk_run_duration_s: d.summary.walk_run_duration_s, rpe_mean: d.summary.rpe_mean, with_discomfort_note: d.summary.with_discomfort_note },
    linked_sessions: linkedLabels,
  };
}

/** Rutina activa (la última editada), entrenamiento de hoy y último terminado, resumidos. */
export async function trainingContext(describeSession: (sessionId: string) => Promise<string | undefined>): Promise<AssistantTrainingInput | undefined> {
  const routines = await listRoutines();
  const active = routines[0];
  const today = await todayWorkout();
  const tr = await repo();
  const userId = await resolveLocalUserId();
  const lastRow = (await tr.listWorkouts(userId, { limit: 10 })).find((w) => w.state === "completed" && w.id !== today?.workout.id);
  const last = lastRow ? await getWorkout(lastRow.id) : undefined;
  const labels = async (d: WorkoutDetail) => {
    const out: string[] = [];
    for (const l of d.links) {
      const s = await describeSession(l.session_id);
      const e = l.entry_id ? d.entries.find((x) => x.id === l.entry_id) : undefined;
      if (s) out.push(`${s}${e ? ` → ${e.item_name}${e.set_index !== null ? ` serie ${e.set_index}` : ""}` : ""}`);
    }
    return out;
  };
  const input: AssistantTrainingInput = {
    ...(active ? { active_routine: { name: active.routine.name, origin: active.routine.origin, goal: active.routine.goal, items: active.items.map((i) => `${i.name} ${describeTargetShort(i)}`) } } : {}),
    ...(today ? { today: workoutInput(today, await labels(today)) } : {}),
    ...(last ? { last: workoutInput(last, await labels(last)) } : {}),
  };
  return Object.keys(input).length ? input : undefined;
}

function describeTargetShort(i: RoutineItem): string {
  const t = i.target;
  if (t.kind === "strength") return `${t.sets} × ${t.reps}${t.weight_kg !== null ? ` · ${t.weight_kg} kg` : ""}`;
  if (t.kind === "walk_run") return [t.duration_min !== null ? `${t.duration_min} min` : null, t.distance_km !== null ? `${t.distance_km} km` : null].filter(Boolean).join(" · ");
  return t.instructions.slice(0, 40);
}
