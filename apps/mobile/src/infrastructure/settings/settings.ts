import Storage from "expo-sqlite/kv-store";
import type { ScenarioName } from "@plantillas/simulator";

/** Ajustes locales de la app (clave-valor de expo-sqlite). */
export interface Settings {
  /** Permite usar el simulador cuando no hay plantillas conectadas. Las sesiones así grabadas se marcan «Simulada». */
  simulatorMode: boolean;
  /** Última placa conectada, para reconectar sin volver a buscar. */
  lastDevice?: { id: string; name: string };
  /** Últimas placas conectadas (hasta dos, una por pie), para reconectar ambas. */
  lastDevices?: { id: string; name: string }[];
  /** Simulador con dos módulos (uno por pie, relojes distintos) en lugar de la placa simulada de seis. */
  simulatorBilateral: boolean;
  keepAwake: boolean;
  /** Grabación con números grandes en lugar de las siluetas (para leer el teléfono desde lejos en un ensayo). */
  bigNumbers: boolean;
  /** Escenario del simulador para demostraciones y verificación. */
  scenario: ScenarioName;
  seed: number;
}

const DEFAULTS: Settings = { simulatorMode: true, keepAwake: true, bigNumbers: false, scenario: "normal", seed: 1, simulatorBilateral: false };
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
