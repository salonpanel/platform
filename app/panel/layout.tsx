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
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.log("[PanelLayout] No session, redirecting to login");
      redirect("/login?redirect=/panel");
    }

    const user = session.user;
    console.log("[PanelLayout Debug] Session valid. User:", user.id);

    if (!user) {
      redirect("/login");
    }

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
    console.error("[PanelLayout] Error:", err);
    // Redirect to login on critical failure
    redirect("/login");
  }
}
