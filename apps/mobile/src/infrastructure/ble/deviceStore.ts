import { useSyncExternalStore } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import BleManager, { BleScanMode, ConnectionPriority } from "react-native-ble-manager";
import { footAvailability, type AcquisitionConfiguration, type Foot } from "@plantillas/contract";
import { INFO_UUID, MIN_MTU, REQUESTED_MTU, SERVICE_UUID, parseDeviceInfo, type BleLink, type DeviceInfo } from "@plantillas/ble";
import { loadSettings, saveSettings } from "../settings/settings";

/**
 * Plantillas por Bluetooth: permisos, búsqueda, conexión y lectura de la
 * configuración que publica la placa. Vive fuera de React (como la sesión
 * activa) para que la conexión sobreviva a la navegación. El protocolo y la
 * traducción de registros están en `@plantillas/ble`; acá solo hay transporte.
 *
 * Hasta dos módulos a la vez, uno por pie (ADR 0011): el pie se deduce de la
 * configuración que publica cada placa, no del nombre anunciado. Una placa que
 * instrumenta ambos pies (sintética de seis) va sola.
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
  /** Pie que instrumenta; `null` si instrumenta ambos. */
  readonly foot: Foot | null;
  /** El enlace se cortó sin pedirlo; la sesión en curso intenta reconectar. */
  readonly linkLost: boolean;
}

export interface DeviceState {
  readonly bluetooth: BluetoothState;
  readonly scanning: boolean;
  readonly found: readonly FoundDevice[];
  readonly connecting: string | null;
  /** Primer módulo conectado (compatibilidad); con dos, ver `modules`. */
  readonly connected: ConnectedDevice | null;
  /** Todos los módulos conectados, en orden de conexión (izquierdo primero si están ambos). */
  readonly modules: readonly ConnectedDevice[];
  /** Algún enlace se cortó sin pedirlo. */
  readonly linkLost: boolean;
  readonly error: string | undefined;
}

let state: DeviceState = { bluetooth: "unknown", scanning: false, found: [], connecting: null, connected: null, modules: [], linkLost: false, error: undefined };

const footOf = (c: AcquisitionConfiguration): Foot | null => {
  const a = footAvailability(c);
  return a.left && a.right ? null : a.left ? "left" : a.right ? "right" : null;
};

const ORDER: Record<string, number> = { left: 0, right: 1, both: 2 };
function setModules(modules: readonly ConnectedDevice[]): void {
  const sorted = [...modules].sort((a, b) => ORDER[a.foot ?? "both"]! - ORDER[b.foot ?? "both"]!);
  set({ modules: sorted, connected: sorted[0] ?? null, linkLost: sorted.some((m) => m.linkLost) });
}
function patchModule(id: string, patch: Partial<ConnectedDevice>): void {
  setModules(state.modules.map((m) => (same(m.id, id) ? { ...m, ...patch } : m)));
}
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
        if (state.modules.some((m) => same(m.id, e.peripheral))) patchModule(e.peripheral, { linkLost: true });
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
async function open(id: string): Promise<Omit<ConnectedDevice, "name" | "linkLost">> {
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
  return { id, mtu, info, configuration, link, foot: footOf(configuration) };
}

/** Un módulo nuevo tiene que instrumentar un pie que todavía no está cubierto (y una placa de ambos pies va sola). */
function admit(candidate: Omit<ConnectedDevice, "name" | "linkLost">): string | null {
  const others = state.modules.filter((m) => !same(m.id, candidate.id));
  if (others.length === 0) return null;
  if (others.length >= 2) return "ya hay dos módulos conectados (uno por pie)";
  const other = others[0]!;
  if (candidate.foot === null || other.foot === null) return "una placa que instrumenta ambos pies no se combina con otra";
  if (candidate.foot === other.foot) return `ya hay un módulo para el pie ${candidate.foot === "left" ? "izquierdo" : "derecho"} (${other.info.device_id})`;
  if (candidate.configuration.source !== other.configuration.source) return "no se mezclan procedencias";
  return null;
}

