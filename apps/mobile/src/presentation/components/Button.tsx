import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { colors, radius, size, space } from "../theme/tokens";

export interface ButtonProps {
  /** `primary` una vez por pantalla; `secondary` por defecto; `danger` solo en la confirmación de «Finalizar». */
  variant?: "primary" | "secondary" | "danger";
  icon?: IconName;
  disabled?: boolean;
  onPress?: () => void;
  children: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ variant = "secondary", icon, disabled, onPress, children, style }: ButtonProps) {
  const fg = variant === "primary" ? colors.onAccent : variant === "danger" ? colors.onAlert : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && { backgroundColor: colors.accent },
        variant === "danger" && { backgroundColor: colors.alert },
        variant === "secondary" && styles.secondary,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={20} color={fg} /> : null}
        <Text variant="bodyMedium" color={fg}>{children}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: size.controlHeight, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space[4], alignSelf: "stretch" },
  secondary: { borderWidth: size.hairline, borderColor: colors.line, backgroundColor: "transparent" },
  content: { flexDirection: "row", alignItems: "center", gap: space[2] },
});
