import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "..", "test-data", "contract");

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

/** Copia profunda para mutar un fixture sin afectar a otras pruebas. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
