import Storage from "expo-sqlite/kv-store";
import type { ScenarioName } from "@plantillas/simulator";

/** Ajustes locales de la app (clave-valor de expo-sqlite). */
export interface Settings {
  /** Permite usar el simulador cuando no hay plantillas conectadas. Las sesiones así grabadas se marcan «Simulada». */
  simulatorMode: boolean;
  /** Última placa conectada, para reconectar sin volver a buscar. */
  lastDevice?: { id: string; name: string };
  keepAwake: boolean;
  /** Escenario del simulador para demostraciones y verificación. */
  scenario: ScenarioName;
  seed: number;
}

const DEFAULTS: Settings = { simulatorMode: true, keepAwake: true, scenario: "normal", seed: 1 };
const KEY = "settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = Storage.getItemSync(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  Storage.setItemSync(KEY, JSON.stringify(next));
  return next;
}
