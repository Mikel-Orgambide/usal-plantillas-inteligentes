import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, type } from "../theme/tokens";

export type TextVariant = keyof typeof type;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

/** Texto con el estilo tipográfico del sistema. Color por defecto: text-primary. */
export function Text({ variant = "body", color = colors.textPrimary, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[type[variant], { color }, style]} />;
}
