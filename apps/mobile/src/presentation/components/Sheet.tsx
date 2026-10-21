import { useEffect } from "react";
import { BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "../theme/tokens";
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
export function Sheet({ visible, onDismiss, children }: { visible: boolean; onDismiss?: () => void; children: ReactNode }) {
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
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space[6] }]}>
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,13,16,0.65)" },
  sheet: { maxHeight: "88%", backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space[6], paddingHorizontal: space[4] },
  content: { gap: space[3] },
});
