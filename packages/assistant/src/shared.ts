import { GENERATION_DEFAULTS, MAX_HISTORY_TURNS } from "./client";
import { SYSTEM_PROMPT } from "./prompt";

/** Ruta del módulo compartido con la función gestionada, relativa a la raíz del repositorio. */
export const SHARED_PROMPT_PATH = "supabase/functions/_shared/assistant-prompt.ts";

/**
 * Texto del módulo que usa la función `assistant` (Deno): el mismo prompt de
 * sistema (reglas + ficha) y los mismos parámetros que el cliente. Lo escribe
 * `scripts/sync-assistant-prompt.mjs`; la prueba `shared-prompt.test.ts`
 * falla si el archivo del repositorio quedó desactualizado.
 */
export function renderSharedPromptModule(): string {
  return [
    "// GENERADO por `node scripts/sync-assistant-prompt.mjs` a partir de packages/assistant/src",
    "// (prompt.ts, knowledge.ts, client.ts). No editar a mano: cambiar el origen y regenerar.",
    "",
    `export const SYSTEM_PROMPT = ${JSON.stringify(SYSTEM_PROMPT)};`,
    "",
    `export const GENERATION_DEFAULTS = { temperature: ${GENERATION_DEFAULTS.temperature}, max_tokens: ${GENERATION_DEFAULTS.max_tokens} } as const;`,
    "",
    `export const MAX_HISTORY_TURNS = ${MAX_HISTORY_TURNS};`,
    "",
  ].join("\n");
}
