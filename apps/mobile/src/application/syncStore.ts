import { useEffect, useState, useSyncExternalStore } from "react";
import type { SyncStateRow } from "@plantillas/storage";
import { syncPendingSessions, syncSession, type SyncOutcome, type SyncProgress, type SyncRunReport } from "@plantillas/sync";
import { getDatabase } from "../infrastructure/sqlite/database";
import { getSupabase } from "../infrastructure/supabase/client";
import { SupabaseGateway } from "../infrastructure/supabase/SupabaseGateway";
import { getAuth } from "./authStore";

/**
 * Estado de la sincronización para las pantallas: cuántas sesiones esperan,
 * qué está pasando ahora y cómo terminó la última corrida. La transferencia
 * en sí la hace `@plantillas/sync`; acá sólo se conecta con la cuenta activa
 * y la base local.
 */

export interface SyncUiState {
  readonly running: boolean;
  readonly pendingCount: number;
  readonly progress: SyncProgress | undefined;
  readonly lastRun: { readonly at: string; readonly report: SyncRunReport } | undefined;
}

let state: SyncUiState = { running: false, pendingCount: 0, progress: undefined, lastRun: undefined };
const listeners = new Set<() => void>();
let gateway: SupabaseGateway | undefined;

function set(patch: Partial<SyncUiState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSync(): SyncUiState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

function options(remoteId: string) {
  gateway ??= new SupabaseGateway(getSupabase());
  return { gateway, ownerRemoteId: remoteId, onProgress: (p: SyncProgress) => set({ progress: p }) };
}

/** Recuenta las sesiones pendientes de la cuenta activa. */
export async function refreshPending(): Promise<number> {
  const auth = getAuth();
  if (auth.status !== "signed_in" || !auth.remoteId) {
    set({ pendingCount: 0 });
    return 0;
  }
  const { repository } = await getDatabase();
  const n = (await repository.listSessionsPendingSync(auth.remoteId)).length;
  set({ pendingCount: n });
  return n;
}

/** Sincroniza todas las sesiones pendientes de la cuenta activa, una por una. */
export async function syncAll(): Promise<SyncRunReport> {
  const auth = getAuth();
  if (auth.status !== "signed_in" || !auth.remoteId) throw new Error("Iniciá sesión para sincronizar.");
  if (state.running) throw new Error("Ya hay una sincronización en curso.");
  set({ running: true, progress: undefined });
  try {
    const { driver } = await getDatabase();
    const report = await syncPendingSessions({ db: driver, ...options(auth.remoteId) });
    set({ lastRun: { at: new Date().toISOString(), report } });
    return report;
  } finally {
    set({ running: false, progress: undefined });
    await refreshPending();
  }
}

/** Sincroniza una sesión concreta (desde el detalle). */
export async function syncOne(sessionId: string): Promise<SyncOutcome> {
  const auth = getAuth();
  if (auth.status !== "signed_in" || !auth.remoteId) throw new Error("Iniciá sesión para sincronizar.");
  if (state.running) throw new Error("Ya hay una sincronización en curso.");
  set({ running: true, progress: undefined });
  try {
    const { driver } = await getDatabase();
    return await syncSession({ db: driver, ...options(auth.remoteId) }, sessionId);
  } finally {
    set({ running: false, progress: undefined });
    await refreshPending();
  }
}

/** Tras cerrar una sesión: intenta sincronizarla si hay cuenta; cualquier falla queda registrada y pendiente. */
export function syncAfterClose(sessionId: string): void {
  const auth = getAuth();
  if (auth.status !== "signed_in" || state.running) {
    void refreshPending();
    return;
  }
  syncOne(sessionId).catch((e: unknown) => console.warn("sincronización al cerrar", e));
}

/** Estado de sincronización de una sesión, releído cuando cambia el almacén. */
export function useSessionSyncState(sessionId: string | undefined): SyncStateRow | null | undefined {
  const ui = useSync();
  const [row, setRow] = useState<SyncStateRow | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!sessionId) return;
    void getDatabase().then(({ repository }) => repository.getSyncState(sessionId)).then((r) => { if (alive) setRow(r ?? null); });
    return () => { alive = false; };
  }, [sessionId, ui.running, ui.lastRun]);
  return row;
}

export function describeOutcome(o: SyncOutcome): string {
  switch (o.status) {
    case "confirmed": return `Sincronizada: el servidor confirma ${o.counts.records} registros, ${o.counts.events} eventos y ${o.counts.results} resultados.`;
    case "pending": return `Quedó pendiente: ${o.error}.`;
    case "failed": return `No se pudo: ${o.error}.`;
    case "skipped": return `No se transfiere: ${o.reason}.`;
  }
}
