import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KNOWLEDGE, RULES, SHARED_PROMPT_PATH, SYSTEM_PROMPT, renderSharedPromptModule } from "../src/index";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const target = resolve(repoRoot, SHARED_PROMPT_PATH);

describe("prompt compartido con la función gestionada", () => {
  it("el prompt de sistema incluye las reglas en tres niveles y la ficha de conocimiento", () => {
    expect(SYSTEM_PROMPT.startsWith(RULES)).toBe(true);
    expect(SYSTEM_PROMPT).toContain(KNOWLEDGE);
    expect(RULES).toMatch(/Lectura descriptiva/);
    expect(RULES).toMatch(/no contestes que no podés interpretar/);
    expect(KNOWLEDGE).toMatch(/cuentas ADC de 0 a 4095/);
    expect(KNOWLEDGE).not.toMatch(/rango normal de|valores normales son/i);
  });

  it(`${SHARED_PROMPT_PATH} está al día (si falla: node scripts/sync-assistant-prompt.mjs)`, () => {
    const expected = renderSharedPromptModule();
    if (process.env.SYNC_ASSISTANT_PROMPT === "1") {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, expected, "utf8");
    }
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, "utf8").replace(/\r\n/g, "\n")).toBe(expected);
  });
});
