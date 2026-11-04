/**
 * Clasificación de la pregunta antes de consultar al modelo (ADR 0012).
 *
 * Lo clínico (diagnóstico, lesión, tratamiento, dolor, medicación…) y lo
 * ajeno a la app se responden con un texto fijo, sin llamar al modelo:
 * así el límite no depende de lo que el modelo decida obedecer.
 */
export type QuestionScope = "in_scope" | "out_of_scope_clinical" | "out_of_scope_other";

const CLINICAL = [
  /diagn[oó]s/i, /lesi[oó]n/i, /tratamiento/i, /medicaci[oó]n/i, /medicamento/i, /remedio/i, /\bdolor/i, /duele/i, /fascitis/i,
  /tendinitis/i, /esguince/i, /fractura/i, /artrosis/i, /\bligamento/i, /\blca\b/i, /\bacl\b/i, /rehabilitaci[oó]n/i, /fisioterap/i, /kinesi/i,
  /\bm[eé]dic[oa]\b/i, /enferm/i, /pat[oó]log/i, /s[ií]ntoma/i, /\bcur[ao]r?\b/i, /inflam/i, /fatiga/i, /sobrecarga/i, /\bpisada (plana|pronad|supinad)/i,
  /plantilla ortop/i, /ortop[eé]d/i, /qu[eé] (ejercicio|estiramiento)/i, /debo (hacer|tomar|usar)/i, /tengo que (hacer|tomar|usar)/i, /(est[aá]|estoy) (lesionad|enferm)/i,
  /me recomend[aá]s/i, /recomendaci[oó]n/i, /pron[oó]stico/i, /peligros/i, /\briesgo de/i,
];

const OTHER = [
  /pol[ií]tic/i, /elecci[oó]n/i, /presidente/i, /f[uú]tbol/i, /partido de/i, /receta/i, /cocin/i, /clima/i, /tiempo (va a|est[aá]) /i,
  /program[aá] (un|una|en)/i, /\bc[oó]digo (en|de) /i, /python|javascript|typescript|java\b|sql\b/i, /traduc/i, /\bchiste/i, /poema/i, /\bcanci[oó]n/i,
  /\bbitcoin|cripto/i, /\bnoticia/i, /qui[eé]n (es|fue) /i, /capital de/i,
];

export function classifyQuestion(text: string): QuestionScope {
  const q = text.trim();
  if (CLINICAL.some((re) => re.test(q))) return "out_of_scope_clinical";
  if (OTHER.some((re) => re.test(q))) return "out_of_scope_other";
  return "in_scope";
}

export const FIXED_ANSWERS: Readonly<Record<Exclude<QuestionScope, "in_scope">, string>> = {
  out_of_scope_clinical:
    "Eso no lo puedo responder: la app describe mediciones de los sensores y su calidad, pero no diagnostica ni recomienda tratamientos. Esa lectura corresponde a un profesional, que puede usar el informe PDF de la sesión. Si querés, te explico qué muestran los indicadores de una sesión.",
  out_of_scope_other:
    "Sólo puedo responder sobre tus sesiones, indicadores y mediciones registradas en la app. Preguntame, por ejemplo, qué pasó en la última sesión o qué significa el reparto antepié/talón.",
};
