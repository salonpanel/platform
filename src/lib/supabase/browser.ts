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
        // IMPORTANTE: detectSessionInUrl debe ser false para OTP
        // No queremos que Supabase intente detectar la sesión desde la URL (solo para Magic Link)
        detectSessionInUrl: false,
        // CRÍTICO: Habilitar explícitamente soporte multi-pestaña
        // Esto permite compartir sesiones entre pestañas y ventanas del mismo dominio
        flowType: 'pkce', // Usar PKCE para mejor seguridad
        // multiTab está habilitado automáticamente cuando persistSession es true
        // Esto usa BroadcastChannel para compartir cambios de sesión entre pestañas
        // debug: true, // Descomentar para logs detallados de autenticación (solo en desarrollo)
      },
      // Configuración global para multi-tab
      global: {
        // Supabase usa BroadcastChannel por defecto para multi-tab cuando persistSession es true
        // Esto sincroniza automáticamente cambios de sesión entre pestañas
      },
    });

    // Log de depuración: verificar configuración de cookies
    if (typeof window !== 'undefined') {
      console.log("[SupabaseBrowser] Client initialized with config:", {
        url: url.substring(0, 30) + '...',
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        storageKey: "sb-panel-auth",
        domain: window.location.hostname,
      });
    }
  }

  return browserClient;
}