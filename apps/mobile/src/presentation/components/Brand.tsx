import { StyleSheet, View, type ViewProps } from "react-native";
import { Text as RNText } from "react-native";
import { colors, fonts } from "../theme/tokens";

export interface BrandProps extends ViewProps {
  /** Alto de las letras en px. */
  size?: number;
  /** `full` = «.NSL»; `mark` = «.N» (reducción para tamaños chicos). */
  variant?: "full" | "mark";
  /** Color de las letras (por defecto text-primary). El punto siempre va en `accent`. */
  color?: string;
}

/**
 * Marca «.NSL» (ADR 0009): letras en Manrope 800 con tracking cerrado y un punto
 * en `accent` apoyado en la línea base, delante de la N. El punto es el símbolo
 * del apoyo que miden los sensores (mismo círculo que FootMap); nunca se reemplaza
 * por un «.» tipográfico ni se saca. Dibujada con vistas y texto para que escale.
 */
export function Brand({ size = 28, variant = "full", color = colors.textPrimary, style, ...rest }: BrandProps) {
  const letters = variant === "mark" ? "N" : "NSL";
  const dot = Math.round(size * 0.26);
  const gap = Math.round(size * 0.12);
  // Manrope 800 con cap-height ≈ 0,72 em: el alto pedido es el de las mayúsculas.
  const fontSize = size / 0.72;
  return (
    <View {...rest} style={[styles.row, style]} accessibilityRole="image" accessibilityLabel="NSL · Plantillas inteligentes">
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.accent, marginRight: gap, marginBottom: Math.round(size * 0.02) }} />
      <RNText style={{ fontFamily: fonts.extrabold, fontSize, lineHeight: Math.round(fontSize * 1.05), letterSpacing: -0.04 * fontSize, color, includeFontPadding: false }}>{letters}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", alignSelf: "flex-start" },
});
