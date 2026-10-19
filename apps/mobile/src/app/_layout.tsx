import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";
import { Button, Chip, Sheet, Text, ValueCard } from "../presentation/components";
import { colors, formatDate, formatDuration, space } from "../presentation/theme/tokens";
import { getDatabase } from "../infrastructure/sqlite/database";
import type { SessionRow } from "@plantillas/storage";

/**
 * Raíz de la app: carga la tipografía, abre la base (migraciones y
 * recuperación de sesiones abiertas) y muestra el diálogo «Sesión recuperada
 * como incompleta» cuando corresponde.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold });
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | undefined>();
  const [recovered, setRecovered] = useState<SessionRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    getDatabase()
      .then(async ({ repository, recoveredSessions }) => {
        const rows = (await Promise.all(recoveredSessions.map((id) => repository.getSession(id)))).filter((r): r is SessionRow => !!r);
        setRecovered(rows);
        setReady(true);
      })
      .catch((e: unknown) => { setDbError(e instanceof Error ? e.message : String(e)); setReady(true); });
  }, []);

  if (!fontsLoaded || !ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const first = recovered[0];

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="grabacion" options={{ gestureEnabled: false, animation: "fade" }} />
      </Stack>
      {dbError ? (
        <Sheet visible>
          <Text variant="heading">No se pudo abrir la base local</Text>
          <Text variant="body" color={colors.textSecondary}>{dbError}</Text>
        </Sheet>
      ) : null}
      <Sheet visible={!!first} onDismiss={() => setRecovered([])}>
        {first ? (
          <>
            <Text variant="heading">Sesión recuperada como incompleta</Text>
            <Text variant="body" color={colors.textSecondary}>
              La app se cerró mientras grababa. Lo que llegó quedó guardado y la sesión se marcó como incompleta por cierre inesperado.
            </Text>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <ValueCard label="Grabado" value={formatDuration(first.duration_ms ?? 0)} unit="min" sub={`${formatDate(first.started_at)} · ${first.activity}`} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row" }}>
              <Chip variant="alert">Incompleta · cierre inesperado</Chip>
            </View>
            <View style={{ gap: space[3], marginTop: space[3] }}>
              <Button variant="primary" onPress={() => { const id = first.id; setRecovered([]); router.push({ pathname: "/sesion/[id]", params: { id } }); }}>Ver sesión</Button>
              <Button onPress={() => setRecovered([])}>Más tarde</Button>
            </View>
          </>
        ) : null}
      </Sheet>
    </SafeAreaProvider>
  );
}
