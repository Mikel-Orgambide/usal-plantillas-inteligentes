import type { RoutineItem, WorkoutEntry } from "./types";

/** Resumen de un entrenamiento a partir de sus entradas: cantidades y totales declarados, sin interpretación. */
export interface WorkoutSummary {
  readonly entries: number;
  readonly strength_sets: number;
  readonly strength_reps: number;
  /** Σ reps × kg sobre las series con peso declarado (kg·rep), sólo informativo. */
  readonly volume_kg: number;
  readonly walk_run_duration_s: number;
  readonly walk_run_distance_m: number;
  readonly other_entries: number;
  readonly rpe_mean: number | null;
  readonly items: readonly { name: string; kind: WorkoutEntry["kind"]; sets: number; reps: number; volume_kg: number; duration_s: number; distance_m: number }[];
  readonly with_discomfort_note: number;
}

export function summarizeWorkout(entries: readonly WorkoutEntry[]): WorkoutSummary {
  const byItem = new Map<string, { name: string; kind: WorkoutEntry["kind"]; sets: number; reps: number; volume_kg: number; duration_s: number; distance_m: number }>();
  let strengthSets = 0, strengthReps = 0, volume = 0, dur = 0, dist = 0, other = 0, rpeSum = 0, rpeN = 0, discomfort = 0;
  for (const e of entries) {
    const key = `${e.kind}:${e.item_name.trim().toLowerCase()}`;
    const it = byItem.get(key) ?? { name: e.item_name, kind: e.kind, sets: 0, reps: 0, volume_kg: 0, duration_s: 0, distance_m: 0 };
    if (e.kind === "strength") {
      strengthSets += 1; it.sets += 1;
      strengthReps += e.reps ?? 0; it.reps += e.reps ?? 0;
      const v = e.reps !== null && e.weight_kg !== null ? e.reps * e.weight_kg : 0;
      volume += v; it.volume_kg += v;
    } else if (e.kind === "walk_run") {
      dur += e.duration_s ?? 0; it.duration_s += e.duration_s ?? 0;
      dist += e.distance_m ?? 0; it.distance_m += e.distance_m ?? 0;
      it.sets += 1;
    } else { other += 1; it.sets += 1; }
    if (e.rpe !== null) { rpeSum += e.rpe; rpeN += 1; }
    if (e.discomfort_note && e.discomfort_note.trim()) discomfort += 1;
    byItem.set(key, it);
  }
  return {
    entries: entries.length, strength_sets: strengthSets, strength_reps: strengthReps, volume_kg: Math.round(volume * 10) / 10,
    walk_run_duration_s: dur, walk_run_distance_m: dist, other_entries: other, rpe_mean: rpeN ? Math.round((rpeSum / rpeN) * 10) / 10 : null,
    items: [...byItem.values()], with_discomfort_note: discomfort,
  };
}

/** Progreso de una rutina en un entrenamiento: series hechas sobre series objetivo por ejercicio. */
export function routineProgress(items: readonly RoutineItem[], entries: readonly WorkoutEntry[]): { item_id: string; name: string; done: number; target: number }[] {
  return items.map((i) => {
    const done = entries.filter((e) => e.item_id === i.id).length;
    const target = i.target.kind === "strength" ? i.target.sets : 1;
    return { item_id: i.id, name: i.name, done, target };
  });
}

/** Texto corto de una entrada para listas y contexto del asistente («Sentadilla · serie 2 · 10 × 40 kg · RPE 7»). */
export function describeEntry(e: WorkoutEntry): string {
  const parts = [e.item_name];
  if (e.set_index !== null) parts.push(`serie ${e.set_index}`);
  if (e.kind === "strength") {
    const reps = e.reps !== null ? `${e.reps}` : "";
    const w = e.weight_kg !== null ? ` × ${fmt(e.weight_kg)} kg` : "";
    if (reps || w) parts.push(`${reps}${w}`.trim());
  }
  if (e.duration_s !== null) parts.push(fmtDuration(e.duration_s));
  if (e.distance_m !== null) parts.push(e.distance_m >= 1000 ? `${fmt(e.distance_m / 1000)} km` : `${e.distance_m} m`);
  if (e.rpe !== null) parts.push(`RPE ${e.rpe}`);
  return parts.join(" · ");
}

export function describeTarget(i: RoutineItem): string {
  const t = i.target;
  if (t.kind === "strength") return `${t.sets} × ${t.reps}${t.weight_kg !== null ? ` · ${fmt(t.weight_kg)} kg` : ""}`;
  if (t.kind === "walk_run") return [t.duration_min !== null ? `${t.duration_min} min` : null, t.distance_km !== null ? `${fmt(t.distance_km)} km` : null, t.pace_note].filter(Boolean).join(" · ");
  return t.instructions.length > 60 ? `${t.instructions.slice(0, 57)}…` : t.instructions;
}

export function fmtDuration(s: number): string {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m > 0 ? (r ? `${m} min ${r} s` : `${m} min`) : `${r} s`;
}
function fmt(n: number): string { return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""); }
