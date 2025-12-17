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
import { getTenantContextSafe } from "@/lib/data/tenant-context";

// Helper to map safe context status to client bootstrap state
function mapStatusToClientState(status: "OK" | "NO_TENANT_SELECTED" | "NO_MEMBERSHIP" | "ERROR"): "AUTHENTICATED" | "NO_TENANT_SELECTED" | "NO_MEMBERSHIP" {
  switch (status) {
    case "OK": return "AUTHENTICATED";
    case "NO_TENANT_SELECTED": return "NO_TENANT_SELECTED";
    case "NO_MEMBERSHIP": return "NO_MEMBERSHIP";
    case "ERROR": return "NO_TENANT_SELECTED"; // Fallback to safe implementation for errors
    default: return "AUTHENTICATED";
  }
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // 1. Auth Check (Server Side) - ALLOWED REDIRECT (Security)
  // We trust Middleware, but we need the User ID.
  const supabase = await createClientForServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.log("[PanelLayout] Auth check failed (getUser):", authError?.message || "No user found");
    redirect("/login?redirect=/panel");
  }

  // 2. Data Context (Pure Data - NO REDIRECTS)
  const cookieStore = await cookies();
  const sb = supabaseServer();
  const lastTenantId = cookieStore.get("last_tenant_id")?.value;

  const context = await getTenantContextSafe(sb, user.id, lastTenantId);
  const clientBootstrapState = mapStatusToClientState(context.status);

  // 3. Error Handling - Render Error UI without redirecting
  if (context.status === "ERROR") {
    console.error("[PanelLayout] Context Error:", context.error);
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
                  Error de Sistema
                </h2>
              </div>
              <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                No pudimos cargar tu información de negocio.
              </p>
              <div className="bg-slate-950 rounded-lg p-3 mb-6 border border-slate-800 overflow-x-auto">
                <code className="text-xs text-red-400 font-mono">
                  {context.error || "Unknown Error"}
                </code>
              </div>
              <div className="flex gap-3">
                <a href="/panel" className="flex-1 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors text-center">Reintentar</a>
                <a href="/login" className="px-4 py-2 bg-transparent text-slate-500 text-sm font-medium hover:text-white transition-colors">Salir</a>
              </div>
            </div>
          </div>
        </PanelLayoutClient>
      </BookingModalProvider>
    );
  }

  // 4. Success Render
  return (
    <BookingModalProvider>
      <PanelLayoutClient
        initialAuthStatus="AUTHENTICATED"
        initialBootstrapState={clientBootstrapState}
        initialTenant={context.tenant}
        initialPermissions={context.permissions}
        initialRole={context.role}
      >
        {children}
      </PanelLayoutClient>
      <BookingCreateModal />
      <BookingDetailModal />
    </BookingModalProvider>
  );
}
