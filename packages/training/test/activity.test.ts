import { describe, expect, it } from "vitest";
import {
  canAdvance, completeSet, createActivity, describeCursor, isResting, jumpTo, nextCursor, restRemaining, skipRest, tick, walkElapsed, walkPause, walkRemaining, walkStart,
  type RoutineItem, type WorkoutEntry,
} from "../src/index";

const squat: RoutineItem = { id: "i1", routine_id: "r", order: 0, kind: "strength", name: "Sentadilla", target: { kind: "strength", sets: 2, reps: 10, weight_kg: 40 }, instructions: null, rest_sec: 60 };
const walk: RoutineItem = { id: "i2", routine_id: "r", order: 1, kind: "walk_run", name: "Caminata", target: { kind: "walk_run", duration_min: 2, distance_km: null, pace_note: null }, instructions: null, rest_sec: null };
const stretch: RoutineItem = { id: "i3", routine_id: "r", order: 2, kind: "other", name: "Elongación", target: { kind: "other", instructions: "30 s por pierna" }, instructions: null, rest_sec: 0 };
const items = [walk, stretch, squat]; // desordenados a propósito: manda `order`
const entry = (item: RoutineItem, set: number): WorkoutEntry => ({ id: `${item.id}-${set}`, workout_id: "w", item_id: item.id, item_name: item.name, kind: item.kind, set_index: set, reps: 10, weight_kg: 40, duration_s: null, distance_m: null, rpe: null, discomfort_note: null, notes: null, recorded_at: "2026-11-04T20:00:00Z", session_id: null });

describe("actividad: cursor por ejercicio y serie", () => {
  it("arranca en el primer ejercicio con series pendientes y describe el cursor", () => {
    const s = createActivity(items, []);
    expect(s.cursor).toEqual({ itemIndex: 0, setIndex: 1 });
    expect(describeCursor(items, s.cursor)).toBe("Ejercicio 1 de 3 · Sentadilla · serie 1 de 2");
    expect(createActivity([], []).cursor).toBeNull();
    expect(describeCursor([], null)).toBe("Sin rutina");
  });

  it("reanuda donde quedó: series ya declaradas cuentan", () => {
    expect(nextCursor(items, [entry(squat, 1)])).toEqual({ itemIndex: 0, setIndex: 2 });
    expect(nextCursor(items, [entry(squat, 1), entry(squat, 2)])).toEqual({ itemIndex: 1, setIndex: 1 });
    expect(nextCursor(items, [entry(squat, 1), entry(squat, 2), entry(walk, 1), entry(stretch, 1)])).toBeNull();
  });

  it("serie → descanso del ejercicio → siguiente serie; sin descanso cuando la rutina se completa", () => {
    let s = createActivity(items, []);
    const t0 = 1_000_000;
    s = completeSet(s, items, [entry(squat, 1)], t0);
    expect(s.cursor).toEqual({ itemIndex: 0, setIndex: 2 });
    expect(s.rest).toEqual({ item_id: "i1", duration_s: 60, ends_at: t0 + 60_000 });
    expect(restRemaining(s, t0 + 15_000)).toBe(45);
    expect(tick(s, t0 + 30_000).rest).not.toBeNull();
    expect(tick(s, t0 + 60_000).rest).toBeNull();
    s = skipRest(s);
    expect(s.rest).toBeNull();
    s = completeSet(s, items, [entry(squat, 1), entry(squat, 2)], t0);
    expect(s.cursor).toEqual({ itemIndex: 1, setIndex: 1 });
    // La caminata no declara descanso: usa el de por defecto (90 s).
    s = completeSet(s, items, [entry(squat, 1), entry(squat, 2), entry(walk, 1)], t0);
    expect(s.rest?.duration_s).toBe(90);
    // Último ejercicio con descanso 0 y rutina completa: sin descanso y sin cursor.
    s = completeSet(s, items, [entry(squat, 1), entry(squat, 2), entry(walk, 1), entry(stretch, 1)], t0);
    expect(s.cursor).toBeNull();
    expect(s.rest).toBeNull();
    expect(describeCursor(items, s.cursor)).toBe("Rutina completa");
  });

  it("saltar a otro ejercicio respeta sus series pendientes", () => {
    const s = jumpTo(createActivity(items, []), items, [entry(walk, 1)], 1);
    expect(s.cursor).toEqual({ itemIndex: 1, setIndex: 1 });
    expect(jumpTo(s, items, [], 9)).toBe(s);
  });

  it("con el descanso corriendo no se puede saltar de ejercicio; se habilita al saltarlo o al terminar", () => {
    const t0 = 2_000_000;
    let s = completeSet(createActivity(items, []), items, [entry(squat, 1)], t0);
    expect(isResting(s, t0 + 10_000)).toBe(true);
    expect(canAdvance(s, t0 + 10_000)).toBe(false);
    // El chip de otro ejercicio no mueve el cursor ni cancela el descanso.
    const blocked = jumpTo(s, items, [entry(squat, 1)], 2, t0 + 10_000);
    expect(blocked).toBe(s);
    expect(blocked.rest).not.toBeNull();
    // Terminado el tiempo, el salto funciona aunque `tick` todavía no lo haya limpiado.
    expect(canAdvance(s, t0 + 60_000)).toBe(true);
    expect(jumpTo(s, items, [entry(squat, 1)], 2, t0 + 60_000).cursor).toEqual({ itemIndex: 2, setIndex: 1 });
    // «Saltar descanso» lo habilita en el momento.
    s = skipRest(s);
    expect(canAdvance(s, t0 + 10_000)).toBe(true);
    expect(jumpTo(s, items, [entry(squat, 1)], 1, t0 + 10_000).cursor).toEqual({ itemIndex: 1, setIndex: 1 });
  });

  it("caminata: cronómetro con pausa y tiempo restante al objetivo", () => {
    let s = createActivity(items, [entry(squat, 1), entry(squat, 2)]);
    const t0 = 5_000_000;
    s = walkStart(s, t0);
    expect(walkElapsed(s, t0 + 30_000)).toBe(30);
    s = walkPause(s, t0 + 30_000);
    expect(walkElapsed(s, t0 + 90_000)).toBe(30);
    s = walkStart(s, t0 + 90_000);
    expect(walkElapsed(s, t0 + 100_000)).toBe(40);
    expect(walkRemaining(walk, s, t0 + 100_000)).toBe(80);
    expect(walkRemaining(walk, s, t0 + 1_000_000)).toBe(0);
    expect(walkRemaining(squat, s, t0)).toBe(0);
  });
});
