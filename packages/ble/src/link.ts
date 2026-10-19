/**
 * Enlace con una placa ya conectada. Lo implementa la aplicación sobre la
 * biblioteca BLE nativa; en las pruebas lo implementa un enlace falso. Los
 * UUID son los de `protocol.ts`; el servicio es siempre SERVICE_UUID.
 */
export interface BleLink {
  /** MTU negociado (incluye los 3 bytes de cabecera ATT). */
  readonly mtu: number;
  read(characteristic: string): Promise<Uint8Array | readonly number[]>;
  write(characteristic: string, data: readonly number[]): Promise<void>;
  /** Activa notificaciones y devuelve la función para desactivarlas. */
  monitor(characteristic: string, onValue: (value: readonly number[]) => void): Promise<() => Promise<void>>;
  /** Avisa cuando el enlace se corta sin que la app lo haya pedido. */
  onDisconnected(callback: (reason: string) => void): () => void;
}
