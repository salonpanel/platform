'use client';

import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente único en el navegador para evitar múltiples GoTrueClient
 * 
 * CRÍTICO: Usamos createBrowserClient de @supabase/ssr porque:
 * 1. Establece cookies HTTP automáticamente (sb-panel-auth-auth-token y sb-panel-auth-refresh-token)
 * 2. Estas cookies son accesibles por el servidor Next.js
 * 3. createClient solo guarda en localStorage, NO establece cookies HTTP
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no definidos");
    }

    // CRÍTICO: createBrowserClient de @supabase/ssr establece cookies HTTP automáticamente
    // que el servidor puede leer usando createServerComponentClient({ cookies })
    browserClient = createBrowserClient(url, key, {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [];
          return document.cookie.split(';').map(cookie => {
            const [name, value] = cookie.trim().split('=');
            return { name, value };
          });
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookieString = `${name}=${value}`;
            // CRÍTICO: Configurar cookies con dominio, sameSite y secure
            cookieString += `; Path=${options?.path || '/'}`;
            if (options?.domain) {
              cookieString += `; Domain=${options.domain}`;
            } else {
              // Por defecto, usar .bookfast.es para compartir entre subdominios
              cookieString += `; Domain=.bookfast.es`;
            }
            if (options?.sameSite) {
              cookieString += `; SameSite=${options.sameSite}`;
            } else {
              // Por defecto, SameSite=None para requests cross-site
              cookieString += `; SameSite=None`;
            }
            if (options?.secure !== false) {
              cookieString += `; Secure`;
            }
            if (options?.maxAge) {
              cookieString += `; Max-Age=${options.maxAge}`;
            } else {
              cookieString += `; Max-Age=${60 * 60 * 24 * 7}`; // 7 días por defecto
            }
            document.cookie = cookieString;
          });
        },
      },
      cookieOptions: {
        name: 'sb-panel-auth',
        path: '/',
        // CRÍTICO: Estas opciones se aplican a todas las cookies de Supabase
        // El dominio se establece en setAll() para cada cookie individualmente
      },
    });

    // Log de depuración: verificar configuración de cookies
    if (typeof window !== 'undefined') {
      console.log("[SupabaseBrowser] Client initialized with createBrowserClient from @supabase/ssr:", {
        url: url.substring(0, 30) + '...',
        storageKey: "sb-panel-auth",
        domain: window.location.hostname,
        cookieDomain: '.bookfast.es',
        sameSite: 'None',
        secure: true,
      });
    }
  }

  return browserClient;
}
