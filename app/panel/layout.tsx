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
  
  // Verificar sesión en el servidor usando getUser (más confiable que getSession)
  const { data: { user }, error } = await supabase.auth.getUser();

  // Si no hay usuario o hay error, redirigir a login
  if (!user || error) {
    // Redirigir a login con la ruta por defecto del panel
    // El middleware ya maneja las rutas específicas
    redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
  }

  // Si hay usuario, renderizar el layout cliente
  return <PanelLayoutClient>{children}</PanelLayoutClient>;
}
