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
    console.log("[PanelLayout Debug] Fetching memberships...");

    // ----------------------------------------------------------------------
    // PHASE 14.2: DETERMINISTIC STATE RESOLUTION
    // ----------------------------------------------------------------------

    // 1. Fetch memberships to determine access level
    const { data: memberships, error: membershipError } = await sb
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);

    // Default State: Assume OK unless proven otherwise
    let bootstrapState: "NO_MEMBERSHIP" | "NO_TENANT_SELECTED" | "AUTHENTICATED" = "AUTHENTICATED";
    let activeTenantId: string | null = null;

    // CASE 0: No Memberships -> Access Denied
    if (membershipError || !memberships || memberships.length === 0) {
      console.log("[PanelLayout] Deterministic State: NO_MEMBERSHIP");
      bootstrapState = "NO_MEMBERSHIP";
      // We pass this state to Client Layout. It renders "Access Denied".
    } else {
      // CASE 1-N: User has memberships. Resolve Active Tenant.
      const lastTenantId = cookieStore.get("last_tenant_id")?.value;

      // Strategy:
      // A) Single Tenant -> Always wins.
      // B) Multi Tenant + Valid Cookie -> Cookie wins.
      // C) Multi Tenant + No/Invalid Cookie -> NO_TENANT_SELECTED (Force Picker).

      if (memberships.length === 1) {
        activeTenantId = memberships[0].tenant_id;
      } else {
        // Multi-tenant
        const isValidCookie = lastTenantId && memberships.some(m => m.tenant_id === lastTenantId);

        if (isValidCookie) {
          activeTenantId = lastTenantId;
        } else {
          // Ambiguity -> Explicitly ask user to choose
          console.log("[PanelLayout] Deterministic State: NO_TENANT_SELECTED (Multi-tenant ambiguity)");
          bootstrapState = "NO_TENANT_SELECTED";
        }
      }
    }

    // 2. Fetch Tenant Details ONLY if we have an Active Tenant ID
    let initialTenant = null;
    let initialPermissions: any = null;
    let initialRole: string | null = null;

    if (activeTenantId) {
      const { data: tenant } = await sb
        .from("tenants")
        .select("id, name, timezone, slug")
        .eq("id", activeTenantId)
        .maybeSingle();

      if (tenant) {
        initialTenant = {
          id: tenant.id,
          name: tenant.name || "",
          slug: tenant.slug || "",
          timezone: tenant.timezone || "Europe/Madrid",
        };

        // Fetch Permissions
        const { data: rp } = await sb
          .rpc("get_user_role_and_permissions", {
            p_user_id: user.id,
            p_tenant_id: activeTenantId
          })
          .maybeSingle();

        if (rp) {
          const permissionsData = rp as any;
          initialRole = permissionsData.role ?? null;
          initialPermissions = permissionsData.permissions ?? null;
        }

      } else {
        // Critical Conflict: Membership points to deleted tenant?
        // Fallback to NO_TENANT_SELECTED to force a fresh choice (or empty list if all bad)
        console.warn(`[PanelLayout] Critical: Tenant ${activeTenantId} not found but membership exists.`);
        bootstrapState = "NO_TENANT_SELECTED";
      }
    }

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
