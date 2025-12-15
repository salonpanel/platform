/**
 * Server-side layout para el panel
 * IMPORTANTE: La verificación de sesión se maneja en el Client Component (layout-client.tsx)
 * para evitar race conditions con cookies que se establecen en el API route
 */
import { ReactNode } from "react";
import PanelLayoutClient from "./layout-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";
import { BookingModalProvider } from "@/contexts/BookingModalContext";
import { BookingCreateModal } from "@/modules/bookings/BookingCreateModal";
import { BookingDetailModal } from "@/modules/bookings/BookingDetailModal";
import { getTenantContext } from "@/lib/data/tenant-context";

// ... (imports)

export default async function PanelLayout({ children }: { children: ReactNode }) {
  console.log("[PanelLayout Debug] START");
  // Server-Side Authority for Session & Tenant Resolution
  try {
    const supabase = await createClientForServer();
    const cookieStore = await cookies();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[PanelLayout] Auth check failed (getUser):", authError?.message || "No user found");
      redirect("/login?redirect=/panel");
    }

    console.log("[PanelLayout Debug] User verified via getUser:", user.id);

    const sb = supabaseServer();
    const lastTenantId = cookieStore.get("last_tenant_id")?.value;

    console.log("[PanelLayout Debug] Fetching context...");

    // ----------------------------------------------------------------------
    // PHASE 15.1: USE SHARED CONTEXT (React Cache)
    // ----------------------------------------------------------------------
    const { bootstrapState, tenant: initialTenant, role: initialRole, permissions: initialPermissions } =
      await getTenantContext(sb, user.id, lastTenantId);

    // ----------------------------------------------------------------------
    console.log("[PanelLayout] Final State:", {
      bootstrapState,
      hasInitialTenant: !!initialTenant,
      tenantId: initialTenant?.id
    });

    console.log("[PanelLayout Debug] Returning JSX - START Render");

    // 4. Passing State to Client
    // Client Layout will enforce routing based on `bootstrapState`

    return (
      <BookingModalProvider>
        <PanelLayoutClient
          initialAuthStatus="AUTHENTICATED"
          initialBootstrapState={bootstrapState}
          initialTenant={initialTenant}
          initialPermissions={initialPermissions}
          initialRole={initialRole}
        >
          {children}
        </PanelLayoutClient>
        <BookingCreateModal />
        <BookingDetailModal />
      </BookingModalProvider>
    );

  } catch (err: any) {
    // CRITICAL: Rethrow redirect errors so Next.js can handle them
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }

    // Error Barrier for actual errors
    console.error("[PanelLayout] Error cargando contexto:", err);

    // Devolvemos el cliente en un estado de error seguro, pero autenticado.
    // ESTO ROMPE EL BUCLE INFINITO DE LOGIN
    return (
      <BookingModalProvider>
        <PanelLayoutClient
          initialAuthStatus="AUTHENTICATED"
          initialBootstrapState="NO_TENANT_SELECTED" // Force safe mode
          initialTenant={null}
        >
          <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
            <div className="max-w-md w-full bg-slate-900 border border-red-900/50 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h2 className="text-lg font-bold text-white">
                  Error cargando el panel
                </h2>
              </div>

              <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                Hemos detectado un problema al cargar tus datos. Tu sesión es válida, pero no pudimos recuperar la información de tu cuenta.
              </p>

              <div className="bg-slate-950 rounded-lg p-3 mb-6 border border-slate-800 overflow-x-auto">
                <code className="text-xs text-red-400 font-mono">
                  {err.message || "Unknown Error"}
                </code>
              </div>

              <div className="flex gap-3">
                <a
                  href="/panel"
                  className="flex-1 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors text-center"
                >
                  Reintentar
                </a>
                <a
                  href="/login"
                  className="px-4 py-2 bg-transparent text-slate-500 text-sm font-medium hover:text-white transition-colors"
                >
                  Cerrar sesión
                </a>
              </div>
            </div>
          </div>
        </PanelLayoutClient>
      </BookingModalProvider>
    );
  }
}
