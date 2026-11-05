import type { SqlDriver } from "./driver";

/**
 * Repositorio de rutinas y entrenamiento (ADR 0013). Las filas reproducen los
 * tipos de `@plantillas/training` sin depender de ese paquete (la persistencia
 * no importa dominio); `target` se guarda como JSON. Lo declarado por el
 * usuario vive en estas tablas; lo medido sigue en `session`/`capture`, y
 * `session_link` es el único nexo entre ambos.
 */

export type ItemKind = "strength" | "walk_run" | "other";
/** Tipo de rutina declarado (opcional). Mismos valores que `@plantillas/training` (validados allá al guardar). */
export type RoutineCategoryRow = "legs" | "upper" | "full_body" | "core" | "cardio" | "mobility" | "rehab" | "other" | null;

export interface RoutineRow {
  readonly id: string; readonly user_id: string; readonly name: string; readonly goal: string | null; readonly origin: "own" | "professional";
  readonly professional_note: string | null; readonly created_at: string; readonly updated_at: string; readonly archived: boolean;
  readonly category?: RoutineCategoryRow;
}
export interface RoutineItemRow {
  readonly id: string; readonly routine_id: string; readonly order: number; readonly kind: ItemKind; readonly name: string;
  readonly target: unknown; readonly instructions: string | null; readonly rest_sec: number | null;
}
export interface WorkoutRow {
  readonly id: string; readonly user_id: string; readonly routine_id: string | null; readonly date: string; readonly started_at: string | null;
  readonly ended_at: string | null; readonly state: "planned" | "in_progress" | "completed"; readonly notes: string | null;
  readonly category?: RoutineCategoryRow;
}
export interface WorkoutEntryRow {
  readonly id: string; readonly workout_id: string; readonly item_id: string | null; readonly item_name: string; readonly kind: ItemKind;
  readonly set_index: number | null; readonly reps: number | null; readonly weight_kg: number | null; readonly duration_s: number | null;
  readonly distance_m: number | null; readonly rpe: number | null; readonly discomfort_note: string | null; readonly notes: string | null; readonly recorded_at: string;
  /** Sesión de plantillas durante la que se declaró la serie (actividad unificada), si hubo. */
  readonly session_id: string | null;
}
export interface SessionLinkRow { readonly session_id: string; readonly workout_id: string; readonly entry_id: string | null }

type RoutineDb = Omit<RoutineRow, "archived"> & { archived: number };
type ItemDb = Omit<RoutineItemRow, "order" | "target"> & { item_order: number; target: string };

export class TrainingRepository {
  constructor(private readonly db: SqlDriver) {}

