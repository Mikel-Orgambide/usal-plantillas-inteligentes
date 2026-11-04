import { describe, expect, it } from "vitest";
import { classifyQuestion, FIXED_ANSWERS } from "../src/index";

describe("classifyQuestion", () => {
  it("deja pasar preguntas sobre sesiones e indicadores", () => {
    for (const q of [
      "¿Qué pasó en mi última sesión?",
      "¿Qué significa el reparto antepié/talón?",
      "¿Cuántos huecos tuvo la sesión del 3 de noviembre?",
      "¿Por qué el pie derecho dice n/d?",
      "¿Cuál fue el máximo del talón izquierdo?",
    ]) expect(classifyQuestion(q), q).toBe("in_scope");
  });

  it("deriva lo clínico a una respuesta fija sin consultar al modelo", () => {
    for (const q of [
      "¿Tengo fascitis plantar?",
      "Me duele el talón, ¿qué hago?",
      "¿Qué ejercicio me recomendás para la rodilla?",
      "¿Esto indica una lesión del LCA?",
      "¿Estoy fatigado según los datos?",
      "¿Debo tomar algún medicamento?",
    ]) expect(classifyQuestion(q), q).toBe("out_of_scope_clinical");
    expect(FIXED_ANSWERS.out_of_scope_clinical).toMatch(/profesional/);
    expect(FIXED_ANSWERS.out_of_scope_clinical).not.toMatch(/diagnóstico:/);
  });

  it("rechaza lo ajeno a la app", () => {
    for (const q of ["¿Quién es el presidente?", "Escribime un poema", "¿Cómo programo en Python un bucle?", "¿Cuál es la capital de Francia?"]) {
      expect(classifyQuestion(q), q).toBe("out_of_scope_other");
    }
  });
});
