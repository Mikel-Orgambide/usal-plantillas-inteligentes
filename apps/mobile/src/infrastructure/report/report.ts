import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildComparisonReportHtml, buildSessionCsv, buildSessionReportHtml, csvFileName, reportFileName } from "@plantillas/report";
import { exportSessionBundle, type SessionBundle } from "@plantillas/storage";
import { getDatabase } from "../sqlite/database";

/**
 * Informe para revisión profesional (ADR 0010): el HTML lo arma `@plantillas/report`
 * a partir del mismo paquete de sesión del respaldo; acá sólo se convierte a PDF
 * con `expo-print` y se comparte. Requiere build nativa (expo-print).
 */

/** Marca clara inline (misma geometría que docs/diseno/marca/logo-nsl-light.svg). */
const LOGO_LIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><circle cx="150" cy="282" r="34" fill="#5b3fb8"/><text x="200" y="310" font-family="Manrope, sans-serif" font-weight="800" font-size="300" letter-spacing="-12" fill="#16181c">NSL</text></svg>`;

async function loadBundle(sessionId: string): Promise<SessionBundle> {
  const { driver } = await getDatabase();
  const bundle = await exportSessionBundle(driver, sessionId);
  if (!bundle) throw new Error("la sesión no existe");
  return bundle;
}

async function sharePdf(html: string, fileName: string, title: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  if (!(await Sharing.isAvailableAsync())) throw new Error("este dispositivo no permite compartir archivos");
  await Sharing.shareAsync(target.uri, { mimeType: "application/pdf", dialogTitle: title, UTI: "com.adobe.pdf" });
  return target.uri;
}

/** Genera y comparte el informe PDF de una sesión. */
export async function shareSessionReport(sessionId: string): Promise<string> {
  const bundle = await loadBundle(sessionId);
  const { repository } = await getDatabase();
  const all = await repository.listSessions();
  const comparable = all
    .filter((s) => s.id !== sessionId && s.source === bundle.configuration.source && s.user_id === bundle.session.user_id)
    .slice(0, 8)
    .map((s) => ({ id: s.id, started_at: s.started_at, activity: s.activity }));
  const html = buildSessionReportHtml(bundle, {
    transport: bundle.configuration.source === "physical" ? "BLE" : "simulador",
    appVersion: Constants.expoConfig?.version ?? undefined,
    logoSvg: LOGO_LIGHT_SVG,
    comparable,
  });
  return sharePdf(html, reportFileName(bundle), "Informe de sesión (PDF)");
}

/** Genera y comparte el informe PDF de comparación entre dos sesiones. */
export async function shareComparisonReport(aId: string, bId: string): Promise<string> {
  const [a, b] = await Promise.all([loadBundle(aId), loadBundle(bId)]);
  const html = buildComparisonReportHtml(a, b, { appVersion: Constants.expoConfig?.version ?? undefined, logoSvg: LOGO_LIGHT_SVG });
  return sharePdf(html, `informe-comparacion-${aId.slice(0, 8)}-${bId.slice(0, 8)}.pdf`, "Informe de comparación (PDF)");
}

/** Genera y comparte la sesión como CSV (una fila por muestra, valores originales en adc_count). */
export async function shareSessionCsv(sessionId: string): Promise<string> {
  const bundle = await loadBundle(sessionId);
  const target = new File(Paths.cache, csvFileName(bundle));
  if (target.exists) target.delete();
  target.write(buildSessionCsv(bundle));
  if (!(await Sharing.isAvailableAsync())) throw new Error("este dispositivo no permite compartir archivos");
  await Sharing.shareAsync(target.uri, { mimeType: "text/csv", dialogTitle: "Sesión en CSV", UTI: "public.comma-separated-values-text" });
  return target.uri;
}
