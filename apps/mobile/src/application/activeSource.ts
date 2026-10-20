import { SIMULATED_CONFIGURATION, type AcquisitionConfiguration, type DataSourceKind } from "@plantillas/contract";
import { useDevice, type DeviceState } from "../infrastructure/ble/deviceStore";
import { loadSettings, type Settings } from "../infrastructure/settings/settings";

/**
 * Fuente que usaría una sesión nueva. Regla única: plantillas conectadas →
 * fuente física; si no, simulador (si está permitido en Ajustes). La
 * procedencia la determina el adaptador elegido, nunca una etiqueta.
 */
export interface ActiveSource {
  readonly kind: DataSourceKind | "none";
  readonly configuration: AcquisitionConfiguration | null;
  /** «Plantillas · ESP32-9E7EE4» o «Simulador · SIM-001». */
  readonly title: string;
  /** Configuración, firmware, rango. */
  readonly detail: string;
}

export function resolveSource(device: DeviceState, settings: Settings): ActiveSource {
  const c = device.connected;
  if (c) {
    const synthetic = c.configuration.channels.every((ch) => ch.model === "synthetic");
    return {
      kind: "physical",
      configuration: c.configuration,
      title: `Plantillas · ${c.info.device_id}${device.linkLost ? " · enlace perdido" : ""}`,
      detail: `${c.info.configuration_id} · firmware ${c.info.firmware}${synthetic ? " · lecturas sintéticas de la placa" : ""} · cuentas ADC 0–${c.info.raw_max}${device.linkLost ? " · se reconecta al iniciar" : ""}`,
    };
  }
  if (settings.simulatorMode) {
    return {
      kind: "simulated",
      configuration: SIMULATED_CONFIGURATION,
      title: `Simulador · ${SIMULATED_CONFIGURATION.device_id}`,
      detail: `${SIMULATED_CONFIGURATION.configuration_id} · escenario ${settings.scenario} · cuentas ADC 0–4095`,
    };
  }
  return { kind: "none", configuration: null, title: "Sin fuente", detail: "Conectá las plantillas o activá el simulador en Ajustes" };
}

export function useActiveSource(): ActiveSource {
  const device = useDevice();
  return resolveSource(device, loadSettings());
}
