/**
 * Clasificación de la secuencia de registros dentro de una captura.
 *
 * El número de secuencia lo asigna la fuente al generar el registro. Un salto
 * indica registros no recibidos (o descartados por la fuente); no se confunde
 * con muestras planificadas ausentes. El orden de llegada no es el orden de
 * adquisición: un registro con secuencia menor a la última vista se clasifica
 * como fuera de orden y su política de aceptación la define la aplicación.
 */

export type SequenceRelation =
  | { readonly kind: "first" }
  | { readonly kind: "next" }
  | { readonly kind: "gap"; readonly missing_from: number; readonly missing_to: number; readonly missing_count: number }
  | { readonly kind: "duplicate" }
  | { readonly kind: "out_of_order"; readonly behind_by: number };

/**
 * @param lastSeen última secuencia aceptada en la captura, o `undefined` si es la primera.
 * @param incoming secuencia del registro recibido.
 */
export function classifySequence(lastSeen: number | undefined, incoming: number): SequenceRelation {
  if (lastSeen === undefined) return { kind: "first" };
  if (incoming === lastSeen + 1) return { kind: "next" };
  if (incoming === lastSeen) return { kind: "duplicate" };
  if (incoming > lastSeen + 1) {
    return {
      kind: "gap",
      missing_from: lastSeen + 1,
      missing_to: incoming - 1,
      missing_count: incoming - lastSeen - 1,
    };
  }
  return { kind: "out_of_order", behind_by: lastSeen - incoming };
}
