import { validateEntry } from "./validate";
import type { ItemKind } from "./types";

/**
 * Carga asistida de una serie (ADR 0013): el usuario describe en lenguaje
 * natural lo que hizo («estoy en sentadilla serie 2, 10 repeticiones con
 * 40 kg»), el modelo devuelve un JSON con un esquema fijo y la app muestra
 * una tarjeta para confirmar. Nada se guarda sin confirmación. Este módulo
 * detecta la intención por reglas y valida la salida del modelo; no infiere
 * valores que el modelo no haya devuelto.
 */

/** Esquema que el modelo debe devolver, tal cual se le pide en el prompt. */
export interface LogEntryProposal {
  readonly intent: "log_entry";
  readonly item_name: string | null;
  readonly kind: ItemKind | null;
  readonly set_index: number | null;
  readonly reps: number | null;
  readonly weight_kg: number | null;
  readonly duration_s: number | null;
  readonly distance_m: number | null;
  readonly rpe: number | null;
  readonly discomfort_note: string | null;
  readonly notes: string | null;
  /** Campos que el modelo no pudo completar y conviene preguntar. */
  readonly missing: readonly string[];
}

export const LOG_ENTRY_SCHEMA_DESCRIPTION =
  'Respondé SOLO con un objeto JSON (sin texto antes ni después) con estas claves: {"intent":"log_entry","item_name":string|null,"kind":"strength"|"walk_run"|"other"|null,"set_index":number|null,"reps":number|null,"weight_kg":number|null,"duration_s":number|null,"distance_m":number|null,"rpe":number|null,"discomfort_note":string|null,"notes":string|null,"missing":string[]}. ' +
  "Completá sólo lo que el usuario dijo; lo que no dijo va en null y, si hace falta para registrar la serie, su nombre de clave va en missing. No inventes pesos ni repeticiones. Si el usuario menciona dolor o molestia, copialo literal en discomfort_note sin interpretarlo. " +
  "Si hay una rutina activa con un ejercicio de nombre parecido, usá ese nombre exacto en item_name y su tipo en kind.";

const TRAINING_WORDS = /\b(serie|series|repetici[oó]n(es)?|reps?|sentadilla|peso muerto|press|remo|dominada|flexi[oó]n|plancha|estocada|zancada|curl|elevaci[oó]n|kg|kilos?|rpe|caminé|camine|corr[ií]|trot[eé]|caminata|carrera|entren[eé]|entrenamiento|ejercicio|hice|termin[eé] (la|el|una)|estoy (en|haciendo))\b/i;
const HAS_NUMBER = /\d/;
const EXPLICIT = /^(registr(a|á|ar)|anot(a|á|ar)|carg(a|á|ar))\b/i;

/** ¿El mensaje describe una serie o ejercicio hecho, para registrarlo? Reglas simples, deterministas. */
export function isLogIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (EXPLICIT.test(t)) return true;
  if (/\?\s*$/.test(t) || /^[¿]/.test(t)) return false; // una pregunta no es un registro
  return TRAINING_WORDS.test(t) && HAS_NUMBER.test(t);
}

const KEYS = ["item_name", "kind", "set_index", "reps", "weight_kg", "duration_s", "distance_m", "rpe", "discomfort_note", "notes"] as const;

/** Extrae y valida el JSON del modelo. Devuelve la propuesta o un error legible; nunca completa valores por su cuenta. */
export function parseLogEntryProposal(raw: string): { ok: true; proposal: LogEntryProposal } | { ok: false; error: string } {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "el modelo no devolvió un objeto JSON" };
  let o: Record<string, unknown>;
  try { o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { return { ok: false, error: "el JSON del modelo no se pudo leer" }; }
  if (o.intent !== "log_entry") return { ok: false, error: "la respuesta no es un registro de ejercicio" };
  const str = (k: string): string | null => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : null);
  const num = (k: string): number | null => (typeof o[k] === "number" && Number.isFinite(o[k] as number) ? (o[k] as number) : typeof o[k] === "string" && /^-?\d+([.,]\d+)?$/.test((o[k] as string).trim()) ? Number((o[k] as string).replace(",", ".")) : null);
  const kindRaw = str("kind");
  const kind: ItemKind | null = kindRaw === "strength" || kindRaw === "walk_run" || kindRaw === "other" ? kindRaw : null;
  const missing = Array.isArray(o.missing) ? (o.missing as unknown[]).filter((m): m is string => typeof m === "string" && (KEYS as readonly string[]).includes(m)) : [];
  const proposal: LogEntryProposal = {
    intent: "log_entry", item_name: str("item_name"), kind,
    set_index: int(num("set_index")), reps: int(num("reps")), weight_kg: num("weight_kg"), duration_s: int(num("duration_s")), distance_m: num("distance_m"), rpe: int(num("rpe")),
    discomfort_note: str("discomfort_note"), notes: str("notes"), missing: [...new Set(missing)],
  };
  return { ok: true, proposal };
}

function int(n: number | null): number | null { return n === null ? null : Math.round(n); }

/** Qué falta para poder guardar la propuesta: lo que el modelo marcó en `missing` más lo que la validación exige. */
export function proposalMissing(p: LogEntryProposal): string[] {
  const missing = new Set<string>(p.missing);
  if (!p.item_name) missing.add("item_name");
  const kind = p.kind ?? "strength";
  if (kind === "strength" && p.reps === null && p.duration_s === null) missing.add("reps");
  if (kind === "walk_run" && p.duration_s === null && p.distance_m === null) missing.add("duration_s");
  return [...missing];
}

export const MISSING_LABEL: Readonly<Record<string, string>> = {
  item_name: "el nombre del ejercicio", kind: "el tipo de ejercicio", set_index: "el número de serie", reps: "las repeticiones",
  weight_kg: "el peso", duration_s: "la duración", distance_m: "la distancia", rpe: "el esfuerzo percibido (1–10)", discomfort_note: "la molestia", notes: "las notas",
};

/** Pregunta corta por lo que falta («¿Cuántas repeticiones y cuánto peso?»). */
export function askForMissing(missing: readonly string[]): string {
  const labels = missing.map((m) => MISSING_LABEL[m] ?? m);
  if (labels.length === 0) return "";
  if (labels.length === 1) return `¿Me decís ${labels[0]}?`;
  return `¿Me decís ${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}?`;
}

/** Validación final antes de guardar (misma regla que las entradas manuales). */
export function validateProposal(p: LogEntryProposal): string[] {
  return validateEntry({ item_name: p.item_name ?? "", kind: p.kind ?? "strength", set_index: p.set_index, reps: p.reps, weight_kg: p.weight_kg, duration_s: p.duration_s, distance_m: p.distance_m, rpe: p.rpe });
}
