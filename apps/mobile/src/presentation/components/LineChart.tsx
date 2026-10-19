import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { G, Line, Path, Text as SvgText } from "react-native-svg";
import { Text } from "./Text";
import { colors, fonts, formatNumber, space } from "../theme/tokens";

/**
 * Gráfico de línea con huecos visibles: un `null` corta la línea y deja un
 * tramo punteado sobre el eje. Sin área rellena, sin suavizado, sin puntos.
 * La primera serie va en accent; la segunda en text-secondary.
 */

export interface LineSeries {
  name: string;
  values: Array<number | null>;
  stale?: boolean;
}

export interface LineChartProps {
  series: LineSeries[];
  max?: number;
  height?: number;
  startLabel?: string;
  endLabel?: string;
  ticks?: Array<{ at: number; label: string }>;
  label?: string;
}

const PAD_LEFT = 36;
const PAD_BOTTOM = 18;
const PAD_TOP = 6;

function buildPath(values: Array<number | null>, w: number, h: number, max: number): { line: string; gaps: [number, number][] } {
  const n = values.length;
  if (n === 0) return { line: "", gaps: [] };
  const x = (i: number) => PAD_LEFT + (n === 1 ? 0 : (i / (n - 1)) * (w - PAD_LEFT));
  const y = (v: number) => PAD_TOP + (1 - Math.max(0, Math.min(1, v / max))) * (h - PAD_TOP - PAD_BOTTOM);
  let d = "";
  let open = false;
  const gaps: [number, number][] = [];
  let gapStart: number | null = null;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      if (gapStart === null) gapStart = i;
      return;
    }
    if (gapStart !== null) {
      gaps.push([x(gapStart), x(i)]);
      gapStart = null;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    open = true;
  });
  if (gapStart !== null) gaps.push([x(gapStart), x(n - 1)]);
  return { line: d, gaps };
}

export function LineChart({ series, max = 4095, height = 120, startLabel, endLabel, ticks, label }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const axisY = height - PAD_BOTTOM;
  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {label ? <Text variant="caption" color={colors.textSecondary}>{label}</Text> : null}
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={axisY} stroke={colors.line} strokeWidth={1} />
          <Line x1={PAD_LEFT} y1={axisY} x2={width} y2={axisY} stroke={colors.line} strokeWidth={1} />
          <SvgText x={PAD_LEFT - 6} y={PAD_TOP + 10} textAnchor="end" fontFamily={fonts.regular} fontSize={11} fill={colors.textSecondary}>{formatNumber(max)}</SvgText>
          <SvgText x={PAD_LEFT - 6} y={axisY} textAnchor="end" fontFamily={fonts.regular} fontSize={11} fill={colors.textSecondary}>0</SvgText>
          {ticks?.map((t) => {
            const tx = PAD_LEFT + t.at * (width - PAD_LEFT);
            return (
              <SvgText key={t.label} x={tx} y={height - 4} textAnchor="middle" fontFamily={fonts.regular} fontSize={11} fill={colors.textSecondary}>{t.label}</SvgText>
            );
          })}
          {startLabel ? <SvgText x={PAD_LEFT} y={height - 4} textAnchor="start" fontFamily={fonts.regular} fontSize={11} fill={colors.textSecondary}>{startLabel}</SvgText> : null}
          {endLabel ? <SvgText x={width} y={height - 4} textAnchor="end" fontFamily={fonts.regular} fontSize={11} fill={colors.textSecondary}>{endLabel}</SvgText> : null}
          {series.map((s, idx) => {
            const { line, gaps } = buildPath(s.values, width, height, max);
            const stroke = s.stale ? colors.stale : idx === 0 ? colors.accent : colors.textSecondary;
            return (
              <G key={s.name}>
                {gaps.map(([a, b], i) => (
                  <Line key={i} x1={a} y1={axisY} x2={b} y2={axisY} stroke={colors.line} strokeWidth={3} strokeDasharray="3 3" />
                ))}
                <Path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              </G>
            );
          })}
        </Svg>
      ) : null}
      {series.length > 1 ? (
        <View style={styles.legend}>
          {series.map((s, idx) => (
            <View key={s.name} style={styles.legendItem}>
              <View style={{ width: 12, height: 2, backgroundColor: s.stale ? colors.stale : idx === 0 ? colors.accent : colors.textSecondary }} />
              <Text variant="caption" color={colors.textSecondary}>{s.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  legend: { flexDirection: "row", gap: space[4] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space[2] },
});
