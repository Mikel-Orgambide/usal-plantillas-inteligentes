import { isRoutineCategory, type ItemTarget, type Routine, type RoutineItem, type Workout, type WorkoutEntry } from "./types";

/** Errores de validación en lenguaje del usuario; lista vacía = válido. */
export function validateRoutine(r: Pick<Routine, "name" | "origin"> & { category?: unknown }): string[] {
  const errors: string[] = [];
  if (r.category !== undefined && r.category !== null && !isRoutineCategory(r.category)) errors.push("tipo de rutina desconocido");
  if (!r.name.trim()) errors.push("la rutina necesita un nombre");
  if (r.name.length > 80) errors.push("el nombre no puede superar 80 caracteres");
  if (r.origin !== "own" && r.origin !== "professional") errors.push("origen desconocido");
  return errors;
}

export function validateTarget(t: ItemTarget): string[] {
  const errors: string[] = [];
  switch (t.kind) {
    case "strength":
      if (!Number.isInteger(t.sets) || t.sets < 1 || t.sets > 50) errors.push("las series deben ser un entero entre 1 y 50");
      if (!Number.isInteger(t.reps) || t.reps < 1 || t.reps > 500) errors.push("las repeticiones deben ser un entero entre 1 y 500");
      if (t.weight_kg !== null && (!(t.weight_kg >= 0) || t.weight_kg > 1000)) errors.push("el peso debe estar entre 0 y 1000 kg");
      break;
    case "walk_run":
      if (t.duration_min === null && t.distance_km === null) errors.push("indicá tiempo o distancia objetivo");
      if (t.duration_min !== null && (!(t.duration_min > 0) || t.duration_min > 1440)) errors.push("el tiempo debe estar entre 1 y 1440 minutos");
      if (t.distance_km !== null && (!(t.distance_km > 0) || t.distance_km > 500)) errors.push("la distancia debe estar entre 0 y 500 km");
      break;
    case "other":
      if (!t.instructions.trim()) errors.push("describí el ejercicio");
      break;
  }
  return errors;
}

export function validateItem(i: Pick<RoutineItem, "name" | "kind" | "target" | "rest_sec">): string[] {
  const errors: string[] = [];
  if (!i.name.trim()) errors.push("el ejercicio necesita un nombre");
  if (i.target.kind !== i.kind) errors.push("el objetivo no coincide con el tipo de ejercicio");
  if (i.rest_sec !== null && (!Number.isInteger(i.rest_sec) || i.rest_sec < 0 || i.rest_sec > 3600)) errors.push("el descanso debe ser un entero entre 0 y 3600 segundos");
  return errors.concat(validateTarget(i.target));
}

export function validateEntry(e: Pick<WorkoutEntry, "item_name" | "kind" | "set_index" | "reps" | "weight_kg" | "duration_s" | "distance_m" | "rpe">): string[] {
  const errors: string[] = [];
  if (!e.item_name.trim()) errors.push("falta el nombre del ejercicio");
  if (e.set_index !== null && (!Number.isInteger(e.set_index) || e.set_index < 1 || e.set_index > 50)) errors.push("la serie debe ser un entero entre 1 y 50");
  if (e.reps !== null && (!Number.isInteger(e.reps) || e.reps < 0 || e.reps > 500)) errors.push("las repeticiones deben ser un entero entre 0 y 500");
  if (e.weight_kg !== null && (!(e.weight_kg >= 0) || e.weight_kg > 1000)) errors.push("el peso debe estar entre 0 y 1000 kg");
  if (e.duration_s !== null && (!(e.duration_s >= 0) || e.duration_s > 86_400)) errors.push("la duración debe estar entre 0 y 86400 segundos");
  if (e.distance_m !== null && (!(e.distance_m >= 0) || e.distance_m > 500_000)) errors.push("la distancia debe estar entre 0 y 500 km");
  if (e.rpe !== null && (!Number.isInteger(e.rpe) || e.rpe < 1 || e.rpe > 10)) errors.push("el esfuerzo percibido va de 1 a 10");
  if (e.kind === "strength" && e.reps === null && e.duration_s === null) errors.push("indicá repeticiones (o duración) de la serie");
  if (e.kind === "strength" && e.reps === 0 && !(e.duration_s && e.duration_s > 0)) errors.push("una serie de fuerza necesita al menos 1 repetición");
  if (e.kind === "walk_run" && e.duration_s === null && e.distance_m === null) errors.push("indicá tiempo o distancia");
  return errors;
}

export function validateWorkout(w: Pick<Workout, "date" | "state">): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) errors.push("fecha inválida (se espera AAAA-MM-DD)");
  if (!["planned", "in_progress", "completed"].includes(w.state)) errors.push("estado desconocido");
  return errors;
}
