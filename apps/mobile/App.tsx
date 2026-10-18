import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { CHANNEL_CODES, FORMAT_VERSION, SIMULATED_CONFIGURATION } from "@plantillas/contract";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plantillas Inteligentes</Text>
      <Text style={styles.subtitle}>Contrato v{FORMAT_VERSION} · {CHANNEL_CODES.length} canales</Text>
      <Text style={styles.caption}>Configuración activa: {SIMULATED_CONFIGURATION.configuration_id} (simulada)</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { fontSize: 16 },
  caption: { fontSize: 13, color: "#666" },
});
