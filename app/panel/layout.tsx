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
  
  // Log de cookies disponibles para debugging
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => c.name.includes('sb-panel-auth'));
  console.log("[PanelLayout] Available cookies:", {
    totalCookies: allCookies.length,
    authCookies: authCookies.length,
    authCookieNames: authCookies.map(c => c.name),
  });
  
  // Verificar sesión en el servidor usando getSession (más rápido que getUser)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  console.log("[PanelLayout] Server-side session check:", {
    hasSession: !!session,
    userId: session?.user?.id,
    email: session?.user?.email,
    hasError: !!sessionError,
    errorMessage: sessionError?.message,
    errorName: sessionError?.name,
  });

  // Si no hay sesión, intentar getUser como fallback
  if (!session && !sessionError) {
    console.log("[PanelLayout] No session, trying getUser as fallback...");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log("[PanelLayout] getUser result:", {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!userError,
      errorMessage: userError?.message,
    });
    
    if (!user || userError) {
      console.log("[PanelLayout] No session or user, redirecting to login");
      redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
    }
  } else if (!session || sessionError) {
    console.log("[PanelLayout] Session error or missing, redirecting to login", { 
      error: sessionError,
      errorMessage: sessionError?.message,
      errorName: sessionError?.name,
    });
    redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
  }

  // Si hay sesión, renderizar el layout cliente
  console.log("[PanelLayout] Session valid, rendering client layout");
  return <PanelLayoutClient>{children}</PanelLayoutClient>;
}
