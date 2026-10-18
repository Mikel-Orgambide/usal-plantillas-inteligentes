import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SimulatedGenerator, take } from "../src/index";

/**
 * Fixture dorado: las primeras 20 salidas del generador con semilla 1 y modo
 * normal. Si cambia el algoritmo de señal, este test falla a propósito y el
 * cambio debe registrarse (y regenerarse el fixture con GOLDEN_WRITE=1).
 */
const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, "..", "..", "..", "test-data", "simulator", "semilla-0001-normal-20.json");

describe("fixture dorado del simulador", () => {
  it("coincide con test-data/simulator/semilla-0001-normal-20.json", () => {
    const actual = take(new SimulatedGenerator({ seed: 1 }), 20);
    if (process.env["GOLDEN_WRITE"] === "1" || !existsSync(goldenPath)) {
      mkdirSync(dirname(goldenPath), { recursive: true });
      writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + "\n");
    }
    const expected = JSON.parse(readFileSync(goldenPath, "utf8"));
    expect(actual).toEqual(expected);
  });
});
