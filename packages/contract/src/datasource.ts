import type { AcquisitionConfiguration } from "./channels";

/**
 * Interfaz común de toda fuente de datos (simulador o dispositivo físico).
 *
 * La fuente entrega *payloads sin validar* (`unknown`): la aplicación los pasa
 * por `validateSourceRecord` antes de aceptarlos. Así el simulador puede
 * producir también mensajes defectuosos para probar la validación, y el
 * adaptador físico no necesita confiar en la estructura recibida.
 */

export type SourceEvent =
  | { readonly type: "connected"; readonly at_us: number }
  | { readonly type: "disconnected"; readonly at_us: number; readonly reason: string }
  | { readonly type: "reconnected"; readonly at_us: number }
  | { readonly type: "capture_started"; readonly at_us: number; readonly capture_id: string }
  | { readonly type: "capture_restarted"; readonly at_us: number; readonly capture_id: string; readonly previous_capture_id: string }
  | { readonly type: "capture_stopped"; readonly at_us: number; readonly capture_id: string }
  | { readonly type: "source_error"; readonly at_us: number; readonly message: string };

export interface SourceListener {
  onPayload(payload: unknown): void;
  onEvent(event: SourceEvent): void;
}

export interface DataSource {
  readonly configuration: AcquisitionConfiguration;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startCapture(): Promise<void>;
  stopCapture(): Promise<void>;
  subscribe(listener: SourceListener): () => void;
}
