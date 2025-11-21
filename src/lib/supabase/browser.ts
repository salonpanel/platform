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
        // CRÍTICO: Habilitar explícitamente soporte multi-pestaña
        // Esto permite compartir sesiones entre pestañas y ventanas del mismo dominio
        flowType: 'pkce', // Usar PKCE para mejor seguridad
        // Nota: multiTab está habilitado por defecto en Supabase v2+ cuando se usa localStorage/IndexedDB
        // pero es importante asegurar que persistSession esté en true
      },
      // Configuración global para multi-tab
      global: {
        // Supabase usa BroadcastChannel por defecto para multi-tab cuando persistSession es true
        // Esto sincroniza automáticamente cambios de sesión entre pestañas
      },
    });
  }

  return browserClient;
}