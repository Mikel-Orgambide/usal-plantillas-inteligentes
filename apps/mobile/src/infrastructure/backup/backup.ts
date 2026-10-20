import * as SQLite from "expo-sqlite";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { countEntities, exportSessionBundle, restoreSessionBundle, validateBundle, type RestoreReport } from "@plantillas/storage";
import { DATABASE_NAME, closeDatabase, getDatabase } from "../sqlite/database";

/**
 * Respaldo y restauración (etapa 10). Dos mecanismos, con semánticas distintas:
 * - Por sesión: un JSON autocontenido que se comparte y se puede restaurar en
 *   otro teléfono sin pisar nada (idempotente).
 * - Copia completa: la imagen binaria de la base; restaurarla reemplaza todo.
 *   Antes de reemplazar se guarda la base actual en la caché de la app.
 */

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

export async function shareSessionBundle(sessionId: string): Promise<string> {
  const { driver } = await getDatabase();
  const bundle = await exportSessionBundle(driver, sessionId);
  if (!bundle) throw new Error("la sesión no existe");
  const file = new File(Paths.cache, `sesion-${bundle.session.started_at.slice(0, 10)}-${sessionId.slice(0, 8)}.plantillas.json`);
  file.write(JSON.stringify(bundle));
  if (!(await Sharing.isAvailableAsync())) throw new Error("este dispositivo no permite compartir archivos");
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Exportar sesión" });
  return file.uri;
}

/** Elige un archivo .plantillas.json y lo restaura. Devuelve null si el usuario canceló. */
export async function importSessionBundle(): Promise<RestoreReport | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets[0]) return null;
  const text = await new File(picked.assets[0].uri).text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("el archivo no contiene JSON válido"); }
  const bundle = validateBundle(parsed);
  const { driver } = await getDatabase();
  return restoreSessionBundle(driver, bundle);
}

/** Comparte una imagen completa de la base (archivo .db). */
export async function shareDatabaseCopy(): Promise<{ uri: string; bytes: number; counts: Record<string, number> }> {
  const { driver } = await getDatabase();
  const image = await driver.serialize();
  const counts = await countEntities(driver);
  const file = new File(Paths.cache, `plantillas-${stamp()}.db`);
  file.write(image);
  if (!(await Sharing.isAvailableAsync())) throw new Error("este dispositivo no permite compartir archivos");
  await Sharing.shareAsync(file.uri, { mimeType: "application/octet-stream", dialogTitle: "Copia completa de la base" });
  return { uri: file.uri, bytes: image.byteLength, counts };
}

/**
 * Reemplaza la base por una copia elegida. La copia se abre primero aparte
 * para comprobar que es una base de la plataforma (tablas y versión) antes de
 * tocar la actual; la actual se guarda en caché por si hay que volver atrás.
 */
export async function restoreDatabaseCopy(): Promise<{ counts: Record<string, number>; safety: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets[0]) return null;
  const bytes = await new File(picked.assets[0].uri).bytes();
  // Comprobación en una base separada (no se toca la actual si falla).
  const probe = await SQLite.deserializeDatabaseAsync(bytes);
  let counts: Record<string, number>;
  try {
    const version = await probe.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const tables = await probe.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    const names = new Set(tables.map((t) => t.name));
    for (const t of ["session", "capture", "record", "sample"]) if (!names.has(t)) throw new Error(`el archivo no es una base de la plataforma (falta la tabla ${t})`);
    if ((version?.user_version ?? 0) < 1) throw new Error("la copia no tiene versión de esquema");
    const n = async (sql: string) => (await probe.getFirstAsync<{ n: number }>(sql))?.n ?? 0;
    counts = { sessions: await n("SELECT COUNT(*) AS n FROM session"), records: await n("SELECT COUNT(*) AS n FROM record"), events: await n("SELECT COUNT(*) AS n FROM event") };
  } finally {
    await probe.closeAsync();
  }
  // Copia de seguridad de la base actual y reemplazo.
  const { driver } = await getDatabase();
  const current = await driver.serialize();
  const safety = new File(Paths.cache, `antes-de-restaurar-${stamp()}.db`);
  safety.write(current);
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  const target = new File(SQLite.defaultDatabaseDirectory as string, DATABASE_NAME);
  target.write(bytes);
  await getDatabase(); // reabre, migra si la copia es de un esquema anterior y recupera sesiones abiertas
  return { counts, safety: safety.uri };
}
