import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { colors, space } from "../theme/tokens";

export interface RingProps {
  /** Fracción 0–1 dibujada en color de acento; `null` dibuja el anillo vacío y «—». */
  value: number | null;
  /** Texto grande dentro del anillo («48 %»). */
  text: string;
  /** Texto pequeño debajo del número, dentro del anillo («izq»). */
  inner?: string;
  label: string;
  /** Color del arco principal; el resto del anillo va en `line` (o en `secondColor` si se indica, para repartos). */
  color?: string;
  secondColor?: string;
  size?: number;
  onPress?: () => void;
}

/**
 * Indicador circular: un arco proporcional a `value` sobre un anillo tenue.
 * Para repartos (izquierda/derecha) el resto se pinta de un segundo color,
 * así el anillo completo representa el 100 %.
 */
function RingImpl({ value, text, inner, label, color = colors.accent, secondColor, size = 104, onPress }: RingProps) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  const rest = secondColor ?? colors.line;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}: ${text}`} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.75 }]} hitSlop={6}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={rest} strokeWidth={stroke} fill="none" />
          {value !== null && v > 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap={v >= 1 ? "butt" : "round"} strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          ) : null}
        </Svg>
        <Text variant="numLg" color={value === null ? colors.textSecondary : colors.textPrimary} numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: size - stroke * 3 }}>{text}</Text>
        {inner ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: -2 }}>{inner}</Text> : null}
      </View>
      <View style={styles.labelRow}>
        <Text variant="label" color={colors.textSecondary} numberOfLines={1}>{label}</Text>
        {onPress ? <Icon name="chevron-right" size={14} color={colors.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

export const Ring = memo(RingImpl);

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space[2], flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 2 },
});
