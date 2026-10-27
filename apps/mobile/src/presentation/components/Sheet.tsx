import { useEffect } from "react";
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, size, space } from "../theme/tokens";
import { Icon } from "./Icon";
import { Text } from "./Text";
import type { ReactNode } from "react";

/**
 * Hoja inferior en surface-elevated con radio lg, sobre un fondo atenuado.
 * Se dibuja como capa absoluta dentro del árbol de la app, no con el Modal
 * nativo: en Android el Modal translúcido dejaba desplazados los toques de
 * la pantalla de abajo después de cerrarse. Debe renderizarse como hermano
 * de la pantalla (fuera del ScrollView) para cubrirla completa.
 *
 * Con el teclado abierto la hoja sube (KeyboardAvoidingView) y su contenido
 * se puede desplazar, así los campos y los botones quedan siempre a la vista.
 */
export function Sheet({ visible, onDismiss, floating, title, children }: { visible: boolean; onDismiss?: () => void; /** Tarjeta flotante con margen y bordes redondeados en las cuatro esquinas, con botón de cierre; no toca la barra inferior. */ floating?: boolean; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onDismiss?.(); return true; });
    return () => sub.remove();
  }, [visible, onDismiss]);
  if (!visible) return null;
  return (
    <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior="padding" pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, floating ? [styles.floating, { marginBottom: insets.bottom + space[4] }] : { paddingBottom: insets.bottom + space[6] }]}>
        {title || (floating && onDismiss) ? (
          <View style={styles.titleRow}>
            {title ? <Text variant="heading" style={{ flex: 1 }}>{title}</Text> : <View style={{ flex: 1 }} />}
            {floating && onDismiss ? (
              <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.close}>
                <Icon name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,13,16,0.65)" },
  sheet: { maxHeight: "88%", backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space[6], paddingHorizontal: space[4] },
  content: { gap: space[3] },
  floating: { marginHorizontal: space[4], borderRadius: radius.lg, paddingBottom: space[6] },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[3] },
  close: { width: size.controlHeight - 12, height: size.controlHeight - 12, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});
