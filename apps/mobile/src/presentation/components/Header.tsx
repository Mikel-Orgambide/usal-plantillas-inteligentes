import { Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { colors, radius, space } from "../theme/tokens";

export interface HeaderProps {
  title: string;
  /** Línea de contexto en caption: «Plantillas-ESP32 · físicas». */
  context?: string;
  status?: "connected" | "searching" | "off";
  action?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

const STATUS_COLOR = { connected: colors.accent, searching: colors.alert, off: colors.stale } as const;

export function Header({ title, context, status, action, actionLabel, onAction }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.main}>
        <Text variant="title">{title}</Text>
        {context ? (
          <View style={styles.contextRow}>
            {status ? <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} /> : null}
            <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>{context}</Text>
          </View>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={8} style={styles.action}>
          <Icon name={action} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: space[3], paddingBottom: space[4] },
  main: { flex: 1, gap: space[1] },
  contextRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  action: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginTop: -2 },
});
