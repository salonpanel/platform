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
  // CRÍTICO: En Server Components (Next.js 16), el patrón correcto es:
  // 1. Llamar cookies() con await (puede ser async en Next.js 16)
  // 2. Pasar una función que retorna el cookieStore a createServerComponentClient
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error La versión actual del helper tipa este campo como función async
    cookies: () => cookieStore,
  });
  
  // Verificar sesión en el servidor usando getSession
  let {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[PanelLayout] Error al obtener sesión:", sessionError);
  }

  // Si no hay sesión, verificar si hay cookies de auth (sesión puede estar inicializándose)
  if (!session) {
    // Verificar si hay cookies de auth usando getAll() y buscando en el array
    const allCookies = cookieStore.getAll();
    const hasAuthCookies = allCookies.some((c: { name: string }) => c.name === "sb-panel-auth-auth-token") || 
                          allCookies.some((c: { name: string }) => c.name === "sb-panel-auth-refresh-token");
    
    if (hasAuthCookies) {
      // REINTENTAR obtener la sesión si hay cookies presentes
      // Esto permite darle tiempo a Supabase para hidratar correctamente la sesión
      // especialmente después de verificar OTP cuando las cookies acaban de establecerse
      console.log("[PanelLayout] No session but auth cookies present, rechecking session...");
      
      // Pequeño delay para dar tiempo a que las cookies se propaguen
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const recheckResult = await supabase.auth.getSession();
      if (recheckResult.data.session) {
        session = recheckResult.data.session;
        console.log("[PanelLayout] Rechecked session recovered:", {
          userId: session.user?.id,
          email: session.user?.email,
        });
      } else {
        console.log("[PanelLayout] Recheck failed, still no session");
      }
    }
    
    // Si después del reintento aún no hay sesión, redirigir al login
    if (!session) {
      console.log("[PanelLayout] Sin sesión después de reintento, redirigiendo a /login");
      redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
    }
  }

  // A partir de aquí, session existe y puedes recuperar user/tenant/etc.
  console.log("[PanelLayout] Session valid, rendering client layout:", {
    userId: session.user?.id,
    email: session.user?.email,
  });

  return <PanelLayoutClient>{children}</PanelLayoutClient>;
}
