import { describe, expect, it } from "vitest";
import { askForMissing, describeEntry, isLogIntent, parseLogEntryProposal, proposalMissing, routineProgress, summarizeWorkout, validateEntry, validateItem, validateProposal, validateRoutine, type RoutineItem, type WorkoutEntry } from "../src/index";

const entry = (over: Partial<WorkoutEntry>): WorkoutEntry => ({ id: "e", workout_id: "w", item_id: null, item_name: "Sentadilla", kind: "strength", set_index: 1, reps: 10, weight_kg: 40, duration_s: null, distance_m: null, rpe: 7, discomfort_note: null, notes: null, recorded_at: "2026-11-04T20:00:00Z", session_id: null, ...over });

describe("validación", () => {
  it("rutina y ejercicio", () => {
    expect(validateRoutine({ name: "", origin: "own" })).toContain("la rutina necesita un nombre");
    expect(validateItem({ name: "Sentadilla", kind: "strength", target: { kind: "strength", sets: 3, reps: 10, weight_kg: 40 }, rest_sec: 90 })).toEqual([]);
    expect(validateItem({ name: "Caminata", kind: "walk_run", target: { kind: "walk_run", duration_min: null, distance_km: null, pace_note: null }, rest_sec: null })).toContain("indicá tiempo o distancia objetivo");
    expect(validateItem({ name: "x", kind: "other", target: { kind: "strength", sets: 1, reps: 1, weight_kg: null }, rest_sec: null })).toContain("el objetivo no coincide con el tipo de ejercicio");
  });
  it("entrada: RPE fuera de rango y serie de fuerza sin repeticiones", () => {
    expect(validateEntry({ ...entry({}), rpe: 11 })).toContain("el esfuerzo percibido va de 1 a 10");
    expect(validateEntry({ ...entry({ reps: null }) })).toContain("indicá repeticiones (o duración) de la serie");
    expect(validateEntry(entry({}))).toEqual([]);
  });
});

describe("resumen", () => {
  it("volumen, series, caminata y RPE medio; la molestia se cuenta, no se interpreta", () => {
    const s = summarizeWorkout([
      entry({ id: "1" }), entry({ id: "2", set_index: 2, reps: 8, weight_kg: 45, rpe: 8 }),
      entry({ id: "3", item_name: "Caminata", kind: "walk_run", reps: null, weight_kg: null, duration_s: 1200, distance_m: 1800, rpe: null, discomfort_note: "molestia leve en el talón" }),
    ]);
    expect(s.strength_sets).toBe(2);
    expect(s.strength_reps).toBe(18);
    expect(s.volume_kg).toBe(10 * 40 + 8 * 45);
    expect(s.walk_run_duration_s).toBe(1200);
    expect(s.rpe_mean).toBe(7.5);
    expect(s.with_discomfort_note).toBe(1);
    expect(s.items.map((i) => i.name)).toEqual(["Sentadilla", "Caminata"]);
  });
  it("progreso de la rutina y texto de una entrada", () => {
    const items: RoutineItem[] = [{ id: "i1", routine_id: "r", order: 0, kind: "strength", name: "Sentadilla", target: { kind: "strength", sets: 3, reps: 10, weight_kg: 40 }, instructions: null, rest_sec: null }];
    expect(routineProgress(items, [entry({ item_id: "i1" }), entry({ id: "2", item_id: "i1" })])).toEqual([{ item_id: "i1", name: "Sentadilla", done: 2, target: 3 }]);
    expect(describeEntry(entry({}))).toBe("Sentadilla · serie 1 · 10 × 40 kg · RPE 7");
  });
});

describe("carga asistida", () => {
  it("detecta la intención de registrar por reglas", () => {
    expect(isLogIntent("estoy en sentadilla serie 2, 10 repeticiones con 40 kg")).toBe(true);
    expect(isLogIntent("Registrar: caminé 20 minutos")).toBe(true);
    expect(isLogIntent("¿Cómo se repartió la carga?")).toBe(false);
    expect(isLogIntent("¿cuántas series hice hoy?")).toBe(false);
    expect(isLogIntent("hice 3 series")).toBe(true);
  });
  it("parsea el JSON del modelo (con cerco de código) y no inventa lo que falta", () => {
    const r = parseLogEntryProposal('```json\n{"intent":"log_entry","item_name":"Sentadilla","kind":"strength","set_index":2,"reps":10,"weight_kg":40,"duration_s":null,"distance_m":null,"rpe":null,"discomfort_note":null,"notes":null,"missing":["rpe"]}\n```');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.reps).toBe(10);
    expect(r.proposal.weight_kg).toBe(40);
    expect(proposalMissing(r.proposal)).toEqual(["rpe"]);
    expect(validateProposal(r.proposal)).toEqual([]);
  });
  it("casos ambiguos: sin nombre ni repeticiones → pregunta sólo por eso; JSON roto → error", () => {
    const r = parseLogEntryProposal('{"intent":"log_entry","item_name":null,"kind":"strength","set_index":null,"reps":null,"weight_kg":"40,5","duration_s":null,"distance_m":null,"rpe":null,"discomfort_note":"me molestó la rodilla","notes":null,"missing":[]}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposal.weight_kg).toBe(40.5);
    expect(r.proposal.discomfort_note).toBe("me molestó la rodilla");
    expect(proposalMissing(r.proposal).sort()).toEqual(["item_name", "reps"]);
    expect(askForMissing(proposalMissing(r.proposal))).toBe("¿Me decís el nombre del ejercicio y las repeticiones?");
    expect(parseLogEntryProposal("no entendí").ok).toBe(false);
    expect(parseLogEntryProposal('{"intent":"answer"}').ok).toBe(false);
  });
});

describe("entrenamiento libre (sin rutina)", () => {
  it("resumen y progreso vacíos sin ejercicios ni series: nada es null ni falla", () => {
    const s = summarizeWorkout([]);
    expect(s.entries).toBe(0);
    expect(s.strength_sets).toBe(0);
    expect(s.volume_kg).toBe(0);
    expect(s.walk_run_duration_s).toBe(0);
    expect(s.rpe_mean).toBeNull();
    expect(s.items).toEqual([]);
    expect(routineProgress([], [])).toEqual([]);
    // Series cargadas fuera de una rutina: progreso vacío igual; el resumen las cuenta.
    expect(routineProgress([], [entry({ item_id: null })])).toEqual([]);
    expect(summarizeWorkout([entry({ item_id: null })]).strength_sets).toBe(1);
  });
});
