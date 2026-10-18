import * as SQLite from "expo-sqlite";
import type { RunResult, SqlDriver, SqlExecutor, SqlRow, SqlValue } from "@plantillas/storage";

/** Adaptador de `SqlDriver` sobre expo-sqlite (API asíncrona). */
class ExpoExecutor implements SqlExecutor {
  constructor(protected readonly db: SQLite.SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    const r = await this.db.runAsync(sql, params as SQLite.SQLiteBindValue[]);
    return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
  }

  async all<T extends object = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params as SQLite.SQLiteBindValue[]);
  }

  async get<T extends object = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T | undefined> {
    const row = await this.db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindValue[]);
    return row ?? undefined;
  }
}

export class ExpoSqliteDriver extends ExpoExecutor implements SqlDriver {
  static async open(name = "plantillas.db"): Promise<ExpoSqliteDriver> {
    const db = await SQLite.openDatabaseAsync(name);
    return new ExpoSqliteDriver(db);
  }

  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    let result!: T;
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      result = await fn(new ExpoExecutor(txn as unknown as SQLite.SQLiteDatabase));
    });
    return result;
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }
}
