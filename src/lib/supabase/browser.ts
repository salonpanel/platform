'use client';

import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

const clients = new Map<string, SupabaseClient>();

/**
 * Cliente Supabase en el navegador (simple y compatible con SSR)
 * - NO gestionar cookies manualmente
 * - NO sobrescribir getAll() ni setAll()
 * - Supabase SSR sincroniza cookies vía route handlers
 */
export function getSupabaseBrowser(options?: { cookieName?: string }): SupabaseClient {
  const cookieName = options?.cookieName || "sb-panel-auth";

  if (!clients.has(cookieName)) {
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        cookieOptions: {
          name: cookieName,
          path: "/",
        },
      }
    );
    clients.set(cookieName, client);
  }

  return clients.get(cookieName)!;
}
