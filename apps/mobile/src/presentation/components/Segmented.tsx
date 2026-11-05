import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { colors, radius, space } from "../theme/tokens";

/** Control segmentado de dos o tres opciones (pestañas Medición | Rutina). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.seg, on && styles.on]}>
            <Text variant="label" color={on ? colors.accent : colors.textSecondary}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: colors.line },
  seg: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: space[3] },
  on: { backgroundColor: colors.accentSoft },
});
