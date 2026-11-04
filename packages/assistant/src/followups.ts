/**
 * Preguntas de seguimiento después de cada respuesta (ajuste del 4/11/2026).
 *
 * Se eligen por reglas sobre el tema de la pregunta y de la respuesta, sin
 * pedirle al modelo que las genere: son deterministas, no cuestan tokens y
 * siempre caen dentro del alcance (ADR 0012). Nunca se repite la pregunta
 * que acaba de hacerse.
 */
export type FollowUpTopic = "distribution" | "quality" | "comparison" | "bilateral" | "training" | "general";

const TOPIC_PATTERNS: ReadonlyArray<readonly [FollowUpTopic, RegExp]> = [
  ["comparison", /compar|cambi[oó]|respecto de|anterior|diferencia|evoluci[oó]n|entre (las|mis) (dos|[uú]ltimas)/i],
  ["bilateral", /izquierd|derech|asimetr|ambos pies|los dos pies|bilateral|simetr/i],
  ["quality", /calidad|hueco|registro|desconex|reconex|lectura(s)? fallida|tasa|read_error|discontinu|interrump/i],
  ["training", /entrenamiento|rutina|ejercicio|serie|repetici|sentadilla|peso|kg\b|rpe|caminata de|volumen/i],
  ["distribution", /repart|antepi[eé]|tal[oó]n|carga|apoyo|distribuci|media|m[aá]ximo|desv[ií]o|variabilidad|zona/i],
];

const FOLLOW_UPS: Readonly<Record<FollowUpTopic, readonly string[]>> = {
  distribution: ["¿Qué cambió respecto de la anterior?", "¿Por qué puede variar el reparto?", "¿Qué significa el desvío de cada zona?"],
  quality: ["¿Afecta a los indicadores?", "¿Cómo evito huecos en la próxima sesión?", "¿Cómo se repartió la carga?"],
  comparison: ["¿Esto qué significa?", "¿Cómo comparo mejor la próxima?", "¿Qué condiciones cambiaron entre las dos?"],
  bilateral: ["¿Qué significa la asimetría por zona?", "¿Cómo se calcula el desfase entre módulos?", "¿Qué cambió respecto de la anterior?"],
  training: ["¿Cómo fue el entrenamiento de hoy?", "¿Qué sesiones quedaron vinculadas a ejercicios?", "Registrar otra serie"],
  general: ["¿Cómo vienen mis últimas sesiones?", "¿Qué cambió entre las dos últimas?", "¿Qué significa el reparto antepié / talón?"],
};

export function detectFollowUpTopic(question: string, answer: string): FollowUpTopic {
  // La pregunta manda; la respuesta desempata cuando la pregunta es genérica.
  for (const [topic, re] of TOPIC_PATTERNS) if (re.test(question)) return topic;
  for (const [topic, re] of TOPIC_PATTERNS) if (re.test(answer)) return topic;
  return "general";
}

/** Dos o tres preguntas de seguimiento, sin repetir la que acaba de hacerse ni las ya hechas en la conversación. */
export function followUpSuggestions(question: string, answer: string, asked: readonly string[] = [], max = 3): string[] {
  const topic = detectFollowUpTopic(question, answer);
  const norm = (s: string) => s.trim().toLowerCase().replace(/[¿?¡!.]/g, "");
  const seen = new Set([question, ...asked].map(norm));
  const pool = [...FOLLOW_UPS[topic], ...FOLLOW_UPS.general];
  const out: string[] = [];
  for (const s of pool) {
    if (seen.has(norm(s))) continue;
    if (out.includes(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
