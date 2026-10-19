import type { BleLink } from "../src/index";
import { COMMAND_START, COMMAND_STOP, CONTROL_UUID, INFO_UUID, MEASUREMENT_UUID, STATUS_UUID, encodeMeasurement } from "../src/index";

/** Info compacta tal como la publica el firmware 0.2.1-h6 (`ble_transport.cpp::info_json`, < 512 bytes). */
export const FIRMWARE_INFO = {
  format_version: "1.0",
  device_id: "ESP32-9E7EE4",
  configuration_id: "ESP32-SYN-001",
  firmware: "0.2.1-h6",
  raw_max: 4095,
  period_us: 50000,
  model: "synthetic",
  channels: ["L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"],
};

const text = (s: string) => Array.from(new TextEncoder().encode(s));

/** Placa falsa: responde a start/stop por la característica status y emite registros binarios a pedido. */
export class FakeBoard implements BleLink {
  mtu: number;
  boot = 8;
  capture = 0;
  sequence = 0;
  ackStart = true;
  private monitors = new Map<string, (v: readonly number[]) => void>();
  private lost = new Set<(reason: string) => void>();
  writes: number[][] = [];

  constructor(mtu = 185) { this.mtu = mtu; }

  async read(c: string) {
    if (c !== INFO_UUID) throw new Error(`lectura no soportada: ${c}`);
    return text(JSON.stringify(FIRMWARE_INFO));
  }

  async write(c: string, data: readonly number[]) {
    if (c !== CONTROL_UUID) throw new Error("escritura fuera de control");
    this.writes.push([...data]);
    const status = (event: string) => this.monitors.get(STATUS_UUID)?.(text(JSON.stringify({
      event, capture_id: `ESP32-9E7EE4-B${this.boot}-C${this.capture}`, boot: this.boot, n: this.capture, dropped: 0,
    })));
    if (data[0] === COMMAND_START) {
      this.capture += 1;
      this.sequence = 0;
      if (this.ackStart) queueMicrotask(() => status("capture_started"));
    } else if (data[0] === COMMAND_STOP) {
      queueMicrotask(() => status("capture_stopped"));
    }
  }

  async monitor(c: string, onValue: (v: readonly number[]) => void) {
    this.monitors.set(c, onValue);
    return async () => { this.monitors.delete(c); };
  }

  onDisconnected(cb: (reason: string) => void) {
    this.lost.add(cb);
    return () => this.lost.delete(cb);
  }

  /** Genera un registro (consume sequence). Si `deliver` es false, simula una notificación perdida. */
  emit(values: Array<number | null> = [100, 200, 300, 400, 500, 600], deliver = true) {
    const seq = this.sequence++;
    const bytes = encodeMeasurement({
      boot: this.boot, capture: this.capture, sequence: seq,
      samples: values.map((value, i) => ({ time_us: seq * 50000 + i * 3, value })),
    });
    if (deliver) this.monitors.get(MEASUREMENT_UUID)?.(Array.from(bytes));
    return seq;
  }

  cut(reason = "supervision timeout") {
    this.monitors.clear();
    for (const cb of [...this.lost]) cb(reason);
  }
}
