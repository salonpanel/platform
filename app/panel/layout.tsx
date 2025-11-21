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
  // NOTA: En Next.js 16, cookies() en server components puede requerir await
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => c.name.includes('sb-panel-auth'));
  console.log("[PanelLayout] Available cookies:", {
    totalCookies: allCookies.length,
    authCookies: authCookies.length,
    authCookieNames: authCookies.map(c => c.name),
    allCookieNames: allCookies.map(c => c.name),
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

  // Si no hay sesión, verificar si hay cookies de autenticación
  if (!session) {
    // Verificar si hay cookies de autenticación (sesión puede estar inicializándose)
    const hasAuthCookies = authCookies.length > 0;
    
    if (hasAuthCookies) {
      // REINTENTAR obtener la sesión si hay cookies presentes
      // Esto permite darle tiempo a Supabase para hidratar correctamente la sesión
      console.log("[PanelLayout] No session but auth cookies present, rechecking session...");
      const { data: { session: recheckedSession }, error: recheckError } = await supabase.auth.getSession();
      
      if (recheckedSession) {
        console.log("[PanelLayout] Rechecked session recovered, allowing access");
        // La sesión se recuperó, continuar normalmente
      } else {
        // Si el reintento falla, intentar getUser como último recurso
        console.log("[PanelLayout] Recheck failed, trying getUser as fallback...");
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        console.log("[PanelLayout] getUser result:", {
          hasUser: !!user,
          userId: user?.id,
          hasError: !!userError,
          errorMessage: userError?.message,
        });
        
        if (!user || userError) {
          console.log("[PanelLayout] No session, user, or cookies, redirecting to login");
          redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
        }
        // Si getUser funciona, continuar normalmente
      }
    } else {
      // No hay cookies, redirigir al login
      console.log("[PanelLayout] No session and no auth cookies, redirecting to login");
      redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
    }
  } else if (sessionError) {
    // Si hay un error de sesión, redirigir al login
    console.log("[PanelLayout] Session error, redirecting to login", { 
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
