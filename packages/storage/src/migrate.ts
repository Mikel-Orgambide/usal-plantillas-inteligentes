import type { SqlDriver } from "./driver";
import { MIGRATIONS, type Migration } from "./schema";

export interface MigrationReport {
  readonly from: number;
  readonly to: number;
  readonly applied: readonly number[];
}

/** Habilita claves foráneas en la conexión. Debe ejecutarse fuera de transacción. */
export async function enableForeignKeys(db: SqlDriver): Promise<void> {
  await db.exec("PRAGMA foreign_keys = ON");
  const row = await db.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
  if (row?.foreign_keys !== 1) throw new Error("no se pudieron habilitar las claves foráneas");
}

/**
 * Prepara la conexión: claves foráneas, espera ante bloqueos y modo WAL
 * (lecturas concurrentes con una escritura; en memoria no aplica).
 */
export async function prepareConnection(db: SqlDriver): Promise<void> {
  await enableForeignKeys(db);
  await db.exec("PRAGMA busy_timeout = 5000");
  await db.exec("PRAGMA journal_mode = WAL");
}

export async function getSchemaVersion(db: SqlDriver): Promise<number> {
  const row = await db.get<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}

/** Aplica, en orden y cada una en su transacción, las migraciones pendientes. */
export async function migrate(db: SqlDriver, migrations: readonly Migration[] = MIGRATIONS): Promise<MigrationReport> {
  await prepareConnection(db);
  const from = await getSchemaVersion(db);
  const applied: number[] = [];
  for (const m of migrations) {
    if (m.version <= from) continue;
    const expected = (applied[applied.length - 1] ?? from) + 1;
    if (m.version !== expected) throw new Error(`migración ${m.version} fuera de orden (se esperaba ${expected})`);
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.exec(`PRAGMA user_version = ${m.version}`);
    });
    applied.push(m.version);
  }
  return { from, to: await getSchemaVersion(db), applied };
}
