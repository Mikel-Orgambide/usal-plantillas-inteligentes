import { SessionRepository, migrate, type MigrationReport } from "@plantillas/storage";
import { ExpoSqliteDriver } from "./ExpoSqliteDriver";

export interface Database {
  readonly driver: ExpoSqliteDriver;
  readonly repository: SessionRepository;
  readonly migration: MigrationReport;
}

let instance: Promise<Database> | undefined;

/** Abre (una sola vez) la base local, aplica migraciones y prepara el repositorio. */
export function getDatabase(): Promise<Database> {
  if (!instance) {
    instance = (async () => {
      const driver = await ExpoSqliteDriver.open();
      const migration = await migrate(driver);
      const repository = new SessionRepository(driver);
      await repository.ensureLocalUser();
      return { driver, repository, migration };
    })();
  }
  return instance;
}
