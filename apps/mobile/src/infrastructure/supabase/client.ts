import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import Storage from "expo-sqlite/kv-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase (ADR 0003, 0008). Sólo usa la URL y la clave
 * publicable (`EXPO_PUBLIC_*`): la clave secreta nunca entra en la app. La
 * sesión de autenticación se conserva en el almacén clave-valor local de
 * expo-sqlite y el token se renueva mientras la app está en primer plano.
 */

const URL = process.env["EXPO_PUBLIC_SUPABASE_URL"];
const KEY = process.env["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

/** `true` si el paquete se construyó con las variables del complemento remoto. */
export const remoteConfigured = Boolean(URL && KEY);
/** URL del proyecto y clave publicable, para las funciones gestionadas (asistente, ADR 0012). */
export const supabaseUrl = URL;
export const supabaseAnonKey = KEY;

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!URL || !KEY) throw new Error("El complemento remoto no está configurado en este paquete (EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).");
  if (!client) {
    const c = createClient(URL, KEY, {
      auth: {
        // Versión síncrona del almacén clave-valor, envuelta en promesas: la
        // versión asíncrona de expo-sqlite falló con NullPointerException cuando
        // auth-js la llamaba en paralelo (lectura de sesión + renovación del token).
        storage: {
          getItem: async (key: string) => Storage.getItemSync(key),
          setItem: async (key: string, value: string) => { Storage.setItemSync(key, value); },
          removeItem: async (key: string) => { Storage.removeItemSync(key); },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    AppState.addEventListener("change", (state) => {
      if (state === "active") void c.auth.startAutoRefresh();
      else void c.auth.stopAutoRefresh();
    });
    client = c;
  }
  return client;
}
