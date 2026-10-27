import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { colors, space } from "../theme/tokens";

export interface RingProps {
  /** Fracción 0–1 del primer tramo; `null` dibuja el anillo vacío. */
  value: number | null;
  /** Texto grande dentro del anillo («51 %»). */
  text: string;
  /** Texto pequeño debajo del número, dentro del anillo («izquierdo»). */
  inner?: string;
  label: string;
  /**
   * Geometría del reparto, para que el dibujo coincida con el cuerpo:
   * - `progress`: un arco desde arriba en sentido horario sobre un anillo tenue (calidad).
   * - `sides`: el primer tramo ocupa el lado izquierdo del anillo (desde arriba, en sentido antihorario)
   *   y el segundo tono el lado derecho: izquierda = pie izquierdo.
   * - `top`: el primer tramo se centra arriba (antepié, hacia los dedos) y el segundo tono queda abajo (talón).
   */
  layout?: "progress" | "sides" | "top";
  /** Leyenda con un punto de color por tramo. */
  legend?: readonly [string, string];
  color?: string;
  secondColor?: string;
  size?: number;
  onPress?: () => void;
}

function RingImpl({ value, text, inner, label, layout = "progress", legend, color = colors.accent, secondColor = colors.accentDeep, size = 104, onPress }: RingProps) {
  const stroke = 10;
  const cx = size / 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.min(1, Math.max(0, value));
  const rest = layout === "progress" ? colors.line : value === null ? colors.line : secondColor;
  // Arco horario desde arriba.
  const cw = (fraction: number) => (
    <Circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * fraction} ${c}`} transform={`rotate(-90 ${cx} ${cx})`} />
  );
  // Arco antihorario desde arriba: el mismo trazo reflejado horizontalmente.
  const ccw = (fraction: number) => (
    <G transform={`translate(${size} 0) scale(-1 1)`}>
      <Circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * fraction} ${c}`} transform={`rotate(-90 ${cx} ${cx})`} />
    </G>
  );
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}: ${text}`} style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.75 }]} hitSlop={6}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
          <Circle cx={cx} cy={cx} r={r} stroke={rest} strokeWidth={stroke} fill="none" />
          {value !== null && v > 0 ? (
            layout === "sides" ? ccw(v) : layout === "top" ? <>{cw(v / 2)}{ccw(v / 2)}</> : cw(v)
          ) : null}
        </Svg>
        <Text variant="numLg" color={value === null ? colors.textSecondary : colors.textPrimary} numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: size - stroke * 3 }}>{text}</Text>
        {inner ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: -2 }}>{inner}</Text> : null}
      </View>
      <View style={styles.labelRow}>
        <Text variant="label" color={colors.textPrimary} numberOfLines={1}>{label}</Text>
        {onPress ? <Icon name="chevron-right" size={14} color={colors.textSecondary} /> : null}
      </View>
      {legend ? (
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{legend[0]}</Text>
          <View style={[styles.dot, { backgroundColor: layout === "progress" ? colors.line : secondColor, marginLeft: space[1] }]} />
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{legend[1]}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const Ring = memo(RingImpl);

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space[2], flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  legend: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: -4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
