#!/usr/bin/env node
// Regenera supabase/functions/_shared/assistant-prompt.ts a partir de packages/assistant/src
// (prompt.ts, knowledge.ts, client.ts), para que la función gestionada use exactamente
// el mismo prompt de sistema y los mismos parámetros que el cliente (ADR 0012).
// Uso, desde la raíz del repositorio: node scripts/sync-assistant-prompt.mjs
// Corre la prueba `shared-prompt.test.ts` del paquete con SYNC_ASSISTANT_PROMPT=1, que
// escribe el archivo con el mismo renderizador que verifica después.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync("npx", ["vitest", "run", "test/shared-prompt.test.ts"], {
  cwd: resolve(root, "packages/assistant"),
  env: { ...process.env, SYNC_ASSISTANT_PROMPT: "1" },
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.status !== 0) {
  console.error("No se pudo regenerar el prompt compartido.");
  process.exit(result.status ?? 1);
}
console.log("supabase/functions/_shared/assistant-prompt.ts actualizado.");