  // ------------------------------------------------------------ rutinas
  async saveRoutine(r: RoutineRow): Promise<void> {
    await this.db.run(
      `INSERT INTO routine (id, user_id, name, goal, origin, professional_note, created_at, updated_at, archived, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, goal = excluded.goal, origin = excluded.origin, professional_note = excluded.professional_note, updated_at = excluded.updated_at, archived = excluded.archived, category = excluded.category`,
      [r.id, r.user_id, r.name, r.goal, r.origin, r.professional_note, r.created_at, r.updated_at, r.archived ? 1 : 0, r.category ?? null],
    );
  }
  async getRoutine(id: string): Promise<RoutineRow | undefined> {
    const row = await this.db.get<RoutineDb>("SELECT * FROM routine WHERE id = ?", [id]);
    return row ? { ...row, archived: row.archived === 1 } : undefined;
  }
  async listRoutines(userId: string, includeArchived = false): Promise<RoutineRow[]> {
    const rows = await this.db.all<RoutineDb>(`SELECT * FROM routine WHERE user_id = ? ${includeArchived ? "" : "AND archived = 0"} ORDER BY updated_at DESC`, [userId]);
    return rows.map((r) => ({ ...r, archived: r.archived === 1 }));
  }
  async setRoutineArchived(id: string, archived: boolean, updatedAt: string): Promise<void> {
    await this.db.run("UPDATE routine SET archived = ?, updated_at = ? WHERE id = ?", [archived ? 1 : 0, updatedAt, id]);
  }
  /** Reemplaza los ejercicios de la rutina por la lista dada (orden = posición). */
  async replaceItems(routineId: string, items: readonly Omit<RoutineItemRow, "routine_id" | "order">[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const keep = items.map((i) => i.id);
      await tx.run(`DELETE FROM routine_item WHERE routine_id = ? ${keep.length ? `AND id NOT IN (${keep.map(() => "?").join(",")})` : ""}`, [routineId, ...keep]);
      for (const [order, i] of items.entries()) {
        await tx.run(
          `INSERT INTO routine_item (id, routine_id, item_order, kind, name, target, instructions, rest_sec) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET item_order = excluded.item_order, kind = excluded.kind, name = excluded.name, target = excluded.target, instructions = excluded.instructions, rest_sec = excluded.rest_sec`,
          [i.id, routineId, order, i.kind, i.name, JSON.stringify(i.target), i.instructions, i.rest_sec],
        );
      }
    });
  }
  async getItems(routineId: string): Promise<RoutineItemRow[]> {
    const rows = await this.db.all<ItemDb>("SELECT * FROM routine_item WHERE routine_id = ? ORDER BY item_order", [routineId]);
    return rows.map(({ item_order, target, ...rest }) => ({ ...rest, order: item_order, target: JSON.parse(target) as unknown }));
  }
  async getItem(id: string): Promise<RoutineItemRow | undefined> {
    const row = await this.db.get<ItemDb>("SELECT * FROM routine_item WHERE id = ?", [id]);
    if (!row) return undefined;
    const { item_order, target, ...rest } = row;
    return { ...rest, order: item_order, target: JSON.parse(target) as unknown };
  }

  // ------------------------------------------------------------ entrenamientos
  async saveWorkout(w: WorkoutRow): Promise<void> {
    await this.db.run(
      `INSERT INTO workout (id, user_id, routine_id, date, started_at, ended_at, state, notes, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET routine_id = excluded.routine_id, date = excluded.date, started_at = excluded.started_at, ended_at = excluded.ended_at, state = excluded.state, notes = excluded.notes, category = excluded.category`,
      [w.id, w.user_id, w.routine_id, w.date, w.started_at, w.ended_at, w.state, w.notes, w.category ?? null],
    );
  }
  async getWorkout(id: string): Promise<WorkoutRow | undefined> {
    return this.db.get<WorkoutRow>("SELECT * FROM workout WHERE id = ?", [id]);
  }
  async listWorkouts(userId: string, opts: { date?: string; limit?: number } = {}): Promise<WorkoutRow[]> {
    const params: (string | number)[] = [userId];
    let where = "user_id = ?";
    if (opts.date) { where += " AND date = ?"; params.push(opts.date); }
    params.push(opts.limit ?? 100);
    return this.db.all<WorkoutRow>(`SELECT * FROM workout WHERE ${where} ORDER BY date DESC, started_at DESC LIMIT ?`, params);
  }
  async openWorkout(userId: string): Promise<WorkoutRow | undefined> {
    return this.db.get<WorkoutRow>("SELECT * FROM workout WHERE user_id = ? AND state = 'in_progress' ORDER BY started_at DESC LIMIT 1", [userId]);
  }
  async deleteWorkout(id: string): Promise<void> {
    await this.db.run("DELETE FROM workout WHERE id = ?", [id]);
  }

  async saveEntry(e: WorkoutEntryRow): Promise<void> {
    await this.db.run(
      `INSERT INTO workout_entry (id, workout_id, item_id, item_name, kind, set_index, reps, weight_kg, duration_s, distance_m, rpe, discomfort_note, notes, recorded_at, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET item_id = excluded.item_id, item_name = excluded.item_name, kind = excluded.kind, set_index = excluded.set_index, reps = excluded.reps, weight_kg = excluded.weight_kg,
         duration_s = excluded.duration_s, distance_m = excluded.distance_m, rpe = excluded.rpe, discomfort_note = excluded.discomfort_note, notes = excluded.notes, recorded_at = excluded.recorded_at, session_id = excluded.session_id`,
      [e.id, e.workout_id, e.item_id, e.item_name, e.kind, e.set_index, e.reps, e.weight_kg, e.duration_s, e.distance_m, e.rpe, e.discomfort_note, e.notes, e.recorded_at, e.session_id ?? null],
    );
  }
  async getEntries(workoutId: string): Promise<WorkoutEntryRow[]> {
    return this.db.all<WorkoutEntryRow>("SELECT * FROM workout_entry WHERE workout_id = ? ORDER BY recorded_at, rowid", [workoutId]);
  }
  async getEntry(id: string): Promise<WorkoutEntryRow | undefined> {
    return this.db.get<WorkoutEntryRow>("SELECT * FROM workout_entry WHERE id = ?", [id]);
  }
  /** Series declaradas durante una sesión de plantillas (actividad unificada). */
  async getEntriesBySession(sessionId: string): Promise<WorkoutEntryRow[]> {
    return this.db.all<WorkoutEntryRow>("SELECT * FROM workout_entry WHERE session_id = ? ORDER BY recorded_at, rowid", [sessionId]);
  }
  async deleteEntry(id: string): Promise<void> {
    await this.db.run("DELETE FROM workout_entry WHERE id = ?", [id]);
  }

  // ------------------------------------------------------------ vínculo con sesiones
  async linkSession(link: SessionLinkRow): Promise<void> {
    await this.db.run(
      "INSERT INTO session_link (session_id, workout_id, entry_id) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET workout_id = excluded.workout_id, entry_id = excluded.entry_id",
      [link.session_id, link.workout_id, link.entry_id],
    );
  }
  async unlinkSession(sessionId: string): Promise<void> {
    await this.db.run("DELETE FROM session_link WHERE session_id = ?", [sessionId]);
  }
  async getSessionLink(sessionId: string): Promise<SessionLinkRow | undefined> {
    return this.db.get<SessionLinkRow>("SELECT * FROM session_link WHERE session_id = ?", [sessionId]);
  }
  async getWorkoutLinks(workoutId: string): Promise<SessionLinkRow[]> {
    return this.db.all<SessionLinkRow>("SELECT * FROM session_link WHERE workout_id = ?", [workoutId]);
  }
  async countTraining(userId: string): Promise<{ routines: number; workouts: number; entries: number; links: number }> {
    const n = async (sql: string) => (await this.db.get<{ n: number }>(sql, [userId]))?.n ?? 0;
    return {
      routines: await n("SELECT COUNT(*) AS n FROM routine WHERE user_id = ?"),
      workouts: await n("SELECT COUNT(*) AS n FROM workout WHERE user_id = ?"),
      entries: await n("SELECT COUNT(*) AS n FROM workout_entry e JOIN workout w ON w.id = e.workout_id WHERE w.user_id = ?"),
      links: await n("SELECT COUNT(*) AS n FROM session_link l JOIN workout w ON w.id = l.workout_id WHERE w.user_id = ?"),
    };
  }
}
