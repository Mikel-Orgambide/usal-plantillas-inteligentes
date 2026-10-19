import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { colors, formatNumber, radius, space } from "../theme/tokens";

export interface ValueCardProps {
  label: string;
  /** Número (se formatea con espacio de miles) o texto ya formateado. `null` muestra «Sin datos». */
  value: number | string | null;
  unit?: string;
  sub?: string;
  size?: "md" | "xl";
  /** Valor anterior a una desconexión: atenuado + «desactualizado». */
  stale?: boolean;
  /** Pulso breve cuando el valor cambia (en vivo). */
  live?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ValueCard({ label, value, unit, sub, size = "md", stale, live, elevated, style }: ValueCardProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live) return;
    pulse.setValue(0.55);
    Animated.timing(pulse, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [value, live, pulse]);

  const text = value === null ? "Sin datos" : typeof value === "number" ? formatNumber(value) : value;
  const valueColor = value === null ? colors.textSecondary : stale ? colors.stale : colors.textPrimary;

  return (
    <View style={[styles.card, elevated && { backgroundColor: colors.surfaceElevated }, style]}>
      <Text variant="label" color={colors.textSecondary}>
        {label}{stale ? " · desactualizado" : ""}
      </Text>
      <Animated.View style={[styles.valueRow, { opacity: pulse }]}>
        <Text variant={size === "xl" ? "numXl" : "numLg"} color={valueColor} numberOfLines={1} adjustsFontSizeToFit>
          {text}
        </Text>
        {unit && value !== null ? <Text variant="caption" color={colors.textSecondary} style={styles.unit}>{unit}</Text> : null}
      </Animated.View>
      {sub ? <Text variant="caption" color={colors.textSecondary}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space[4], gap: space[2], minWidth: 0 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: space[1] },
  unit: { paddingBottom: 4 },
});
