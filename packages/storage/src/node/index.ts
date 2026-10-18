import { DatabaseSync } from "node:sqlite";
import type { RunResult, SqlDriver, SqlExecutor, SqlRow, SqlValue } from "../driver";

/**
 * Driver para Node (pruebas y scripts) sobre `node:sqlite`. Las operaciones
 * son síncronas por debajo; se exponen como promesas para cumplir la interfaz.
 */
export class NodeSqliteDriver implements SqlDriver {
  private readonly db: DatabaseSync;
  private inTransaction = false;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
    const r = this.db.prepare(sql).run(...(params as SqlValue[]));
    return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
  }

  async all<T extends object = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as SqlValue[])) as unknown as T[];
  }

  async get<T extends object = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T | undefined> {
    return this.db.prepare(sql).get(...(params as SqlValue[])) as unknown as T | undefined;
  }

  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (this.inTransaction) throw new Error("transacción anidada no admitida; usar savepoints");
    this.inTransaction = true;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(this);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
