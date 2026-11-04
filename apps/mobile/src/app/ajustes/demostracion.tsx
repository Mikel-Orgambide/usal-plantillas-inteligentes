import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { SCENARIOS, type ScenarioName } from "@plantillas/simulator";
import { useDevice } from "../../infrastructure/ble/deviceStore";
import { resolveSource } from "../../application/activeSource";
import { Chip, Header, ListRow, Screen, Text } from "../../presentation/components";
import { colors, size, space } from "../../presentation/theme/tokens";
import { loadSettings, saveSettings, type Settings } from "../../infrastructure/settings/settings";

const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

function Toggle({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={colors.textSecondary}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accentSoft, false: colors.line }} thumbColor={value ? colors.accent : colors.textSecondary} />
    </View>
  );
}

/** Demostración: simulador sin plantillas, escenario de falla y pantalla encendida. */
export default function DemoScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = (patch: Partial<Settings>) => setSettings(saveSettings(patch));
  const source = resolveSource(useDevice(), settings);

  return (
    <Screen>
      <Header title="Demostración" context="Simulador y opciones de grabación" onBack={() => router.back()} />
      <ListRow title="Fuente de las sesiones nuevas" subtitle={`${source.title} · ${source.detail}`} chevron={false} />
      <Toggle label="Simulador sin plantillas" detail="Si no hay plantillas conectadas, las sesiones usan el simulador y se marcan «Simulada». Con plantillas conectadas se usan siempre las plantillas." value={settings.simulatorMode} onChange={(v) => update({ simulatorMode: v })} />
      <Toggle label="Simular dos módulos" detail="Dos fuentes simuladas, una por pie, con relojes de distinto origen y deriva: prueba la sesión bilateral (ADR 0011) sin hardware. Apagado: una placa simulada de seis posiciones." value={settings.simulatorBilateral} onChange={(v) => update({ simulatorBilateral: v })} />
      <Toggle label="Pantalla encendida al grabar" detail="Evita que Android pause la captura." value={settings.keepAwake} onChange={(v) => update({ keepAwake: v })} />
      <View style={{ marginTop: space[6], gap: space[2] }}>
        <Text variant="body">Escenario del simulador</Text>
        <Text variant="caption" color={colors.textSecondary}>Para verificación: cada escenario introduce una falla conocida en los primeros registros.</Text>
        <View style={styles.chips}>
          {SCENARIO_NAMES.map((name) => (
            <Chip key={name} variant={settings.scenario === name ? "selected" : "neutral"} onPress={() => update({ scenario: name })}>{name}</Chip>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: size.rowHeight, paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
