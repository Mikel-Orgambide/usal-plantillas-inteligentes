import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useDevice } from "../infrastructure/ble/deviceStore";
import { resolveSource } from "../application/activeSource";
import Constants from "expo-constants";
import { SCENARIOS, type ScenarioName } from "@plantillas/simulator";
import { Button, Chip, Header, ListRow, Screen, Sheet, Text } from "../presentation/components";
import { colors, formatNumber, size, space } from "../presentation/theme/tokens";
import { loadSettings, saveSettings, type Settings } from "../infrastructure/settings/settings";
import { importSessionBundle, restoreDatabaseCopy, shareDatabaseCopy } from "../infrastructure/backup/backup";

const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

function Toggle({ label, detail, value, onChange, disabled }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={colors.textSecondary}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.accentSoft, false: colors.line }} thumbColor={value ? colors.accent : colors.textSecondary} />
    </View>
  );
}

/** Ajustes: dispositivo, datos, demostración (simulador y escenario) y acerca de. */
export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = (patch: Partial<Settings>) => setSettings(saveSettings(patch));
  const version = Constants.expoConfig?.version ?? "—";
  const device = useDevice();
  const source = resolveSource(device, settings);
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
      <Header title="Ajustes" context={`Plantillas Inteligentes · versión ${version}`} onBack={() => router.back()} />

      <Text variant="label" color={colors.textSecondary}>Dispositivo</Text>
      <ListRow title="Fuente de las sesiones nuevas" subtitle={`${source.title} · ${source.detail}`} chevron={false} />
      <ListRow title="Plantillas" subtitle="Estado del dispositivo y búsqueda Bluetooth" onPress={() => router.navigate("/plantillas")} />

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Datos</Text>
      <ListRow title="Unidad" subtitle="cuentas ADC (0–4095) · sin calibración" value="cuentas" chevron={false} />
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Cuando exista una calibración por sensor, acá se podrá elegir N o kg. Hasta entonces los valores se muestran solo en cuentas.</Text>

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Respaldo</Text>
      <ListRow title="Importar una sesión" subtitle="Archivo .plantillas.json exportado desde el detalle de una sesión. No modifica sesiones existentes." onPress={busy ? undefined : () => void run("Importar sesión", async () => {
        const r = await importSessionBundle();
        if (!r) return null;
        return r.session === "exists" ? "La sesión ya estaba en este teléfono; no se modificó nada." : `Sesión restaurada: ${r.captures} captura(s), ${r.records_inserted} registros, ${r.events} eventos, ${r.results} resultados.`;
      })} />
      <ListRow title="Copia completa de la base" subtitle="Comparte un archivo .db con todas las sesiones, para guardarlo fuera del teléfono." onPress={busy ? undefined : () => void run("Copia completa", async () => {
        const r = await shareDatabaseCopy();
        return `Copia de ${formatNumber(Math.round(r.bytes / 1024))} KB · ${r.counts["sessions"]} sesiones · ${formatNumber(r.counts["records"] ?? 0)} registros.`;
      })} />
      <ListRow title="Restaurar una copia completa" subtitle="Reemplaza todo lo que hay en este teléfono por el archivo .db elegido." onPress={busy ? undefined : () => setConfirmRestore(true)} />

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Demostración</Text>
      <Toggle label="Simulador sin plantillas" detail="Si no hay plantillas conectadas, las sesiones usan el simulador y se marcan «Simulada». Con plantillas conectadas se usan siempre las plantillas." value={settings.simulatorMode} onChange={(v) => update({ simulatorMode: v })} />
      <Toggle label="Pantalla encendida al grabar" detail="Evita que Android pause la captura." value={settings.keepAwake} onChange={(v) => update({ keepAwake: v })} />
      <View style={{ marginTop: space[4], gap: space[2] }}>
        <Text variant="body">Escenario del simulador</Text>
        <Text variant="caption" color={colors.textSecondary}>Para verificación: cada escenario introduce una falla conocida en los primeros registros.</Text>
        <View style={styles.chips}>
          {SCENARIO_NAMES.map((name) => (
            <Chip key={name} variant={settings.scenario === name ? "selected" : "neutral"} onPress={() => update({ scenario: name })}>{name}</Chip>
          ))}
        </View>
      </View>

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Acerca de</Text>
      <ListRow title="Proyecto final de tesis" subtitle="Plantillas instrumentadas · ESP32 · datos locales en el teléfono" chevron={false} />
    </Screen>
    <Sheet visible={confirmRestore} onDismiss={() => setConfirmRestore(false)}>
      <Text variant="heading">Restaurar una copia completa</Text>
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
    <Sheet visible={!!notice} onDismiss={() => setNotice(null)}>
      <Text variant="heading">{notice?.title ?? ""}</Text>
      <Text variant="body" color={colors.textSecondary}>{notice?.body ?? ""}</Text>
      <View style={{ marginTop: space[3] }}><Button onPress={() => setNotice(null)}>Entendido</Button></View>
    </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: size.rowHeight, paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
