import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { CHANNEL_CODES, CHANNEL_POSITIONS, SIMULATED_CONFIGURATION } from "@plantillas/contract";
import { Button, Card, Chip, Header, Icon, Screen, Text } from "../presentation/components";
import { colors, fonts, radius, size, space } from "../presentation/theme/tokens";
import { ACTIVITY_LABEL, startSession, type Activity } from "../application/sessionStore";

const ZONE_LABEL = { heel: "Talón", forefoot_medial: "Medial", forefoot_lateral: "Lateral" } as const;

/** Preparación: actividad, contexto y las seis posiciones reconocidas. */
export default function PrepareScreen() {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity>("caminata");
  const [context, setContext] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const recognized = CHANNEL_CODES.filter((c) => SIMULATED_CONFIGURATION.channels.some((ch) => ch.code === c));
  const allOk = recognized.length === 6;

  const start = async () => {
    setStarting(true);
    setError(undefined);
    try {
      await startSession(activity, context.trim() || undefined);
      router.replace("/grabacion");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  return (
    <Screen footer={<Button variant="primary" icon="play" disabled={!allOk || starting} onPress={() => void start()}>{starting ? "Iniciando…" : "Iniciar"}</Button>}>
      <Header title="Nueva sesión" status="connected" context="Simulador · SIM-001 · plantillas simuladas" onBack={() => router.back()} />

      <Text variant="label" color={colors.textSecondary} style={{ marginBottom: space[2] }}>Actividad</Text>
      <View style={styles.chips}>
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
          <Chip key={a} variant={a === activity ? "selected" : "neutral"} icon={a === activity ? "check" : undefined} onPress={() => setActivity(a)}>{ACTIVITY_LABEL[a]}</Chip>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6], marginBottom: space[2] }}>Contexto (opcional)</Text>
      <TextInput
        value={context}
        onChangeText={setContext}
        placeholder="Calzado, superficie, notas"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        maxLength={120}
      />

      <View style={{ marginTop: space[6] }}>
        <Card title="Dispositivo">
          <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: space[3] }}>
            {SIMULATED_CONFIGURATION.device_id} · simulado · {SIMULATED_CONFIGURATION.configuration_id} · cuentas ADC 0–4095
          </Text>
          <View style={styles.grid}>
            {CHANNEL_CODES.map((code) => {
              const pos = CHANNEL_POSITIONS[code];
              const ok = recognized.includes(code);
              return (
                <View key={code} style={styles.posRow}>
                  <Icon name={ok ? "check" : "alert"} size={20} color={ok ? colors.accent : colors.alert} />
                  <Text variant="body" color={ok ? colors.textPrimary : colors.alert}>{ZONE_LABEL[pos.zone]} {pos.foot === "left" ? "izq." : "der."}</Text>
                  <Text variant="caption" color={colors.textSecondary} style={{ marginLeft: "auto" }}>{code}</Text>
                </View>
              );
            })}
          </View>
          <Text variant="caption" color={allOk ? colors.textSecondary : colors.alert} style={{ marginTop: space[3] }}>
            {recognized.length} de 6 posiciones reconocidas{allOk ? "" : " · no se puede iniciar"}
          </Text>
        </Card>
      </View>
      {error ? <Text variant="caption" color={colors.alert} style={{ marginTop: space[3] }}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  input: { height: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: space[4], rowGap: space[2] },
  posRow: { width: "46%", flexDirection: "row", alignItems: "center", gap: space[2], height: 40 },
});
