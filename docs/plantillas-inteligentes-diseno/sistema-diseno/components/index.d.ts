// Plantillas Inteligentes — window.Plantillas (React 18). Documentación de props; no se verifica tipos.
import type { ReactNode } from 'react';

export type IconName = 'bluetooth' | 'bluetooth-off' | 'play' | 'stop' | 'history' | 'compare' | 'settings' | 'check' | 'alert' | 'chevron-right' | 'chevron-down' | 'plus' | 'search' | 'foot';

export interface ButtonProps {
  /** `primary` una vez por pantalla; `secondary` por defecto; `danger` solo en la confirmación de «Finalizar». */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Ocupa todo el ancho (botón fijo al pie). */
  block?: boolean;
  icon?: IconName;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export interface CardProps {
  /** Título en `heading`. */
  title?: string;
  /** Usa `surface-elevated` (hojas, diálogos). */
  elevated?: boolean;
  children?: ReactNode;
}

export interface ChipProps {
  /** `neutral` filtro; `selected` filtro activo; `alert` «Incompleta» / posición faltante; `sim` procedencia simulada. */
  variant?: 'neutral' | 'selected' | 'alert' | 'sim';
  icon?: IconName;
  onClick?: () => void;
  children: ReactNode;
}

export interface ListRowProps {
  title: string;
  /** `caption`: «Running · 32 min · 41 220 registros». */
  subtitle?: string;
  /** Valor a la derecha en `num-md`, ya formateado. */
  value?: string;
  /** Un `Chip` de estado (Completa / Incompleta / Simulada). */
  chip?: ReactNode;
  /** Fila marcada para comparar: tilde y texto en accent. */
  selected?: boolean;
  /** `false` oculta el chevron (filas de selección). */
  chevron?: boolean;
  onClick?: () => void;
}

export interface HeaderProps {
  /** Un título por pantalla, en `title`. */
  title: string;
  /** Línea de contexto en `caption`: «Plantillas-ESP32 · físicas». */
  context?: string;
  /** Punto de estado del dispositivo antes del contexto. */
  status?: 'connected' | 'searching' | 'off';
  /** Icono de la acción a la derecha. */
  action?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

export interface StatusBannerProps {
  /** `neutral` informa; `alert` desconexión, recuperación o datos faltantes. */
  tone?: 'neutral' | 'alert';
  icon?: IconName;
  /** Segunda línea en `caption`. */
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

export interface ValueCardProps {
  /** Etiqueta en `label`: «Talón izquierdo», «Duración». */
  label: string;
  /** Número (se formatea con espacio de miles) o texto ya formateado («12:48»). `null` muestra «Sin datos». */
  value: number | string | null;
  /** «cuentas», «registros», «%». Reservar lugar para «N» / «kg» con calibración. */
  unit?: string;
  /** Línea de apoyo en `caption`: «media 1 902 · máx 3 310 · σ 212». */
  sub?: string;
  /** `xl` usa `num-xl` (duración en Grabación). */
  size?: 'md' | 'xl';
  /** Valor anterior a una desconexión: atenuado en `stale` + «desactualizado». */
  stale?: boolean;
  /** Pulso de 160 ms cuando el valor cambia (en vivo). */
  live?: boolean;
}

export interface FootValues { heel: number | null; medial: number | null; lateral: number | null; }

export interface FootMapProps {
  /** Valores 0–4095 del pie izquierdo (L_HEEL, L_MEDIAL, L_LATERAL). `null` = sin datos. */
  left: FootValues;
  /** Valores 0–4095 del pie derecho. */
  right: FootValues;
  /** Todo atenuado tras una desconexión. */
  stale?: boolean;
  /** Reemplaza el pie de foto automático («cuentas ADC · 0–4095 · …»). */
  caption?: string;
}

export interface LineSeries {
  name: string;
  /** Una muestra por posición; `null` es un hueco: corta la línea y marca el tramo sobre el eje. */
  values: Array<number | null>;
  stale?: boolean;
}

export interface LineChartProps {
  /** Una o dos series (la segunda en text-secondary). */
  series: LineSeries[];
  /** Tope del eje Y; 4095 por defecto. */
  max?: number;
  width?: number;
  height?: number;
  startLabel?: string;
  endLabel?: string;
  ticks?: Array<{ at: number; label: string }>;
  showLegend?: boolean;
  label?: string;
}

export interface IconProps { name: IconName; size?: number; label?: string; }

export declare function formatNumber(n: number | null | undefined): string;
