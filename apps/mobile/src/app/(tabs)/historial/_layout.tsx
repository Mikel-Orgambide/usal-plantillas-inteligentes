import { Stack } from "expo-router";
import { colors } from "../../../presentation/theme/tokens";

/** La pestaña Historial es una pila: lista → detalle de sesión → comparación. La barra inferior sigue visible. */
export const unstable_settings = { initialRouteName: "index" };

export default function HistoryStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sesion/[id]" />
      <Stack.Screen name="comparar" />
    </Stack>
  );
}
