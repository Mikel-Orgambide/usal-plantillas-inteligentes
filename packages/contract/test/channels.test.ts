import { describe, expect, it } from "vitest";
import {
  CHANNEL_CODES,
  CHANNEL_POSITIONS,
  SIMULATED_CONFIGURATION,
  isChannelCode,
  validateConfiguration,
} from "../src/index";

describe("configuración de canales", () => {
  it("define exactamente seis posiciones, tres por pie", () => {
    expect(CHANNEL_CODES).toHaveLength(6);
    const left = CHANNEL_CODES.filter((c) => CHANNEL_POSITIONS[c].foot === "left");
    const right = CHANNEL_CODES.filter((c) => CHANNEL_POSITIONS[c].foot === "right");
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
  });

  it("espera FSR406 en talones y FSR402 en antepié", () => {
    for (const code of CHANNEL_CODES) {
      const pos = CHANNEL_POSITIONS[code];
      expect(pos.expected_model).toBe(pos.zone === "heel" ? "FSR406" : "FSR402");
    }
  });

  it("la configuración simulada es válida y está identificada como simulada", () => {
    expect(validateConfiguration(SIMULATED_CONFIGURATION)).toEqual([]);
    expect(SIMULATED_CONFIGURATION.source).toBe("simulated");
    expect(new Set(SIMULATED_CONFIGURATION.channels.map((c) => c.installation_id)).size).toBe(6);
  });

  it("detecta configuraciones incompletas o con duplicados", () => {
    const incompleta = { ...SIMULATED_CONFIGURATION, channels: SIMULATED_CONFIGURATION.channels.slice(0, 5) };
    expect(validateConfiguration(incompleta)).toContain("falta el canal R_LATERAL");

    const duplicada = {
      ...SIMULATED_CONFIGURATION,
      channels: [...SIMULATED_CONFIGURATION.channels, SIMULATED_CONFIGURATION.channels[0]!],
    };
    expect(validateConfiguration(duplicada)).toContain("código de canal duplicado: L_HEEL");
  });

  it("reconoce códigos de canal", () => {
    expect(isChannelCode("L_HEEL")).toBe(true);
    expect(isChannelCode("L_TOE")).toBe(false);
    expect(isChannelCode(3)).toBe(false);
  });
});
