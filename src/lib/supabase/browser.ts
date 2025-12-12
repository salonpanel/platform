'use client';

import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase en el navegador (simple y compatible con SSR)
 * - NO gestionar cookies manualmente
 * - NO sobrescribir getAll() ni setAll()
 * - Supabase SSR sincroniza cookies vía route handlers
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        cookieOptions: {
          name: "sb-panel-auth",
          path: "/",
        },
      }
    );
  }

  return client;
}
