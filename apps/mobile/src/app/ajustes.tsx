import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useDevice } from "../infrastructure/ble/deviceStore";
import { resolveSource } from "../application/activeSource";
import Constants from "expo-constants";
import { SCENARIOS, type ScenarioName } from "@plantillas/simulator";
import { Chip, Header, ListRow, Screen, Text } from "../presentation/components";
import { colors, size, space } from "../presentation/theme/tokens";
import { loadSettings, saveSettings, type Settings } from "../infrastructure/settings/settings";

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

  return (
    <Screen>
      <Header title="Ajustes" context={`Plantillas Inteligentes · versión ${version}`} onBack={() => router.back()} />

      <Text variant="label" color={colors.textSecondary}>Dispositivo</Text>
      <ListRow title="Fuente de las sesiones nuevas" subtitle={`${source.title} · ${source.detail}`} chevron={false} />
      <ListRow title="Plantillas" subtitle="Estado del dispositivo y búsqueda Bluetooth" onPress={() => router.navigate("/plantillas")} />

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Datos</Text>
      <ListRow title="Unidad" subtitle="cuentas ADC (0–4095) · sin calibración" value="cuentas" chevron={false} />
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Cuando exista una calibración por sensor, acá se podrá elegir N o kg. Hasta entonces los valores se muestran solo en cuentas.</Text>

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
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: size.rowHeight, paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
