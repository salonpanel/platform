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
 * 
 * SEGURIDAD:
 * - SameSite=Lax para protección contra CSRF
 * - Secure solo en producción (HTTPS)
 * - Dominio dinámico según entorno (localhost en dev, .bookfast.es en prod)
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no definidos");
    }

    const isDevelopment = process.env.NODE_ENV === 'development';

    // CRÍTICO: En producción, usar proxy para evitar CORS
    if (!isDevelopment && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'pro.bookfast.es') {
        // Reemplazar URL de Supabase con proxy local
        url = window.location.origin;
      }
    }

    // CRÍTICO: createBrowserClient de @supabase/ssr establece cookies HTTP automáticamente
    // que el servidor puede leer usando createServerClient
    browserClient = createBrowserClient(url, key, {
      // Configuración custom para usar proxy en producción
      auth: {
        // En producción, usar proxy para endpoints de auth
        ...(process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.location.hostname === 'pro.bookfast.es' && {
          // Override URLs para que usen el proxy
          url: `${window.location.origin}/auth-proxy`,
        }),
      },
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
          
          if (isDevelopment) {
            console.log("[SupabaseBrowser] setAll called with cookies:", cookiesToSet.map(c => c.name));
          }
          
          cookiesToSet.forEach(({ name, value, options }) => {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
            let cookieString = `${name}=${value}`;
            
            // Path
            cookieString += `; Path=${options?.path || '/'}`;
            
            // Domain: Solo establecer en producción para subdominios de bookfast.es
            if (options?.domain) {
              cookieString += `; Domain=${options.domain}`;
            } else if (!isDevelopment && hostname.endsWith('.bookfast.es')) {
              // En producción, usar .bookfast.es para compartir entre subdominios
              cookieString += `; Domain=.bookfast.es`;
            }
            // En desarrollo (localhost), NO establecer Domain para que funcione correctamente
            
            // SameSite: Lax para mejor seguridad (protección contra CSRF)
            // Lax permite cookies en navegación top-level (clicks en links)
            // pero NO en requests cross-site (fetch, XHR desde otros dominios)
            if (options?.sameSite) {
              cookieString += `; SameSite=${options.sameSite}`;
            } else {
              cookieString += `; SameSite=Lax`;
            }
            
            // Secure: Solo en producción (HTTPS)
            if (!isDevelopment && options?.secure !== false) {
              cookieString += `; Secure`;
            }
            
            // Max-Age
            if (options?.maxAge) {
              cookieString += `; Max-Age=${options.maxAge}`;
            } else {
              cookieString += `; Max-Age=${60 * 60 * 24 * 7}`; // 7 días por defecto
            }
            
            if (isDevelopment) {
              console.log("[SupabaseBrowser] Setting cookie:", name, "with options:", {
                domain: options?.domain || (hostname.endsWith('.bookfast.es') ? '.bookfast.es' : 'none'),
                sameSite: options?.sameSite || 'Lax',
                secure: !isDevelopment && options?.secure !== false,
                path: options?.path || '/',
              });
            }
            
            document.cookie = cookieString;
          });
          
          // Verificar que las cookies se establecieron (solo en desarrollo)
          if (isDevelopment) {
            const allCookies = document.cookie.split(';').map(c => c.trim());
            const authCookies = allCookies.filter(c => c.startsWith('sb-panel-auth'));
            console.log("[SupabaseBrowser] Cookies after setAll:", {
              allCookies: allCookies.length,
              authCookies: authCookies.map(c => c.split('=')[0]),
            });
          }
        },
      },
      cookieOptions: {
        name: 'sb-panel-auth',
        path: '/',
        // CRÍTICO: Estas opciones se aplican a todas las cookies de Supabase
        // El dominio se establece en setAll() para cada cookie individualmente
      },
    });

    // Log de depuración: verificar configuración de cookies (solo en desarrollo)
    if (typeof window !== 'undefined' && isDevelopment) {
      console.log("[SupabaseBrowser] Client initialized with createBrowserClient from @supabase/ssr:", {
        url: url.substring(0, 30) + '...',
        storageKey: "sb-panel-auth",
        hostname: window.location.hostname,
        cookieDomain: window.location.hostname.endsWith('.bookfast.es') ? '.bookfast.es' : 'none (localhost)',
        sameSite: 'Lax',
        secure: !isDevelopment,
        environment: isDevelopment ? 'development' : 'production',
      });
    }
  }

  return browserClient;
}
