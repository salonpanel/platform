'use client';

import { PropsWithChildren, useState } from "react";
import { createBrowserClient } from "@supabase/auth-helpers-nextjs";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseContext } from "@/lib/supabase-context";

export function SupabaseProvider({ children }: PropsWithChildren) {
  const [supabase] = useState<SupabaseClient>(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

export default SupabaseProvider;

