import * as SQLite from "expo-sqlite";
import type { RunResult, SqlDriver, SqlExecutor, SqlRow, SqlValue } from "@plantillas/storage";

/**
 * Adaptador de `SqlDriver` sobre expo-sqlite.
 *
 * Usa una única conexión y serializa todas las operaciones con un candado:
 * ninguna consulta se ejecuta mientras una transacción está abierta. Esto
 * evita el error "database is locked" que aparece cuando expo-sqlite abre una
 * segunda conexión (`withExclusiveTransactionAsync`) y otra consulta llega
 * por la conexión principal.
 */
class RawExecutor implements SqlExecutor {
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

export class ExpoSqliteDriver implements SqlDriver {
  private readonly raw: RawExecutor;
  private lock: Promise<void> = Promise.resolve();

  private constructor(private readonly db: SQLite.SQLiteDatabase) {
    this.raw = new RawExecutor(db);
  }

  static async open(name = "plantillas.db"): Promise<ExpoSqliteDriver> {
    return new ExpoSqliteDriver(await SQLite.openDatabaseAsync(name));
  }

  /** Imagen binaria consistente de la base (para la copia completa). */
  serialize(): Promise<Uint8Array> {
    return this.withLock(() => this.db.serializeAsync());
  }

  /** Encadena `fn` detrás de todo lo pendiente; nunca hay dos operaciones a la vez. */
  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.lock.then(fn);
    this.lock = result.then(() => undefined, () => undefined);
    return result;
  }

  exec(sql: string): Promise<void> {
    return this.withLock(() => this.raw.exec(sql));
  }

  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult> {
    return this.withLock(() => this.raw.run(sql, params));
  }

  all<T extends object = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    return this.withLock(() => this.raw.all<T>(sql, params));
  }

  get<T extends object = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    return this.withLock(() => this.raw.get<T>(sql, params));
  }

  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.withLock(async () => {
      await this.raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(this.raw);
        await this.raw.exec("COMMIT");
        return result;
      } catch (error) {
        await this.raw.exec("ROLLBACK").catch(() => undefined);
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.withLock(() => this.db.closeAsync());
  }
}
