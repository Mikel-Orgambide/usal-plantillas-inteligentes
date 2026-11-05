import { Pressable, StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { colors, formatDuration, radius, space } from "../theme/tokens";
import { useActiveSession } from "../../application/sessionStore";
import { currentItem, restLeft, useActivity, walkSeconds } from "../../application/activityStore";

/**
 * Isla flotante (ajuste 4/11): mientras hay una sesión grabando o un
 * entrenamiento en curso, una pastilla arriba de todas las pantallas muestra
 * el tiempo de grabación y, si corresponde, el descanso o la caminata que
 * corre. Tocarla vuelve a la pantalla de actividad, donde se oculta.
 */
export function ActivityIsland() {
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const session = useActiveSession();
  const run = useActivity();
  const recording = session && !session.result;
  if (path === "/grabacion" || path === "/asistente") return null;
  if (!recording && !run) return null;

  const cur = currentItem(run);
  const rest = run ? restLeft(run) : 0;
  const walking = run?.state.walk && run.state.walk.started_at !== null;
  const parts: string[] = [];
  if (recording) parts.push(`${formatDuration(session.snapshot.durationMs)} grabando`);
  if (run) {
    if (rest > 0) parts.push(`descanso ${formatDuration(rest * 1000)}`);
    else if (walking) parts.push(`caminata ${formatDuration(walkSeconds(run) * 1000)}`);
    else if (cur) parts.push(`${cur.item.name}${cur.sets > 1 ? ` · serie ${cur.setIndex}` : ""}`);
    else parts.push("entrenamiento en curso");
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space[2] }]}>
      <Pressable onPress={() => router.push("/grabacion")} accessibilityRole="button" accessibilityLabel="Volver a la actividad en curso" style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: recording ? colors.accent : colors.alert }]} />
        <Text variant="label" color={colors.textPrimary} numberOfLines={1} style={{ maxWidth: 260 }}>{parts.join(" · ")}</Text>
        <Icon name="chevron-right" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 50 },
  pill: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.line, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
});
