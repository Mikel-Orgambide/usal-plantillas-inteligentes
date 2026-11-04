import { describe, expect, it } from "vitest";
import { detectFollowUpTopic, followUpSuggestions } from "../src/followups";

describe("sugerencias de seguimiento", () => {
  it("elige el tema por la pregunta y propone 2–3 sin repetirla", () => {
    const s = followUpSuggestions("¿Cómo se repartió la carga?", "El talón tuvo 39 % y el antepié 61 %.");
    expect(detectFollowUpTopic("¿Cómo se repartió la carga?", "")).toBe("distribution");
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s).toContain("¿Qué cambió respecto de la anterior?");
    expect(s).not.toContain("¿Cómo se repartió la carga?");
  });
  it("tras una comparación ofrece «¿Esto qué significa?»", () => {
    expect(followUpSuggestions("Compará las últimas dos sesiones", "En la sesión…")).toContain("¿Esto qué significa?");
  });
  it("calidad → «¿Afecta a los indicadores?»; general cuando no hay tema", () => {
    expect(followUpSuggestions("¿Hubo problemas en el registro?", "No hubo huecos.")).toContain("¿Afecta a los indicadores?");
    expect(detectFollowUpTopic("Hola", "Hola, ¿qué querés saber?")).toBe("general");
  });
  it("no repite preguntas ya hechas en la conversación y rellena con generales", () => {
    const asked = ["¿Qué cambió respecto de la anterior?", "¿Por qué puede variar el reparto?", "¿Qué significa el desvío de cada zona?"];
    const s = followUpSuggestions("¿Cómo se repartió la carga?", "…", asked);
    expect(s.every((x) => !asked.includes(x))).toBe(true);
    expect(s.length).toBe(3);
  });
});
