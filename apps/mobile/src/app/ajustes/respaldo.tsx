import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Header, ListRow, Screen, Sheet, Text } from "../../presentation/components";
import { colors, formatNumber, space } from "../../presentation/theme/tokens";
import { importSessionBundle, restoreDatabaseCopy, shareDatabaseCopy } from "../../infrastructure/backup/backup";

/** Respaldo (ADR 0007): importar una sesión, copia completa de la base y restauración. */
export default function BackupScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => Promise<string | null>) => {
    setBusy(true);
    try {
      const result = await fn();
      if (result !== null) setNotice({ title: label, body: result });
    } catch (e) {
      setNotice({ title: `${label}: no se pudo`, body: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Screen>
      <Header title="Respaldo" context="Copias fuera del teléfono, independientes de la cuenta" onBack={() => router.back()} />
      <Text variant="label" color={colors.textSecondary}>Por sesión</Text>
      <ListRow title="Exportar una sesión" subtitle="Desde el detalle de cada sesión, con el ícono de compartir: genera un archivo .plantillas.json" chevron={false} />
      <ListRow title="Importar una sesión" subtitle="Archivo .plantillas.json. No modifica sesiones existentes." onPress={busy ? undefined : () => void run("Importar sesión", async () => {
        const r = await importSessionBundle();
        if (!r) return null;
        return r.session === "exists" ? "La sesión ya estaba en este teléfono; no se modificó nada." : `Sesión restaurada: ${r.captures} captura(s), ${r.records_inserted} registros, ${r.events} eventos, ${r.results} resultados.`;
      })} />

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Base completa</Text>
      <ListRow title="Copia completa de la base" subtitle="Comparte un archivo .db con todas las sesiones de todas las cuentas de este teléfono." onPress={busy ? undefined : () => void run("Copia completa", async () => {
        const r = await shareDatabaseCopy();
        return `Copia de ${formatNumber(Math.round(r.bytes / 1024))} KB · ${r.counts["sessions"]} sesiones · ${formatNumber(r.counts["records"] ?? 0)} registros.`;
      })} />
      <ListRow title="Restaurar una copia completa" subtitle="Reemplaza todo lo que hay en este teléfono por el archivo .db elegido." onPress={busy ? undefined : () => setConfirmRestore(true)} />
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>El respaldo por archivo y la sincronización con la cuenta son mecanismos distintos: el archivo sirve para cambiar de teléfono o guardar una copia; la cuenta, para consultar las sesiones fuera del teléfono.</Text>
    </Screen>
    <Sheet visible={confirmRestore} onDismiss={() => setConfirmRestore(false)} floating title="Restaurar una copia completa">
      <Text variant="body" color={colors.textSecondary}>
        Se reemplazan todas las sesiones de este teléfono por las del archivo. Antes de reemplazar se guarda la base actual en la caché de la app. La copia se comprueba aparte antes de tocar nada.
      </Text>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        <Button variant="danger" icon="import" onPress={() => { setConfirmRestore(false); void run("Restaurar copia", async () => {
          const r = await restoreDatabaseCopy();
          return r ? `Base restaurada: ${r.counts["sessions"]} sesiones · ${formatNumber(r.counts["records"] ?? 0)} registros. La anterior quedó guardada en la caché.` : null;
        }); }}>Reemplazar todo</Button>
        <Button onPress={() => setConfirmRestore(false)}>Cancelar</Button>
      </View>
    </Sheet>
    <Sheet visible={!!notice} onDismiss={() => setNotice(null)} floating title={notice?.title ?? ""}>
      <Text variant="body" color={colors.textSecondary}>{notice?.body ?? ""}</Text>
    </Sheet>
    </>
  );
}
