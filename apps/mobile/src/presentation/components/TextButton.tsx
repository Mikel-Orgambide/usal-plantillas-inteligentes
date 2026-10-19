import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { colors, space } from "../theme/tokens";

/**
 * Acción secundaria en texto («Ver detalle», «Ocultar»). Aunque el texto es
 * chico, la zona táctil mide al menos 44 px de alto.
 */
export function TextButton({ children, onPress, icon, style }: { children: string; onPress: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }} style={({ pressed }) => [styles.base, pressed && { opacity: 0.7 }, style]}>
      <Text variant="label" color={colors.accent}>{children}</Text>
      {icon ? <Icon name={icon} size={16} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space[1], alignSelf: "flex-start", paddingHorizontal: space[1] },
});
