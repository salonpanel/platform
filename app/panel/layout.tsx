/**
 * Server-side layout para el panel
 * Verifica la sesión en el servidor antes de renderizar el layout cliente
 */
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import PanelLayoutClient from "./layout-client";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Crear cliente de Supabase con cookies (server-side)
  const supabase = createServerComponentClient({ cookies });
  
  // Verificar sesión en el servidor usando getSession (más rápido que getUser)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  // Si no hay sesión, intentar getUser como fallback
  if (!session && !sessionError) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (!user || userError) {
      console.log("[PanelLayout] No session or user, redirecting to login");
      redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
    }
  } else if (!session || sessionError) {
    console.log("[PanelLayout] Session error or missing, redirecting to login", { error: sessionError });
    redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
  }

  // Si hay sesión, renderizar el layout cliente
  return <PanelLayoutClient>{children}</PanelLayoutClient>;
}
