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
  // CRÍTICO: En Next.js 16, cookies() NO es async en server components
  // Debe llamarse directamente sin await
  // createServerComponentClient espera cookies como función que retorna el objeto
  const supabase = createServerComponentClient({ 
    cookies: () => cookies() 
  });
  
  // Verificar sesión en el servidor usando getSession
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[PanelLayout] Error al obtener sesión:", sessionError);
  }

  if (!session) {
    console.log("[PanelLayout] Sin sesión, redirigiendo a /login");
    redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
  }

  // A partir de aquí, session existe y puedes recuperar user/tenant/etc.
  console.log("[PanelLayout] Session valid, rendering client layout:", {
    userId: session.user?.id,
    email: session.user?.email,
  });

  return <PanelLayoutClient>{children}</PanelLayoutClient>;
}
