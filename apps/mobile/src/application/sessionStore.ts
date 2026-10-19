import { useSyncExternalStore } from "react";
import * as Crypto from "expo-crypto";
import { CHANNEL_CODES, SIMULATED_CONFIGURATION, type ChannelCode } from "@plantillas/contract";
import { SessionCoordinator, type SessionResult, type SessionSnapshot } from "@plantillas/session";
import { SCENARIOS, SimulatedDataSource } from "@plantillas/simulator";
import { getDatabase } from "../infrastructure/sqlite/database";
import { loadSettings } from "../infrastructure/settings/settings";

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
  activity: Activity;
  context: string | undefined;
  snapshot: SessionSnapshot;
  /** Últimos valores recibidos, con marca de tiempo del teléfono, para el gráfico en vivo. */
  live: LivePoint[];
  result: SessionResult | undefined;
}

type Listener = () => void;

let active: ActiveSession | null = null;
const listeners = new Set<Listener>();
let lastAccepted = -1;

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveSession(): ActiveSession | null {
  return useSyncExternalStore(subscribe, () => active, () => active);
}

export async function startSession(activity: Activity, context: string | undefined): Promise<void> {
  if (active && !active.result) throw new Error("ya hay una sesión en curso");
  const settings = loadSettings();
  const { repository } = await getDatabase();
  const source = new SimulatedDataSource({ seed: settings.seed, scenario: SCENARIOS[settings.scenario], emit_interval_ms: 40 });
  const coordinator = new SessionCoordinator({
    repository,
    source,
    configuration: SIMULATED_CONFIGURATION,
    userId: "local",
    activity,
    ...(context ? { context } : {}),
    sessionId: Crypto.randomUUID(),
    lateDataWindowMs: 300,
  });
  lastAccepted = -1;
  active = { coordinator, activity, context, snapshot: coordinator.snapshot(), live: [], result: undefined };
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
    active = { ...active, snapshot, live };
    emit();
  });
  emit();
  await coordinator.start();
}

export async function stopSession(): Promise<SessionResult | undefined> {
  if (!active) return undefined;
  const result = await active.coordinator.stop();
  active = { ...active, result, snapshot: active.coordinator.snapshot() };
  emit();
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
