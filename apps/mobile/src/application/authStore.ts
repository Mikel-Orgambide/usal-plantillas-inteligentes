import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { getDatabase } from "../infrastructure/sqlite/database";
import { getSupabase, remoteConfigured } from "../infrastructure/supabase/client";

/**
 * Cuenta remota (etapa 11). La app funciona igual sin cuenta: la base local
 * es la fuente primaria. Con cuenta, las sesiones del usuario local vinculado
 * pueden sincronizarse. Al iniciar sesión se vincula (o se crea) el usuario
 * local que corresponde a esa cuenta; las sesiones ya grabadas conservan su
 * titular (docs/especificacion/03 §14).
 */

export type AuthStatus = "unconfigured" | "loading" | "signed_out" | "signed_in";

export interface AuthState {
  readonly status: AuthStatus;
  readonly remoteId: string | undefined;
  readonly email: string | undefined;
  /** Usuario de la base local al que se atribuyen las sesiones nuevas. */
  readonly localUserId: string;
}

let state: AuthState = { status: remoteConfigured ? "loading" : "unconfigured", remoteId: undefined, email: undefined, localUserId: "local" };
const listeners = new Set<() => void>();
let initialized = false;
let linking: Promise<void> = Promise.resolve();

function set(next: AuthState): void {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getAuth(): AuthState {
  return state;
}

async function applySession(session: Session | null): Promise<void> {
  if (!session?.user) {
    set({ status: "signed_out", remoteId: undefined, email: undefined, localUserId: "local" });
    return;
  }
  const { repository } = await getDatabase();
  const user = await repository.linkRemoteUser(session.user.id, session.user.email ?? null);
  set({ status: "signed_in", remoteId: session.user.id, email: session.user.email ?? undefined, localUserId: user.id });
}

/** Carga la sesión guardada y escucha los cambios. Idempotente. */
export function initAuth(): void {
  if (initialized || !remoteConfigured) return;
  initialized = true;
  const supabase = getSupabase();
  linking = supabase.auth.getSession().then(({ data }) => applySession(data.session)).catch(() => set({ ...state, status: "signed_out" }));
  supabase.auth.onAuthStateChange((_event, session) => {
    linking = linking.then(() => applySession(session)).catch((e: unknown) => console.warn("no se pudo vincular la cuenta", e));
  });
}

/** Usuario local al que atribuir una sesión nueva, una vez resuelta la vinculación. */
export async function resolveLocalUserId(): Promise<string> {
  await linking;
  return state.localUserId;
}

function describe(e: { message: string } | null): string | null {
  if (!e) return null;
  const m = e.message;
  if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/already registered/i.test(m)) return "Ya existe una cuenta con ese correo.";
  if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/email not confirmed/i.test(m)) return "La cuenta todavía no fue confirmada por correo.";
  if (/network request failed|fetch/i.test(m)) return "Sin conexión con el servicio remoto.";
  return m;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  const msg = describe(error);
  if (msg) throw new Error(msg);
  await linking;
}

/** Devuelve un aviso si la cuenta quedó pendiente de confirmación por correo. */
export async function signUp(email: string, password: string): Promise<string | null> {
  const { data, error } = await getSupabase().auth.signUp({ email: email.trim(), password });
  const msg = describe(error);
  if (msg) throw new Error(msg);
  if (!data.session) return "Cuenta creada. Revisá tu correo para confirmarla y después iniciá sesión.";
  await linking;
  return null;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw new Error(describe(error) ?? error.message);
}
