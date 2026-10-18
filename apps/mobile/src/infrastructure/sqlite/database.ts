import { SessionRepository, migrate, type MigrationReport } from "@plantillas/storage";
import { ExpoSqliteDriver } from "./ExpoSqliteDriver";

export interface Database {
  readonly driver: ExpoSqliteDriver;
  readonly repository: SessionRepository;
  readonly migration: MigrationReport;
  /** Sesiones que estaban abiertas al arrancar y se marcaron como incompletas (S02). */
  readonly recoveredSessions: readonly string[];
}

let instance: Promise<Database> | undefined;

/**
 * Abre (una sola vez) la base local, aplica migraciones y prepara el
 * repositorio. Las sesiones que quedaron abiertas en una ejecución anterior
 * se conservan como `incomplete`: no se borran ni se cierran como completas.
 */
export function getDatabase(): Promise<Database> {
  if (!instance) {
    instance = (async () => {
      const driver = await ExpoSqliteDriver.open();
      const migration = await migrate(driver);
      const repository = new SessionRepository(driver);
      await repository.ensureLocalUser();
      const open = await repository.listOpenSessions();
      for (const s of open) await repository.setSessionState(s.id, "incomplete");
      return { driver, repository, migration, recoveredSessions: open.map((s) => s.id) };
    })();
  }
  return instance;
}
