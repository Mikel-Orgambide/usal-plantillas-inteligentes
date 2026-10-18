import { recoverOpenSessions } from "@plantillas/session";
import { SessionRepository, migrate, type MigrationReport } from "@plantillas/storage";
import { ExpoSqliteDriver } from "./ExpoSqliteDriver";

export interface Database {
  readonly driver: ExpoSqliteDriver;
  readonly repository: SessionRepository;
  readonly migration: MigrationReport;
  /** Sesiones que estaban abiertas al arrancar y se conservaron como incompletas (S02). */
  readonly recoveredSessions: readonly string[];
}

let instance: Promise<Database> | undefined;

/** Abre (una sola vez) la base local, aplica migraciones y recupera sesiones abiertas. */
export function getDatabase(): Promise<Database> {
  if (!instance) {
    instance = (async () => {
      const driver = await ExpoSqliteDriver.open();
      const migration = await migrate(driver);
      const repository = new SessionRepository(driver);
      await repository.ensureLocalUser();
      const recoveredSessions = await recoverOpenSessions(repository);
      return { driver, repository, migration, recoveredSessions };
    })();
  }
  return instance;
}
