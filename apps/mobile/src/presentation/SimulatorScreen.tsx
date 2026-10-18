import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CHANNEL_POSITIONS, FORMAT_VERSION, SIMULATED_CONFIGURATION, type ChannelCode } from "@plantillas/contract";
import { SCENARIOS, type ScenarioName } from "@plantillas/simulator";
import { useSimulatedCapture, type ChannelValue } from "../application/useSimulatedCapture";

/**
 * Pantalla de verificación de la etapa 2. No es la interfaz final: solo
 * permite comprobar en el teléfono que fuente, validación y secuencia
 * funcionan con cada modo de prueba.
 */

const LEFT: ChannelCode[] = ["L_HEEL", "L_MEDIAL", "L_LATERAL"];
const RIGHT: ChannelCode[] = ["R_HEEL", "R_MEDIAL", "R_LATERAL"];
const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

function Channel({ code, v }: { code: ChannelCode; v: ChannelValue }) {
  const label = CHANNEL_POSITIONS[code].zone.replace("forefoot_", "");
  const text = v.status === "read_error" ? "error" : v.value === null ? "—" : String(v.value);
  return (
    <View style={[styles.channel, v.status === "stale" && styles.stale, v.status === "read_error" && styles.error]}>
      <Text style={styles.channelLabel}>{label}</Text>
      <Text style={styles.channelValue}>{text}</Text>
    </View>
  );
}

export function SimulatorScreen() {
  const [scenario, setScenario] = useState<ScenarioName>("normal");
  const { running, values, stats, start, stop } = useSimulatedCapture(scenario, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simulador · contrato v{FORMAT_VERSION}</Text>
      <Text style={styles.caption}>{SIMULATED_CONFIGURATION.configuration_id} · procedencia simulada · 5 registros/s (verificación)</Text>

      <View style={styles.feet}>
        <View style={styles.foot}>
          <Text style={styles.footLabel}>Izquierdo</Text>
          {LEFT.map((c) => <Channel key={c} code={c} v={values[c]} />)}
        </View>
        <View style={styles.foot}>
          <Text style={styles.footLabel}>Derecho</Text>
          {RIGHT.map((c) => <Channel key={c} code={c} v={values[c]} />)}
        </View>
      </View>

      <View style={styles.stats}>
        <Text style={styles.stat}>Captura: {stats.captureId ?? "—"}</Text>
        <Text style={styles.stat}>Recibidos {stats.received} · aceptados {stats.accepted} · rechazados {stats.rejected}</Text>
        <Text style={styles.stat}>Secuencia {stats.lastSequence ?? "—"} · duplicados {stats.duplicates} · huecos {stats.gaps} · fuera de orden {stats.outOfOrder}</Text>
        <Text style={styles.stat}>Último evento: {stats.lastEvent ?? "—"}</Text>
        <Text style={styles.stat}>Última lectura fallida: {stats.lastReadError ?? "—"}</Text>
        {stats.lastError ? <Text style={[styles.stat, styles.errorText]} numberOfLines={2}>Último rechazo: {stats.lastError}</Text> : null}
      </View>

      <View style={styles.scenarios}>
        {SCENARIO_NAMES.map((name) => (
          <Pressable
            key={name}
            disabled={running}
            onPress={() => setScenario(name)}
            style={[styles.chip, scenario === name && styles.chipActive, running && styles.chipDisabled]}
          >
            <Text style={[styles.chipText, scenario === name && styles.chipTextActive]}>{name}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={running ? stop : start} style={[styles.button, running && styles.buttonStop]}>
        <Text style={styles.buttonText}>{running ? "Detener" : "Iniciar captura simulada"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 64, paddingHorizontal: 20, gap: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  caption: { fontSize: 13, color: "#666" },
  feet: { flexDirection: "row", gap: 12 },
  foot: { flex: 1, gap: 8 },
  footLabel: { fontSize: 13, color: "#666", textAlign: "center" },
  channel: { borderRadius: 10, backgroundColor: "#f2f2f4", padding: 12, alignItems: "center" },
  stale: { opacity: 0.4 },
  error: { backgroundColor: "#fde8e8" },
  channelLabel: { fontSize: 12, color: "#666" },
  channelValue: { fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "500" },
  stats: { gap: 4 },
  stat: { fontSize: 13, color: "#333" },
  errorText: { color: "#b00020" },
  scenarios: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#f2f2f4" },
  chipActive: { backgroundColor: "#111" },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 12, color: "#333" },
  chipTextActive: { color: "#fff" },
  button: { marginTop: "auto", marginBottom: 32, backgroundColor: "#111", borderRadius: 12, padding: 16, alignItems: "center" },
  buttonStop: { backgroundColor: "#b00020" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
