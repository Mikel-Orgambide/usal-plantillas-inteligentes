import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { colors, size, space } from "../theme/tokens";
import type { ReactNode } from "react";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Valor a la derecha en num-md, ya formateado. */
  value?: string;
  chip?: ReactNode;
  /** Fila marcada para comparar: tilde y texto en accent. */
  selected?: boolean;
  chevron?: boolean;
  onPress?: () => void;
}

export function ListRow({ title, subtitle, value, chip, selected, chevron = true, onPress }: ListRowProps) {
  const titleColor = selected ? colors.accent : colors.textPrimary;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {selected ? <Icon name="check" size={20} color={colors.accent} /> : null}
      <View style={styles.texts}>
        <Text variant="body" color={titleColor} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {chip}
      {value ? <Text variant="numMd">{value}</Text> : null}
      {chevron && onPress && !selected ? <Icon name="chevron-right" size={20} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.rowHeight, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  texts: { flex: 1, minWidth: 0, gap: 2 },
});
