import { SIMULATED_CONFIGURATION, simulatedModuleConfiguration, type AcquisitionConfiguration, type DataSourceKind, type Foot } from "@plantillas/contract";
import { useDevice, type DeviceState } from "../infrastructure/ble/deviceStore";
import { loadSettings, type Settings } from "../infrastructure/settings/settings";

/**
 * Fuente que usaría una sesión nueva. Regla única: plantillas conectadas →
 * fuente física (uno o dos módulos, ADR 0011); si no, simulador (si está
 * permitido en Ajustes). La procedencia la determina el adaptador elegido,
 * nunca una etiqueta.
 */
export interface SourceModule {
  readonly configuration: AcquisitionConfiguration;
  readonly foot: Foot | null;
  readonly device_id: string;
  /** Id del periférico BLE (sólo físicos). */
  readonly peripheralId?: string;
  readonly linkLost: boolean;
}

export interface ActiveSource {
  readonly kind: DataSourceKind | "none";
  /** Configuración del primer módulo (compatibilidad). */
  readonly configuration: AcquisitionConfiguration | null;
  readonly modules: readonly SourceModule[];
  /** `true` cuando los módulos cubren ambos pies. */
  readonly bilateral: boolean;
  /** «Plantillas · ESP32-9E7EE4» o «Simulador · SIM-001». */
  readonly title: string;
  /** Configuración, firmware, rango. */
  readonly detail: string;
}

const FOOT_SHORT: Record<string, string> = { left: "izq", right: "der" };

export function resolveSource(device: DeviceState, settings: Settings): ActiveSource {
  if (device.modules.length > 0) {
    const modules: SourceModule[] = device.modules.map((m) => ({ configuration: m.configuration, foot: m.foot, device_id: m.info.device_id, peripheralId: m.id, linkLost: m.linkLost }));
    const first = device.modules[0]!;
    const synthetic = first.configuration.channels.every((ch) => ch.model === "synthetic");
    const feet = new Set(modules.map((m) => m.foot));
    const bilateral = (feet.has("left") && feet.has("right")) || feet.has(null);
    const lost = device.modules.filter((m) => m.linkLost);
    const ids = device.modules.map((m) => (m.foot ? `${FOOT_SHORT[m.foot]} ${m.info.device_id}` : m.info.device_id)).join(" · ");
    return {
      kind: "physical",
      configuration: first.configuration,
      modules,
      bilateral,
      title: `Plantillas · ${ids}${lost.length ? " · enlace perdido" : ""}`,
      detail: `${device.modules.map((m) => m.info.configuration_id).join(" + ")} · firmware ${first.info.firmware}${synthetic ? " · lecturas sintéticas de la placa" : ""} · cuentas ADC 0–${first.info.raw_max}${lost.length ? " · se reconecta al iniciar" : ""}${modules.length === 1 && first.foot ? ` · sólo pie ${first.foot === "left" ? "izquierdo" : "derecho"}` : ""}`,
    };
  }
  if (settings.simulatorMode) {
    if (settings.simulatorBilateral) {
      const left = simulatedModuleConfiguration("left"), right = simulatedModuleConfiguration("right");
      return {
        kind: "simulated",
        configuration: left,
        modules: [left, right].map((c) => ({ configuration: c, foot: c === left ? "left" : "right", device_id: c.device_id, linkLost: false })),
        bilateral: true,
        title: `Simulador · ${left.device_id} + ${right.device_id}`,
        detail: `dos módulos simulados (relojes distintos) · escenario ${settings.scenario} · cuentas ADC 0–4095`,
      };
    }
    return {
      kind: "simulated",
      configuration: SIMULATED_CONFIGURATION,
      modules: [{ configuration: SIMULATED_CONFIGURATION, foot: null, device_id: SIMULATED_CONFIGURATION.device_id, linkLost: false }],
      bilateral: true,
      title: `Simulador · ${SIMULATED_CONFIGURATION.device_id}`,
      detail: `${SIMULATED_CONFIGURATION.configuration_id} · escenario ${settings.scenario} · cuentas ADC 0–4095`,
    };
  }
  return { kind: "none", configuration: null, modules: [], bilateral: false, title: "Sin fuente", detail: "Conectá las plantillas o activá el simulador en Ajustes" };
}

export function useActiveSource(): ActiveSource {
  const device = useDevice();
  return resolveSource(device, loadSettings());
}
