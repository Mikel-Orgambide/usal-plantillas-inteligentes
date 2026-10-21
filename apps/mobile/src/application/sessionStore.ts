import { useSyncExternalStore } from "react";
import * as Crypto from "expo-crypto";
import { CHANNEL_CODES, type ChannelCode, type DataSource } from "@plantillas/contract";
import { BleDataSource } from "@plantillas/ble";
import { SessionCoordinator, type SessionResult, type SessionSnapshot } from "@plantillas/session";
import { SCENARIOS, SimulatedDataSource } from "@plantillas/simulator";
import { getDatabase } from "../infrastructure/sqlite/database";
import { ensureSessionMetrics } from "./sessionMetrics";
import { loadSettings } from "../infrastructure/settings/settings";
import { getDevice, reconnectLink } from "../infrastructure/ble/deviceStore";
import { resolveSource } from "./activeSource";
import { resolveLocalUserId } from "./authStore";
import { syncAfterClose } from "./syncStore";

/**
 * Sesión activa de la aplicación. Vive fuera de React para que sobreviva a la
 * navegación entre pantallas; las pantallas se suscriben a su instantánea.
 * También conserva una ventana reciente de valores para el gráfico en vivo.
 */

export type Activity = "caminata" | "running" | "fuerza" | "otra";
export const ACTIVITY_LABEL: Record<Activity, string> = { caminata: "Caminata", running: "Running", fuerza: "Fuerza", otra: "Otra" };

/** Ventana del gráfico en vivo. */
export const LIVE_WINDOW_MS = 10_000;
const LIVE_BUCKETS = 50;

interface LivePoint { t: number; values: Record<ChannelCode, number | null> }

export interface ActiveSession {
  coordinator: SessionCoordinator;
  /** Procedencia y título de la fuente, fijados al iniciar. */
  sourceKind: "simulated" | "physical";
  sourceTitle: string;
  activity: Activity;
  context: string | undefined;
  snapshot: SessionSnapshot;
  /** Últimos valores recibidos, con marca de tiempo del teléfono, para el gráfico en vivo. */
  live: LivePoint[];
  result: SessionResult | undefined;
}

type Listener = () => void;

/** Estado interno, actualizado en cada registro. */
let active: ActiveSession | null = null;
/** Lo que leen las pantallas: una copia de `active` publicada como mucho cada PUBLISH_INTERVAL_MS. */
let published: ActiveSession | null = null;
const listeners = new Set<Listener>();
let lastAccepted = -1;
let publishTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Una placa real entrega 20 registros por segundo; redibujar la pantalla por
 * cada uno saturaba el hilo de JavaScript (la app se atrasaba, la cola de
 * escritura no tenía turno y los botones no respondían). Las pantallas se
 * actualizan como mucho 8 veces por segundo; los registros se procesan todos.
 */
const PUBLISH_INTERVAL_MS = 125;

function emit(): void {
  if (publishTimer !== undefined) clearTimeout(publishTimer);
  publishTimer = undefined;
  published = active ? { ...active } : null;
  for (const l of listeners) l();
}

