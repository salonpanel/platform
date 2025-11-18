'use client';

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente único en el navegador para evitar múltiples GoTrueClient
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("SUPABASE_URL o SUPABASE_ANON_KEY no definidos");
    }

    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        storageKey: "sb-panel-auth",
      },
    });
  }

  return browserClient;
}