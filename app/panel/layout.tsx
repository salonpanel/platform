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
  // 1. Llamar cookies() directamente (sin await en Next.js 16)
  // 2. Pasar una función que retorna el cookieStore a createServerComponentClient
  const cookieStore = cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore,
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
