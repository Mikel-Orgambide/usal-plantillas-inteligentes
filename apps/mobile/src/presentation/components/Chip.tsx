import { Pressable, StyleSheet } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { colors, radius, space } from "../theme/tokens";

export interface ChipProps {
  /** `neutral` filtro; `selected` activo; `alert` incompleta/faltante; `sim` procedencia simulada. */
  variant?: "neutral" | "selected" | "alert" | "sim";
  icon?: IconName;
  onPress?: () => void;
  children: string;
}

export function Chip({ variant = "neutral", icon, onPress, children }: ChipProps) {
  const fg = variant === "selected" ? colors.accent : variant === "alert" ? colors.alert : colors.textSecondary;
  const bg = variant === "selected" ? colors.accentSoft : variant === "alert" ? colors.alertSoft : colors.surface;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: variant === "selected" }}
      style={({ pressed }) => [styles.chip, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" color={fg}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: space[1], height: 32, paddingHorizontal: space[3], borderRadius: radius.sm },
});
