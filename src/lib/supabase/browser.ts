'use client';

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente único en el navegador para evitar múltiples GoTrueClient
 * 
 * NOTA: Cuando se llama a supabase.auth.setSession() desde este cliente,
 * las cookies se establecen automáticamente y el servidor puede leerlas
 * usando createServerComponentClient({ cookies }) o createRouteHandlerClient({ cookies })
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no definidos");
    }

    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        storageKey: "sb-panel-auth",
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Habilitar sincronización multi-pestaña para detectar cambios de auth en otras pestañas
        // Esto permite que cuando el usuario se autentica en una pestaña, las demás se enteren
        flowType: 'pkce', // Usar PKCE para mejor seguridad
      },
      // Configuración global para multi-tab
      global: {
        // Supabase usa BroadcastChannel por defecto para multi-tab, no necesita configuración adicional
      },
    });
  }

  return browserClient;
}