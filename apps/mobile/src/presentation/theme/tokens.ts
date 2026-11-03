/**
 * Tokens del sistema de diseño "Plantillas Inteligentes"
 * (docs/plantillas-inteligentes-diseno/sistema-diseno/tokens.json). Tema oscuro
 * principal; el claro queda definido para una variante futura.
 */

export const palette = {
  dark: {
    bg: "#0c0d10",
    surface: "#15181c",
    surfaceElevated: "#1f2329",
    line: "#2b3038",
    textPrimary: "#f2f4f7",
    textSecondary: "#98a2ad",
    accent: "#b48cff",
    /** Violeta profundo: segundo tono de los repartos (pie derecho, talón) junto al acento claro. */
    accentDeep: "#6a44c4",
    accentSoft: "#b48cff24",
    onAccent: "#0c0d10",
    alert: "#e3a856",
    alertSoft: "#e3a85622",
    onAlert: "#0c0d10",
    stale: "#6a7481",
  },
  light: {
    bg: "#eceef1",
    surface: "#f5f6f8",
    surfaceElevated: "#ffffff",
    line: "#d6dbe1",
    textPrimary: "#121417",
    textSecondary: "#5a636e",
    accent: "#5b3fb8",
    accentDeep: "#2f1f73",
    accentSoft: "#5b3fb81a",
    onAccent: "#ffffff",
    alert: "#9c5a0a",
    alertSoft: "#9c5a0a1a",
    onAlert: "#ffffff",
    stale: "#6f7985",
  },
} as const;

export type Palette = (typeof palette)["dark"];

/** Tema activo. La app es oscura por diseño; la variante clara es opcional. */
export const colors: Palette = palette.dark;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const size = { controlHeight: 48, rowHeight: 64, icon: 24, iconStroke: 1.5, hairline: 1 } as const;

export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  /** Sólo para la marca «.NSL» (ADR 0009). */
  extrabold: "Manrope_800ExtraBold",
} as const;

import type { TextStyle } from "react-native";

const TNUM: TextStyle["fontVariant"] = ["tabular-nums"];

/** Estilos tipográficos: seis tamaños, tres pesos. Los números siempre con dígitos tabulares. */
export const type = {
  numXl: { fontFamily: fonts.semibold, fontSize: 56, lineHeight: 60, letterSpacing: -1.1, fontVariant: TNUM },
  numLg: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3, fontVariant: TNUM },
  numMd: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, fontVariant: TNUM },
  title: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0.24 },
} satisfies Record<string, TextStyle>;

/** Formato de números: miles con espacio fino, como en el diseño («2 418»). */
export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const sign = int!.startsWith("-") ? "−" : "";
  const digits = int!.replace("-", "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return sign + grouped + (dec ? "," + dec : "");
}

/** Duración «mm:ss» hasta una hora y «h:mm:ss» después. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha «dom 18 oct · 20:35», en hora local, sin depender de la localización del teléfono. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}
