import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";
import { colors, radius, space } from "../theme/tokens";
import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  elevated?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Contenedor en surface, radio md, padding 16, sin sombra ni borde. */
export function Card({ title, elevated, children, style }: CardProps) {
  return (
    <View style={[styles.card, elevated && { backgroundColor: colors.surfaceElevated }, style]}>
      {title ? <Text variant="heading" style={{ marginBottom: space[3] }}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space[4] },
});
