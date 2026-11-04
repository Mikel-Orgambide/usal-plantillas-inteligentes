import { StyleSheet, View } from "react-native";
import { colors, fonts, formatNumber, radius, space } from "../theme/tokens";
import { Text } from "./Text";
import type { FootValues, FootValue } from "./FootMap";

/**
 * Modo de números grandes para Grabación: reemplaza las siluetas por los valores
 * por posición en tipografía grande, para leer el teléfono desde lejos durante
 * un ensayo de banco. Mismo contrato que FootMap: `null` = sin datos («—»),
 * `"unavailable"` = posición no instrumentada («n/d»), nunca un cero inventado.
 */
export interface BigNumbersProps {
  left: FootValues;
  right: FootValues;
  stale?: boolean;
}

const ZONES: { key: keyof FootValues; label: string }[] = [
  { key: "heel", label: "Talón" },
  { key: "medial", label: "Medial" },
  { key: "lateral", label: "Lateral" },
];

function Cell({ value, stale }: { value: FootValue; stale: boolean }) {
  const unavailable = value === "unavailable";
  const none = unavailable || value === null || value === undefined;
  const color = unavailable ? colors.stale : stale ? colors.stale : none ? colors.textSecondary : colors.textPrimary;
  return (
    <Text style={[styles.value, { color, fontSize: unavailable ? 28 : 44, lineHeight: unavailable ? 34 : 48 }]} numberOfLines={1} adjustsFontSizeToFit>
      {unavailable ? "n/d" : none ? "—" : formatNumber(value as number)}
    </Text>
  );
}

export function BigNumbers({ left, right, stale = false }: BigNumbersProps) {
  const leftOff = left.heel === "unavailable" && left.medial === "unavailable" && left.lateral === "unavailable";
  const rightOff = right.heel === "unavailable" && right.medial === "unavailable" && right.lateral === "unavailable";
  return (
    <View style={styles.wrap} accessibilityLabel="Valores por posición en números grandes">
      <View style={styles.headRow}>
        <View style={styles.zoneCol} />
        <Text variant="label" color={leftOff ? colors.stale : colors.textSecondary} style={styles.head}>Izquierdo{leftOff ? " · n/i" : ""}</Text>
        <Text variant="label" color={rightOff ? colors.stale : colors.textSecondary} style={styles.head}>Derecho{rightOff ? " · n/i" : ""}</Text>
      </View>
      {ZONES.map((z) => (
        <View key={z.key} style={styles.row}>
          <Text variant="label" color={colors.textSecondary} style={styles.zoneCol}>{z.label}</Text>
          <View style={styles.cell}><Cell value={left[z.key]} stale={stale} /></View>
          <View style={styles.cell}><Cell value={right[z.key]} stale={stale} /></View>
        </View>
      ))}
      <Text variant="caption" color={colors.textSecondary} style={styles.caption}>
        cuentas ADC · 0–4 095{stale ? " · desactualizado" : ""}{leftOff || rightOff ? " · n/i = pie no instrumentado" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space[3], paddingHorizontal: space[4], gap: space[1] },
  headRow: { flexDirection: "row", alignItems: "center", paddingBottom: space[1] },
  head: { flex: 1, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 56 },
  zoneCol: { width: 64 },
  cell: { flex: 1, alignItems: "center" },
  value: { fontFamily: fonts.semibold, fontVariant: ["tabular-nums"], letterSpacing: -0.8 },
  caption: { textAlign: "center", paddingTop: space[2] },
});
