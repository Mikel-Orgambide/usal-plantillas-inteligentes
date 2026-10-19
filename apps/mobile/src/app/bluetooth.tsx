import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Header, ListRow, Screen, StatusBanner, Text } from "../presentation/components";
import { colors, space } from "../presentation/theme/tokens";

/** Conexión Bluetooth. La búsqueda real llega en la etapa 8; hasta entonces la única fuente es el simulador. */
export default function BluetoothScreen() {
  const router = useRouter();
  return (
    <Screen footer={<><Button icon="search" disabled>Buscar de nuevo</Button><Button variant="primary" onPress={() => router.back()}>Usar el simulador</Button></>}>
      <Header title="Conectar plantillas" status="off" context="Bluetooth no disponible todavía" onBack={() => router.back()} />
      <StatusBanner icon="bluetooth" detail="La conexión con el ESP32 se incorpora en la etapa 8. Mientras tanto, las sesiones usan el simulador y se marcan «Simulada».">
        Búsqueda de dispositivos pendiente
      </StatusBanner>
      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Fuentes disponibles</Text>
      <ListRow title="Simulador" subtitle="SIM-001 · configuración SIM-CONFIG-001 · 6 posiciones" selected chevron={false} />
      <View style={{ marginTop: space[6] }}>
        <Card title="Al conectar">
          <View style={{ gap: space[2] }}>
            {["La app lee la configuración del dispositivo y reconoce las seis posiciones.", "Las lecturas llegan en cuentas ADC (0–4095) hasta que exista calibración.", "El dispositivo queda guardado y se reconecta solo en la próxima sesión."].map((t, i) => (
              <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
                <Text variant="body">{i + 1}</Text>
                <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
