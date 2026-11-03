import { memo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { Text } from "./Text";
import { colors, fonts, formatNumber, space } from "../theme/tokens";

/**
 * Dos siluetas de pie con tres puntos cada una (talón, medial, lateral).
 * El anillo crece y el punto gana opacidad con valor/4095; el número va
 * siempre junto al punto. Sin interpolación ni mapa de calor (restricción
 * de la tesis). `null` = sin datos; `"unavailable"` = posición no
 * instrumentada por la configuración (se dibuja gris, discontinua y con «n/d»,
 * nunca como cero); `stale` atenúa todo.
 */

/** `number` lectura · `null` instrumentada sin dato · `"unavailable"` no instrumentada. */
export type FootValue = number | null | "unavailable";
export interface FootValues { heel: FootValue; medial: FootValue; lateral: FootValue }

/** Valores de un pie que la configuración no instrumenta. */
export const FOOT_UNAVAILABLE: FootValues = { heel: "unavailable", medial: "unavailable", lateral: "unavailable" };

export interface FootMapProps {
  left: FootValues;
  right: FootValues;
  stale?: boolean;
  caption?: string;
  max?: number;
}

const FOOT_D = "M98 10C124 10 138 36 134 70 130 100 120 118 118 140 116 170 126 196 122 222 118 248 98 256 80 254 60 252 46 236 46 212 46 184 40 150 34 120 26 90 22 56 44 30 58 16 78 12 98 10Z";
const POINTS: Record<keyof FootValues, { x: number; y: number; label: string; ly: number; vy: number }> = {
  heel: { x: 84, y: 210, label: "Talón", ly: 184, vy: 244 },
  medial: { x: 104, y: 76, label: "Medial", ly: 46, vy: 112 },
  lateral: { x: 50, y: 72, label: "Lateral", ly: 42, vy: 108 },
};

function Foot({ side, values, stale, max, width }: { side: "left" | "right"; values: FootValues; stale: boolean; max: number; width: number }) {
  const right = side === "right";
  const mx = (x: number) => (right ? 150 - x : x);
  const ink = stale ? colors.stale : colors.textPrimary;
  const accent = stale ? colors.stale : colors.accent;
  const height = (width * 260) / 150;
  const wholeFootUnavailable = values.heel === "unavailable" && values.medial === "unavailable" && values.lateral === "unavailable";
  return (
    <View style={{ width, alignItems: "center", gap: space[1] }}>
      <Text variant="caption" color={colors.textSecondary}>{right ? "Derecho" : "Izquierdo"}{wholeFootUnavailable ? " · no instrumentado" : ""}</Text>
      <Svg width={width} height={height} viewBox="0 0 150 260">
        <Path d={FOOT_D} fill="none" stroke={colors.line} strokeWidth={1.5} transform={right ? "translate(150 0) scale(-1 1)" : undefined} />
        {(Object.keys(POINTS) as (keyof FootValues)[]).map((k) => {
          const p = POINTS[k];
          const v = values[k];
          const unavailable = v === "unavailable";
          const none = unavailable || v === null || v === undefined;
          const t = none ? 0 : Math.max(0, Math.min(1, (v as number) / max));
          return (
            <G key={k}>
              <SvgText x={mx(p.x)} y={p.ly} textAnchor="middle" fontFamily={fonts.medium} fontSize={11} fill={unavailable ? colors.stale : colors.textSecondary}>{p.label}</SvgText>
              <Circle cx={mx(p.x)} cy={p.y} r={6 + 10 * t} fill="none" stroke={unavailable ? colors.stale : accent} strokeWidth={1.5} strokeDasharray={none ? "3 3" : undefined} opacity={unavailable ? 0.35 : none ? 0.5 : 0.35 + 0.65 * t} />
              <Circle cx={mx(p.x)} cy={p.y} r={5} fill={accent} opacity={none ? 0 : 0.25 + 0.75 * t} />
              <SvgText x={mx(p.x)} y={p.vy} textAnchor="middle" fontFamily={fonts.semibold} fontSize={unavailable ? 13 : 18} fill={unavailable ? colors.stale : none ? colors.textSecondary : ink}>
                {unavailable ? "n/d" : none ? "—" : formatNumber(v as number)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function FootMapImpl({ left, right, stale = false, caption, max = 4095 }: FootMapProps) {
  const { width: screen } = useWindowDimensions();
  const footWidth = Math.min(150, (screen - space[4] * 2 - space[4]) / 2);
  const all = [left.heel, left.medial, left.lateral, right.heel, right.medial, right.lateral];
  const missing = all.filter((v) => v === null).length;
  const unavailable = all.filter((v) => v === "unavailable").length;
  const auto = `cuentas ADC · 0–${formatNumber(max)}${stale ? " · desactualizado" : ""}${missing ? ` · ${missing} ${missing === 1 ? "posición sin datos" : "posiciones sin datos"}` : ""}${unavailable ? ` · ${unavailable} no instrumentada${unavailable === 1 ? "" : "s"}` : ""}`;
  return (
    <View style={styles.wrap}>
      <View style={styles.feet}>
        <Foot side="left" values={left} stale={stale} max={max} width={footWidth} />
        <Foot side="right" values={right} stale={stale} max={max} width={footWidth} />
      </View>
      <Text variant="caption" color={colors.textSecondary} style={{ textAlign: "center" }}>{caption ?? auto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  feet: { flexDirection: "row", justifyContent: "center", gap: space[4] },
});

const sameFoot = (a: FootValues, b: FootValues) => a.heel === b.heel && a.medial === b.medial && a.lateral === b.lateral;

/** Memorizado por valores: solo se redibuja cuando cambia alguna de las seis lecturas o el estado. */
export const FootMap = memo(FootMapImpl, (prev, next) =>
  prev.stale === next.stale && prev.caption === next.caption && prev.max === next.max && sameFoot(prev.left, next.left) && sameFoot(prev.right, next.right));
