import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, radius, size, space } from "../theme/tokens";

export interface MeterRowProps {
  label: string;
  /** Fracción 0–1 de la barra; `null` deja la barra vacía. */
  fraction: number | null;
  /** Valor ya formateado a la derecha. */
  value: string;
  /** Barra centrada: la fracción se dibuja desde el centro hacia la derecha (positiva) o la izquierda (negativa), −1…1. */
  centered?: boolean;
  color?: string;
}

/** Fila de desglose: etiqueta, barra proporcional y valor, como en un panel de indicadores. */
export function MeterRow({ label, fraction, value, centered, color = colors.accent }: MeterRowProps) {
  const f = fraction === null ? 0 : Math.max(-1, Math.min(1, fraction));
  return (
    <View style={styles.row}>
      <Text variant="body" color={colors.textPrimary} style={{ flex: 1 }} numberOfLines={1}>{label}</Text>
      <View style={styles.track}>
        {centered ? (
          <>
            <View style={styles.mid} />
            <View style={[styles.fill, { backgroundColor: color, left: f >= 0 ? "50%" : `${50 + f * 50}%`, width: `${Math.abs(f) * 50}%` }]} />
          </>
        ) : (
          <View style={[styles.fill, { backgroundColor: color, left: 0, width: `${Math.max(0, f) * 100}%` }]} />
        )}
      </View>
      <Text variant="numMd" color={fraction === null ? colors.textSecondary : colors.textPrimary} style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 40 },
  track: { width: 96, height: 6, borderRadius: radius.pill, backgroundColor: colors.line, overflow: "hidden" },
  fill: { position: "absolute", top: 0, bottom: 0, borderRadius: radius.pill },
  mid: { position: "absolute", left: "50%", top: -2, bottom: -2, width: size.hairline, backgroundColor: colors.textSecondary },
  value: { minWidth: 64, textAlign: "right" },
});
