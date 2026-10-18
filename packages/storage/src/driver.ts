/**
 * Interfaz mínima de acceso a SQLite, común a expo-sqlite (teléfono) y
 * node:sqlite (pruebas). Todo el esquema y el repositorio se escriben contra
 * esta interfaz; cada plataforma aporta un adaptador.
 */

export type SqlValue = string | number | null | Uint8Array;
export type SqlRow = Record<string, SqlValue>;

export interface RunResult {
  readonly changes: number;
  readonly lastInsertRowId: number;
}

export interface SqlExecutor {
  /** Ejecuta una o varias sentencias sin parámetros (DDL, PRAGMA). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  all<T extends object = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T extends object = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined>;
}

export interface SqlDriver extends SqlExecutor {
  /**
   * Ejecuta `fn` dentro de una transacción exclusiva. Si `fn` lanza, se hace
   * rollback de todo. No se admite anidar transacciones; usar savepoints.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Ejecuta `fn` dentro de un savepoint. Si falla, revierte solo ese tramo y
 * relanza; la transacción exterior sigue viva. Útil para lotes donde un
 * registro defectuoso no debe descartar los demás.
 */
export async function withSavepoint<T>(tx: SqlExecutor, name: string, fn: () => Promise<T>): Promise<T> {
  await tx.exec(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await tx.exec(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await tx.exec(`ROLLBACK TO SAVEPOINT ${name}`);
    await tx.exec(`RELEASE SAVEPOINT ${name}`);
    throw error;
  }
}
