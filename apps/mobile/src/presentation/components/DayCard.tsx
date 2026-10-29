import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "./Text";
import { colors, radius, space } from "../theme/tokens";
import type { ReactNode } from "react";

export interface DayCardProps {
  /** Encabezado a la izquierda («mar 27 oct»). Sin título, la tarjeta es sólo el contenedor degradado (resumen). */
  title?: string;
  /** Texto a la derecha del encabezado («4 sesiones · 01:36 min»). */
  aside?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Relleno interior; las listas de filas lo ponen en 0 y cada fila trae el suyo. */
  padded?: boolean;
}

/**
 * Tarjeta con degradado vertical surface-elevated → surface y borde `line`
 * al 60 % (Figma «Card · día» y «Card · resumen»). El degradado se dibuja con
 * SVG para no sumar módulos nativos.
 */
export function DayCard({ title, aside, children, style, padded = true }: DayCardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <LinearGradient id="dayCard" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surfaceElevated} />
            <Stop offset="1" stopColor={colors.surface} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill="url(#dayCard)" />
      </Svg>
      {title ? (
        <View style={[styles.header, !padded && { paddingHorizontal: space[4] }]}>
          <Text variant="heading">{title}</Text>
          {aside ? <Text variant="caption" color={colors.textSecondary}>{aside}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line + "99", overflow: "hidden", backgroundColor: colors.surface },
  padded: { padding: space[4] },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], paddingTop: space[4], paddingBottom: space[2] },
});
