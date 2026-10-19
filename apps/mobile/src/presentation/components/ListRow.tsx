import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { colors, radius, size, space } from "../theme/tokens";
import type { ReactNode } from "react";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Valor a la derecha en num-md, ya formateado. */
  value?: string;
  chip?: ReactNode;
  /** Fila marcada para comparar: círculo con tilde a la derecha y título en accent. */
  selected?: boolean;
  /** Si está presente, la fila muestra un selector a la derecha (zona táctil de 48 px) independiente del toque sobre la fila. */
  onSelect?: () => void;
  chevron?: boolean;
  onPress?: () => void;
}

export function ListRow({ title, subtitle, value, chip, selected, onSelect, chevron = true, onPress }: ListRowProps) {
  const titleColor = selected ? colors.accent : colors.textPrimary;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {selected && !onSelect ? <Icon name="check" size={20} color={colors.accent} /> : null}
      <View style={styles.texts}>
        <Text variant="body" color={titleColor} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {chip}
      {value ? <Text variant="numMd">{value}</Text> : null}
      {chevron && onPress && !selected && !onSelect ? <Icon name="chevron-right" size={20} color={colors.textSecondary} /> : null}
      {onSelect ? (
        <Pressable
          onPress={onSelect}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!selected }}
          accessibilityLabel={selected ? "Quitar de la comparación" : "Marcar para comparar"}
          hitSlop={4}
          style={({ pressed }) => [styles.selectHit, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.selectRing, selected && styles.selectRingOn]}>
            {selected ? <Icon name="check" size={16} color={colors.onAccent} /> : null}
          </View>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.rowHeight, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  selectHit: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: -space[2] },
  selectRing: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  selectRingOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