function emitThrottled(): void {
  if (publishTimer !== undefined) return;
  publishTimer = setTimeout(emit, PUBLISH_INTERVAL_MS);
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveSession(): ActiveSession | null {
  return useSyncExternalStore(subscribe, () => published, () => published);
}

export async function startSession(activity: Activity, context: string | undefined): Promise<void> {
  if (active && !active.result) throw new Error("ya hay una sesión en curso");
  const settings = loadSettings();
  const resolved = resolveSource(getDevice(), settings);
  if (resolved.kind === "none" || !resolved.configuration) throw new Error(resolved.detail);
  const { repository } = await getDatabase();
  // Titular de la sesión: el usuario local vinculado a la cuenta activa, o `local` sin cuenta (etapa 11).
  const userId = await resolveLocalUserId();
  let source: DataSource;
  if (resolved.kind === "physical") {
    // Tras recargar la app o reiniciar la placa, el estado puede decir «conectadas» sin enlace real.
    if (getDevice().linkLost) {
      try {
        await reconnectLink();
      } catch (e) {
        throw new Error(`Las plantillas no responden (${e instanceof Error ? e.message : String(e)}). Reconectalas desde la pestaña Plantillas.`);
      }
    }
    const device = getDevice().connected!;
    source = new BleDataSource(device.link, device.configuration, device.info, { reconnect: reconnectLink, reconnectAttempts: 12, reconnectDelayMs: 1000 });
  } else {
    source = new SimulatedDataSource({ seed: settings.seed, scenario: SCENARIOS[settings.scenario], emit_interval_ms: 40 });
  }
  const coordinator = new SessionCoordinator({
    repository,
    source,
    configuration: resolved.configuration,
    userId,
    activity,
    ...(context ? { context } : {}),
    sessionId: Crypto.randomUUID(),
    // Lo que una placa real ya envió y todavía no se procesó al detener sigue siendo válido.
    lateDataWindowMs: 1500,
  });
  lastAccepted = -1;
  active = { coordinator, sourceKind: resolved.kind, sourceTitle: resolved.title, activity, context, snapshot: coordinator.snapshot(), live: [], result: undefined };
  coordinator.subscribe((snapshot) => {
    if (!active || active.coordinator !== coordinator) return;
    const live = active.live;
    if (snapshot.stats.accepted !== lastAccepted) {
      lastAccepted = snapshot.stats.accepted;
      const values = Object.fromEntries(CHANNEL_CODES.map((c) => [c, snapshot.values[c].value])) as Record<ChannelCode, number | null>;
      live.push({ t: Date.now(), values });
      const cutoff = Date.now() - LIVE_WINDOW_MS * 1.5;
      while (live.length > 0 && live[0]!.t < cutoff) live.shift();
    }
    active.snapshot = snapshot;
    emitThrottled();
  });
  emit();
  await coordinator.start();
  emit();
}

export async function stopSession(): Promise<SessionResult | undefined> {
  if (!active) return undefined;
  const result = await active.coordinator.stop();
  active = { ...active, result, snapshot: active.coordinator.snapshot() };
  emit();
  try {
    await ensureSessionMetrics(result.sessionId);
  } catch (e) {
    // Las métricas se recalculan al abrir el detalle; la sesión ya quedó cerrada.
    console.warn("no se pudieron calcular las métricas al cerrar", e);
  }
  // Con cuenta, la sesión cerrada se transfiere en segundo plano; si falla queda pendiente.
  syncAfterClose(result.sessionId);
  return result;
}

/** Descarta la sesión terminada del almacén (la base la conserva). */
export function clearSession(): void {
  if (active && active.result) {
    active = null;
    emit();
  }
}

/**
 * Serie para el gráfico en vivo: la ventana de los últimos `LIVE_WINDOW_MS`
 * dividida en tramos; un tramo sin valores recibidos es un hueco (`null`).
 */
export function liveSeries(live: LivePoint[], channel: ChannelCode, now = Date.now()): Array<number | null> {
  const out: Array<number | null> = new Array<number | null>(LIVE_BUCKETS).fill(null);
  const start = now - LIVE_WINDOW_MS;
  const sums = new Array<number>(LIVE_BUCKETS).fill(0);
  const counts = new Array<number>(LIVE_BUCKETS).fill(0);
  for (const p of live) {
    if (p.t < start) continue;
    const i = Math.min(LIVE_BUCKETS - 1, Math.floor(((p.t - start) / LIVE_WINDOW_MS) * LIVE_BUCKETS));
    const v = p.values[channel];
    if (v === null) continue;
    sums[i]! += v;
    counts[i]! += 1;
  }
  for (let i = 0; i < LIVE_BUCKETS; i++) if (counts[i]! > 0) out[i] = Math.round(sums[i]! / counts[i]!);
  return out;
}
