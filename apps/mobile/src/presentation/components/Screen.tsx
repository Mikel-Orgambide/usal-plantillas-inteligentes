import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../theme/tokens";
import type { ReactNode } from "react";

/**
 * Contenedor de pantalla: fondo bg, margen lateral 16, respeta las áreas
 * seguras. `footer` queda fijo al pie con 32 de aire arriba (botón principal).
 */
export function Screen({ children, footer, scroll = true, tabbed = false, style }: { children: ReactNode; footer?: ReactNode; scroll?: boolean; /** La pantalla vive bajo la barra inferior: el pie no repite el área segura. */ tabbed?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const bottom = tabbed ? 0 : insets.bottom;
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">{children}</ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
  );
  return (
    <View style={[styles.root, { paddingTop: insets.top + space[4] }]}>
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: bottom + space[4] }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space[4], paddingBottom: space[6] },
  footer: { paddingHorizontal: space[4], paddingTop: space[8], gap: space[3] },
});
