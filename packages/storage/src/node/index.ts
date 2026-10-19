import { DatabaseSync } from "node:sqlite";
import type { RunResult, SqlDriver, SqlExecutor, SqlRow, SqlValue } from "../driver";

/**
 * Driver para Node (pruebas y scripts) sobre `node:sqlite`. Las operaciones
 * son síncronas por debajo; se exponen como promesas para cumplir la interfaz.
 */
export class NodeSqliteDriver implements SqlDriver {
  private readonly db: DatabaseSync;
  private lock: Promise<void> = Promise.resolve();

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

  /**
   * Las transacciones se serializan con una cola de promesas, igual que en el
   * driver de expo-sqlite: dos cadenas independientes (cola de escritura y
   * eventos) pueden pedir una transacción a la vez sin que una falle.
   */
  async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(this);
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    };
    const turn = this.lock.then(run, run);
    this.lock = turn.then(() => undefined, () => undefined);
    return turn;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
