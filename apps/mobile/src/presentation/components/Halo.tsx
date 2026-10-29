import { StyleSheet } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { colors } from "../theme/tokens";

/**
 * Halo superior: resplandor radial del acento (12 % → 0 %) detrás de la
 * cabecera, como en Figma («Halo superior»). Es decorativo: no recibe toques
 * y se dibuja detrás del contenido.
 */
export function Halo({ height = 360 }: { height?: number }) {
  return (
    <Svg pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]} width="100%" height={height} preserveAspectRatio="none" viewBox="0 0 412 360">
      <Defs>
        <RadialGradient id="halo" cx="206" cy="340" rx="130" ry="180" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="206" cy="340" rx="260" ry="360" fill="url(#halo)" />
    </Svg>
  );
}
