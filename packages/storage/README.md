# @plantillas/storage

Persistencia local (SQLite) del contrato v1.0: esquema, migraciones, repositorio de sesiones y cola de escritura. Ver ADR 0004.

| Módulo | Qué hace |
|---|---|
| `driver.ts` | Interfaz `SqlDriver` y `withSavepoint` |
| `schema.ts` | Migraciones versionadas (`user_version`) |
| `migrate.ts` | `migrate(db)`: habilita claves foráneas y aplica lo pendiente |
| `repository.ts` | `SessionRepository`: configuración, sesiones, capturas, registros, muestras, eventos, diagnóstico |
| `write-queue.ts` | `WriteQueue`: lotes acotados, `flush()` = commit confirmado |
| `node/` | `NodeSqliteDriver` sobre `node:sqlite` (pruebas y scripts) |

El adaptador para el teléfono (`ExpoSqliteDriver`) está en `apps/mobile/src/infrastructure/sqlite`.

Pruebas: `npm test` (15 pruebas: P01–P04, C08, C09, C11, S02 y cola de escritura).
