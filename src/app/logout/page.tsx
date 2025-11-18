"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function LogoutPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/logout", { method: "POST" });
      } finally {
        await supabase.auth.signOut();
        router.replace("/login");
      }
    })();
  }, [router, supabase]);

  return (
    <div className="p-6">
      <p>Cerrando sesión…</p>
    </div>
  );
}

