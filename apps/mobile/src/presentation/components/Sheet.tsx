import { Modal, Pressable, StyleSheet, View } from "react-native";
import { colors, radius, space } from "../theme/tokens";
import type { ReactNode } from "react";

/** Hoja inferior en surface-elevated con radio lg, sobre un fondo atenuado. */
export function Sheet({ visible, onDismiss, children }: { visible: boolean; onDismiss?: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={styles.sheet}>{children}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,13,16,0.65)" },
  sheet: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space[6], paddingHorizontal: space[4], gap: space[3] },
});
