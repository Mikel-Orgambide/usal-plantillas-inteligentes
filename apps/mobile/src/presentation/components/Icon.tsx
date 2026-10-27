import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors, size } from "../theme/tokens";

/** Los 14 iconos del sistema: retícula 24, trazo 1.5, extremos redondeados, sin relleno (salvo play). */
export type IconName =
  | "bluetooth" | "bluetooth-off" | "play" | "stop" | "history" | "compare" | "settings"
  | "check" | "alert" | "chevron-right" | "chevron-down" | "plus" | "search" | "foot" | "export" | "import" | "cloud" | "user" | "chevron-left" | "close";

const PATHS: Record<IconName, { d?: string; circles?: [number, number, number][]; rect?: boolean; fill?: boolean }> = {
  bluetooth: { d: "M6.5 6.5l11 11-5.5 5.5V1l5.5 5.5-11 11" },
  "bluetooth-off": { d: "M12 13.5V23l5.5-5.5-3-3M12 1v4M12 5l5.5 5.5-2.5 2.5M3 3l18 18" },
  play: { d: "M7 4.5v15l12-7.5z", fill: true },
  stop: { rect: true },
  history: { d: "M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8M12 7.5V12l3 2" },
  compare: { d: "M10 4H4v16h6M14 4h6v16h-6M12 2v20" },
  settings: { d: "M4 7h9M19 7h1M4 17h3M13 17h7", circles: [[16, 7, 2.5], [10, 17, 2.5]] },
  check: { d: "M5 12.5l4.5 4.5L19 7" },
  alert: { d: "M12 3.5l9.5 17h-19zM12 10v4M12 17.3v.4" },
  "chevron-right": { d: "M9 6l6 6-6 6" },
  "chevron-left": { d: "M15 6l-6 6 6 6" },
  close: { d: "M6 6l12 12M18 6L6 18" },
  export: { d: "M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" },
  import: { d: "M12 4v12M7 11l5 5 5-5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" },
  "chevron-down": { d: "M6 9l6 6 6-6" },
  cloud: { d: "M7 18.5a4.5 4.5 0 01-.6-8.96A6 6 0 0117.7 9.5 4.25 4.25 0 0117 18.5H7z" },
  user: { d: "M4.5 20a7.5 7.5 0 0115 0", circles: [[12, 8, 4]] },
  plus: { d: "M12 5v14M5 12h14" },
  search: { d: "M20 20l-3.6-3.6", circles: [[11, 11, 7]] },
  foot: { d: "M14.5 2.5c3.2 0 5 2.8 4.5 6.5-.4 3-1.6 5.5-1.6 9 0 2.3-1.3 3.5-3.2 3.5s-3.4-1.2-3.4-3.6c0-3.6-2.3-6.4-2.3-9.7 0-3.5 2.6-5.7 6-5.7z" },
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size: px = size.icon, color = colors.textSecondary }: IconProps) {
  const p = PATHS[name];
  const common = { stroke: color, strokeWidth: size.iconStroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24">
      {p.d ? <Path d={p.d} {...common} fill={p.fill ? color : "none"} /> : null}
      {p.rect ? <Rect x={6} y={6} width={12} height={12} rx={1} {...common} /> : null}
      {p.circles?.map(([cx, cy, r], i) => <Circle key={i} cx={cx} cy={cy} r={r} {...common} />)}
    </Svg>
  );
}
