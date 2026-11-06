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

  it("deja pasar las preguntas de lectura y las de consejo sobre el registro (ajuste 4/11)", () => {
    for (const q of [
      "¿Esto qué significa?",
      "Esto que significa?",
      "¿Qué cambió respecto de la anterior?",
      "¿Por qué bajó el talón?",
      "¿Qué puedo mejorar para comparar las sesiones?",
      "¿Qué me recomendás para registrar mejor?",
      "¿Cómo puedo mejorar la calidad de la señal?",
    ]) expect(classifyQuestion(q), q).toBe("in_scope");
  });

  it("los consejos que no hablan del registro siguen siendo clínicos", () => {
    for (const q of ["¿Qué puedo mejorar en mi pisada?", "¿Qué me recomendás hacer?", "¿Es normal este valor?", "¿Cuál es el rango normal del talón?"]) {
      expect(classifyQuestion(q), q).toBe("out_of_scope_clinical");
    }
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

  it("las preguntas sobre rutinas de rehabilitación o el cansancio anotado no se rechazan (ajuste 6/11)", () => {
    expect(classifyQuestion("¿Qué hice en la rutina de rehabilitación esta semana?")).toBe("in_scope");
    expect(classifyQuestion("¿En qué serie anoté cansancio?")).toBe("in_scope");
    expect(classifyQuestion("¿Qué ejercicio hice último en el entrenamiento?")).toBe("in_scope");
  });

  it("sin referencia a lo registrado, rehabilitación y fatiga siguen siendo clínicas", () => {
    expect(classifyQuestion("¿Mi rehabilitación va bien?")).toBe("out_of_scope_clinical");
    expect(classifyQuestion("¿Tengo fatiga?")).toBe("out_of_scope_clinical");
    expect(classifyQuestion("¿Tengo una lesión en la rutina?")).toBe("out_of_scope_clinical");
  });
});
