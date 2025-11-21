'use client';

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Storage personalizado que establece cookies con la configuración correcta
 * CRÍTICO: Esto es necesario para que las cookies sean accesibles por el servidor Next.js
 */
function createCookieStorage() {
  return {
    getItem: (key: string): string | null => {
      if (typeof document === 'undefined') return null;
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [k, v] = cookie.trim().split('=');
        acc[k] = v;
        return acc;
      }, {} as Record<string, string>);
      return cookies[key] || null;
    },
    setItem: (key: string, value: string): void => {
      if (typeof document === 'undefined') return;
      // CRÍTICO: Configurar cookies con dominio, sameSite y secure
      const cookieString = `${key}=${value}; Path=/; Domain=.bookfast.es; SameSite=None; Secure; Max-Age=${60 * 60 * 24 * 7}`;
      document.cookie = cookieString;
    },
    removeItem: (key: string): void => {
      if (typeof document === 'undefined') return;
      document.cookie = `${key}=; Path=/; Domain=.bookfast.es; Max-Age=0`;
    },
  };
}

/**
 * Cliente único en el navegador para evitar múltiples GoTrueClient
 * 
 * CRÍTICO: cookieOptions es OBLIGATORIO para PKCE para que las cookies sean accesibles por el servidor
 * Sin cookieOptions, las cookies se crean pero NO son aptas para ser enviadas a Next.js (server)
 * Esto causa que el middleware vea hasSession: false aunque las cookies existan en document.cookie
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no definidos");
    }

    // CRÍTICO: Usar storage personalizado que establece cookies con la configuración correcta
    // Esto asegura que las cookies tengan domain, sameSite y secure correctos
    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        storageKey: "sb-panel-auth",
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storage: createCookieStorage(), // CRÍTICO: Storage personalizado con cookies configuradas
      },
    });

    // Log de depuración: verificar configuración de cookies
    if (typeof window !== 'undefined') {
      console.log("[SupabaseBrowser] Client initialized with custom cookie storage:", {
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