export async function connect(device: Pick<FoundDevice, "id" | "name">): Promise<void> {
  if (state.connecting) return;
  set({ connecting: device.id, error: undefined });
  try {
    if (!(await ensurePermissions())) throw new Error("Sin permiso para conectar dispositivos Bluetooth");
    await start();
    try { await BleManager.stopScan(); } catch { /* no estaba buscando */ }
    const opened = await open(device.id);
    const rejection = admit(opened);
    if (rejection) {
      await BleManager.disconnect(device.id).catch(() => undefined);
      throw new Error(rejection);
    }
    setModules([...state.modules.filter((m) => !same(m.id, device.id)), { ...opened, name: device.name, linkLost: false }]);
    set({ connecting: null, scanning: false });
    const remembered = loadSettings().lastDevices ?? [];
    saveSettings({
      lastDevice: { id: device.id, name: device.name },
      lastDevices: [...remembered.filter((d) => !same(d.id, device.id)), { id: device.id, name: device.name }].slice(-2),
    });
  } catch (e) {
    set({ connecting: null, error: `No se pudo conectar: ${message(e)}` });
  }
}

/**
 * Espera a ver la placa anunciarse (escaneo filtrado por nuestro servicio).
 * Android no reconecta de forma fiable a un dispositivo recién reiniciado si
 * no lo ha vuelto a ver en un escaneo.
 */
async function waitForAdvertising(id: string, seconds: number): Promise<void> {
  try { await BleManager.stopScan(); } catch { /* no estaba buscando */ }
  await new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sub.remove();
      stop.remove();
      if (ok) resolve(); else reject(new Error("la placa no se anuncia"));
    };
    const sub = BleManager.onDiscoverPeripheral((p) => { if (same(p.id, id)) finish(true); });
    const stop = BleManager.onStopScan(() => finish(false));
    BleManager.scan({ serviceUUIDs: [SERVICE_UUID], seconds, allowDuplicates: true, scanMode: BleScanMode.LowLatency }).catch((e: unknown) => { done = true; sub.remove(); stop.remove(); reject(e instanceof Error ? e : new Error(String(e))); });
  });
  try { await BleManager.stopScan(); } catch { /* ya detenido */ }
}

/** Reabre el enlace con una placa conectada (lo usa la fuente BLE durante una sesión). Sin `id`, la primera. */
export async function reconnectLink(id?: string): Promise<BleLink> {
  const current = id ? state.modules.find((m) => same(m.id, id)) : state.connected;
  if (!current) throw new Error("no hay plantillas conectadas");
  try { await BleManager.disconnect(current.id); } catch { /* ya estaba cortado */ }
  await waitForAdvertising(current.id, 4);
  const opened = await open(current.id);
  if (opened.info.configuration_id !== current.info.configuration_id || opened.info.device_id !== current.info.device_id) {
    throw new Error("al reconectar, la placa informó otra configuración");
  }
  patchModule(current.id, { ...opened, linkLost: false });
  return opened.link;
}

/** Desconecta un módulo (por id) o todos. */
export async function disconnect(id?: string): Promise<void> {
  const targets = id ? state.modules.filter((m) => same(m.id, id)) : state.modules;
  setModules(state.modules.filter((m) => !targets.includes(m)));
  for (const t of targets) await BleManager.disconnect(t.id).catch(() => undefined);
}

/** Reconecta con las últimas placas usadas (al abrir Plantillas): los enlaces perdidos y las recordadas que falten. */
export async function connectLast(): Promise<void> {
  if (state.connecting) return;
  for (const m of state.modules) {
    if (!m.linkLost) continue;
    set({ connecting: m.id, error: undefined });
    try { await reconnectLink(m.id); } catch (e) { set({ error: `No se pudo reconectar ${m.info.device_id}: ${message(e)}` }); }
    set({ connecting: null });
  }
  const settings = loadSettings();
  const remembered = settings.lastDevices ?? (settings.lastDevice ? [settings.lastDevice] : []);
  for (const last of remembered) {
    if (state.modules.some((m) => same(m.id, last.id))) continue;
    await connect(last);
  }
}
