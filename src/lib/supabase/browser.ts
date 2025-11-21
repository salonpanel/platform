'use client';

import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente único en el navegador para evitar múltiples GoTrueClient
 * 
 * CRÍTICO: Usamos createBrowserClient de @supabase/ssr (no createClient de @supabase/supabase-js)
 * porque createBrowserClient establece cookies que el servidor puede leer usando
 * createServerComponentClient({ cookies }) o createRouteHandlerClient({ cookies })
 * 
 * createClient solo guarda en localStorage, NO establece cookies HTTP que el servidor pueda leer
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no definidos");
    }

    // CRÍTICO: Usar createBrowserClient de @supabase/ssr en lugar de createClient
    // createBrowserClient establece cookies automáticamente que el servidor puede leer
    // La API de @supabase/ssr v0.7.0 usa una forma simplificada
    browserClient = createBrowserClient(url, key, {
      cookieOptions: {
        name: 'sb-panel-auth',
        path: '/',
      },
    });

    // Log de depuración: verificar configuración de cookies
    if (typeof window !== 'undefined') {
      console.log("[SupabaseBrowser] Client initialized with createBrowserClient from @supabase/ssr:", {
        url: url.substring(0, 30) + '...',
        storageKey: "sb-panel-auth",
        domain: window.location.hostname,
      });
    }
  }

  return browserClient;
}
