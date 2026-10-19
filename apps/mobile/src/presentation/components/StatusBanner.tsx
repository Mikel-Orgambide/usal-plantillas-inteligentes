import { Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { colors, radius, space } from "../theme/tokens";

export interface StatusBannerProps {
  tone?: "neutral" | "alert";
  icon?: IconName;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: string;
}

/** Banner no intrusivo: surface-elevated (neutral) o alert-soft (alerta); icono + label; acción opcional. */
export function StatusBanner({ tone = "neutral", icon, detail, actionLabel, onAction, children }: StatusBannerProps) {
  const fg = tone === "alert" ? colors.alert : colors.textPrimary;
  return (
    <View style={[styles.banner, { backgroundColor: tone === "alert" ? colors.alertSoft : colors.surfaceElevated }]}>
      {icon ? <Icon name={icon} size={20} color={tone === "alert" ? colors.alert : colors.textSecondary} /> : null}
      <View style={styles.texts}>
        <Text variant="label" color={fg}>{children}</Text>
        {detail ? <Text variant="caption" color={colors.textSecondary}>{detail}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}><Text variant="label" color={colors.accent}>{actionLabel}</Text></Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], paddingHorizontal: space[4], borderRadius: radius.md },
  texts: { flex: 1, gap: 2 },
});
