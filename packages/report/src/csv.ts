import { CHANNEL_POSITIONS, isChannelCode } from "@plantillas/contract";
import type { SessionBundle } from "@plantillas/storage";

/**
 * Exportación de una sesión a CSV (una fila por muestra), para análisis fuera
 * de la app. Función pura sobre el mismo paquete de sesión que el respaldo y
 * el informe. Valores originales en `adc_count`: una lectura fallida se exporta
 * con `raw_value` vacío y `status = read_error`, nunca como cero. Las muestras
 * de cada captura (una por módulo, ADR 0011) conservan su propia secuencia y
 * `time_us`; no se construye una línea temporal común.
 */

export const CSV_HEADER = ["session_id", "device_id", "capture_id", "sequence", "received_at", "channel_id", "foot", "zone", "time_us", "raw_value", "unit", "status"] as const;

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Nombre de archivo sugerido para el CSV. */
export function csvFileName(bundle: SessionBundle): string {
  return `sesion-${bundle.session.started_at.slice(0, 10)}-${bundle.session.id.slice(0, 8)}.csv`;
}

/**
 * Devuelve el CSV con BOM UTF-8 (para que Excel lo abra con acentos), separador
 * coma, decimal punto y fin de línea CRLF. Filas ordenadas por captura y secuencia,
 * y dentro del registro en el orden del contrato.
 */
export function buildSessionCsv(bundle: SessionBundle): string {
  const deviceByCapture = new Map(bundle.captures.map((c) => [c.external_capture_id, c.device_id]));
  const records = [...bundle.records].sort((a, b) => (a.capture_id === b.capture_id ? a.sequence - b.sequence : a.capture_id < b.capture_id ? -1 : 1));
  const lines: string[] = [CSV_HEADER.join(",")];
  for (const r of records) {
    const device = deviceByCapture.get(r.capture_id) ?? "";
    for (const s of r.samples) {
      const pos = isChannelCode(s.channel_id) ? CHANNEL_POSITIONS[s.channel_id] : undefined;
      lines.push([
        bundle.session.id, device, r.capture_id, r.sequence, r.received_at,
        s.channel_id, pos?.foot ?? "", pos?.zone ?? "", s.time_us,
        s.status === "ok" ? s.raw_value : null, s.unit, s.status,
      ].map(cell).join(","));
    }
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
