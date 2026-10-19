import { useSyncExternalStore } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import BleManager, { BleScanMode, ConnectionPriority } from "react-native-ble-manager";
import type { AcquisitionConfiguration } from "@plantillas/contract";
import { INFO_UUID, MIN_MTU, REQUESTED_MTU, SERVICE_UUID, parseDeviceInfo, type BleLink, type DeviceInfo } from "@plantillas/ble";
import { loadSettings, saveSettings } from "../settings/settings";

/**
 * Plantillas por Bluetooth: permisos, búsqueda, conexión y lectura de la
 * configuración que publica la placa. Vive fuera de React (como la sesión
 * activa) para que la conexión sobreviva a la navegación. El protocolo y la
 * traducción de registros están en `@plantillas/ble`; acá solo hay transporte.
 */

export type BluetoothState = "unknown" | "on" | "off" | "unauthorized" | "unsupported";

export interface FoundDevice { readonly id: string; readonly name: string; readonly rssi: number }

export interface ConnectedDevice {
  readonly id: string;
  readonly name: string;
  readonly mtu: number;
  readonly info: DeviceInfo;
  readonly configuration: AcquisitionConfiguration;
  readonly link: BleLink;
}

export interface DeviceState {
  readonly bluetooth: BluetoothState;
  readonly scanning: boolean;
  readonly found: readonly FoundDevice[];
  readonly connecting: string | null;
  readonly connected: ConnectedDevice | null;
  /** El enlace se cortó sin pedirlo; la sesión en curso intenta reconectar. */
  readonly linkLost: boolean;
  readonly error: string | undefined;
}

let state: DeviceState = { bluetooth: "unknown", scanning: false, found: [], connecting: null, connected: null, linkLost: false, error: undefined };
const listeners = new Set<() => void>();
let started: Promise<void> | null = null;

function set(patch: Partial<DeviceState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useDevice(): DeviceState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

export function getDevice(): DeviceState {
  return state;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (Number(Platform.Version) >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(res).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

function start(): Promise<void> {
  if (!started) {
    started = (async () => {
      await BleManager.start({ showAlert: false });
      BleManager.onDidUpdateState(({ state: s }) => set({ bluetooth: mapState(s) }));
      BleManager.onDiscoverPeripheral((p) => {
        const name = p.name ?? p.advertising?.localName ?? "";
        if (state.found.some((d) => d.id === p.id)) return;
        set({ found: [...state.found, { id: p.id, name: name || p.id, rssi: p.rssi }] });
      });
      BleManager.onStopScan(() => set({ scanning: false }));
      BleManager.onDisconnectPeripheral((e) => {
        if (state.connected && same(e.peripheral, state.connected.id)) set({ linkLost: true });
      });
      set({ bluetooth: mapState(await BleManager.checkState()) });
    })().catch((e: unknown) => { started = null; throw e; });
  }
  return started;
}

function mapState(s: string): BluetoothState {
  if (s === "on") return "on";
  if (s === "off" || s === "turning_off") return "off";
  if (s === "unauthorized") return "unauthorized";
  if (s === "unsupported") return "unsupported";
  return "unknown";
}

/** Busca plantillas durante unos segundos, filtrando por el servicio propio (no por el nombre anunciado). */
export async function scan(seconds = 6): Promise<void> {
  set({ error: undefined });
  if (!(await ensurePermissions())) { set({ bluetooth: "unauthorized", error: "Sin permiso para buscar dispositivos Bluetooth" }); return; }
  await start();
  if (state.bluetooth === "off") {
    try { await BleManager.enableBluetooth(); } catch { set({ error: "Bluetooth está apagado" }); return; }
  }
  set({ found: [], scanning: true });
  try {
    await BleManager.scan({ serviceUUIDs: [SERVICE_UUID], seconds, allowDuplicates: false, scanMode: BleScanMode.LowLatency });
  } catch (e) {
    set({ scanning: false, error: `No se pudo buscar: ${message(e)}` });
  }
}

function makeLink(id: string, mtu: number): BleLink {
  return {
    mtu,
    read: (c) => BleManager.read(id, SERVICE_UUID, c),
    write: (c, data) => BleManager.write(id, SERVICE_UUID, c, [...data], data.length),
    async monitor(c, onValue) {
      const sub = BleManager.onDidUpdateValueForCharacteristic((e) => {
        if (same(e.peripheral, id) && same(e.characteristic, c)) onValue(e.value);
      });
      await BleManager.startNotification(id, SERVICE_UUID, c);
      return async () => {
        sub.remove();
        try { await BleManager.stopNotification(id, SERVICE_UUID, c); } catch { /* enlace ya cortado */ }
      };
    },
    onDisconnected(cb) {
      const sub = BleManager.onDisconnectPeripheral((e) => {
        if (same(e.peripheral, id)) cb(e.status !== undefined ? `enlace cortado (código ${e.status})` : "enlace cortado");
      });
      return () => sub.remove();
    },
  };
}

/** Conecta, negocia MTU, descubre el servicio y lee la configuración publicada por la placa. */
async function open(id: string): Promise<Omit<ConnectedDevice, "name">> {
  await BleManager.connect(id);
  await BleManager.retrieveServices(id, [SERVICE_UUID]);
  let mtu = 23;
  try { mtu = await BleManager.requestMTU(id, REQUESTED_MTU); } catch { /* queda el MTU por defecto; se rechaza abajo */ }
  try { await BleManager.requestConnectionPriority(id, ConnectionPriority.high); } catch { /* opcional */ }
  if (mtu < MIN_MTU) {
    await BleManager.disconnect(id).catch(() => undefined);
    throw new Error(`MTU negociado ${mtu}: la placa necesita al menos ${MIN_MTU} para enviar un registro completo`);
  }
  const link = makeLink(id, mtu);
  const { info, configuration } = parseDeviceInfo(await link.read(INFO_UUID));
  return { id, mtu, info, configuration, link };
}

export async function connect(device: Pick<FoundDevice, "id" | "name">): Promise<void> {
  if (state.connecting) return;
  set({ connecting: device.id, error: undefined });
  try {
    if (!(await ensurePermissions())) throw new Error("Sin permiso para conectar dispositivos Bluetooth");
    await start();
    try { await BleManager.stopScan(); } catch { /* no estaba buscando */ }
    const opened = await open(device.id);
    set({ connected: { ...opened, name: device.name }, connecting: null, linkLost: false, scanning: false });
    saveSettings({ lastDevice: { id: device.id, name: device.name } });
  } catch (e) {
    set({ connecting: null, error: `No se pudo conectar: ${message(e)}` });
  }
}

/** Reabre el enlace con la placa actual (lo usa la fuente BLE durante una sesión). */
export async function reconnectLink(): Promise<BleLink> {
  const current = state.connected;
  if (!current) throw new Error("no hay plantillas conectadas");
  const opened = await open(current.id);
  if (opened.info.configuration_id !== current.info.configuration_id || opened.info.device_id !== current.info.device_id) {
    throw new Error("al reconectar, la placa informó otra configuración");
  }
  set({ connected: { ...opened, name: current.name }, linkLost: false });
  return opened.link;
}

export async function disconnect(): Promise<void> {
  const current = state.connected;
  set({ connected: null, linkLost: false });
  if (current) await BleManager.disconnect(current.id).catch(() => undefined);
}

/** Reconecta con la última placa usada, si hay una guardada (al abrir Plantillas). */
export async function connectLast(): Promise<void> {
  const last = loadSettings().lastDevice;
  if (!last || state.connected || state.connecting) return;
  await connect(last);
}
