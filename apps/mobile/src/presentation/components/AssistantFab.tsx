import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAssistantEnabled } from "../../application/assistantStore";
import { colors, space } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Botón flotante del asistente explicativo (ADR 0012). Abre la pantalla del
 * chat (`/asistente`) como modal a pantalla completa, por encima de la barra
 * inferior; desde el detalle de una sesión le pasa su id para que entre en
 * el contexto. Se renderiza como hermano de `Screen` y sólo cuando el
 * asistente está activado en Ajustes.
 */
export function AssistantFab({ sessionId, bottomOffset = 0 }: { /** Sesión que el usuario está mirando; su detalle entra en el contexto. */ sessionId?: string; /** Aire extra sobre la barra inferior o el pie de la pantalla. */ bottomOffset?: number }) {
  const enabled = useAssistantEnabled();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  if (!enabled) return null;
  return (
    <Pressable
      onPress={() => router.push(sessionId ? { pathname: "/asistente", params: { sessionId } } : "/asistente")}
      accessibilityRole="button"
      accessibilityLabel="Abrir el asistente"
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + bottomOffset + space[4] }, pressed && { opacity: 0.8 }]}
    >
      <Icon name="spark" color={colors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: space[4], width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", elevation: 4 },
});
