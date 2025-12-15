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

    // 1. Fetch ALL Memberships (Limit 50 to be safe)
    const { data: memberships, error: membershipError } = await sb
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }) // Default order
      .limit(50);

    console.log("[PanelLayout] Memberships found:", memberships?.length);

    // Default State
    let authStatus = "AUTHENTICATED";
    let bootstrapState: "NO_MEMBERSHIP" | "NO_TENANT_SELECTED" | "AUTHENTICATED" = "AUTHENTICATED";
    let activeTenantId: string | null = null;

    if (membershipError || !memberships || memberships.length === 0) {
      // CASE 0: No Memberships -> Access Denied / Onboarding
      console.log("[PanelLayout] No memberships found for user");
      bootstrapState = "NO_MEMBERSHIP";
      // We do NOT redirect here to avoid loops. We let Client Layout handle it.
    } else {
      // 2. Resolve Active Tenant
      const lastTenantId = cookieStore.get("last_tenant_id")?.value;
      console.log("[PanelLayout] Resolving tenant. LastTenantId:", lastTenantId);

      // CASE 1: Single Tenant
      if (memberships.length === 1) {
        activeTenantId = memberships[0].tenant_id;
        console.log("[PanelLayout] Single tenant detected:", activeTenantId);
      }
      // CASE N: Multi Tenant
      else {
        // If we have a preference cookie AND user is still a member of it
        if (lastTenantId && memberships.some(m => m.tenant_id === lastTenantId)) {
          activeTenantId = lastTenantId;
          console.log("[PanelLayout] Multi-tenant using cookie preference:", activeTenantId);
        } else {
          // No preference or invalid -> Force Selection
          console.log("[PanelLayout] Multi-tenant NO preference (or invalid). Forcing selection.");
          bootstrapState = "NO_TENANT_SELECTED";
          // activeTenantId remains null
        }
      }
    }

    // 3. If we resolved a tenant, Fetch Tenant Details & Permissions (Parallel)
    let initialTenant = null;
    let initialPermissions: any = null;
    let initialRole: string | null = null;

    if (activeTenantId) {
      const [tenantResult, permissionsResult] = await Promise.all([
        sb
          .from("tenants")
          .select("id, name, timezone, slug")
          .eq("id", activeTenantId)
          .maybeSingle(),
        sb
          .rpc("get_user_role_and_permissions", { p_user_id: user.id, p_tenant_id: activeTenantId })
          .single()
      ]);

      const { data: tenant } = tenantResult;

      if (tenant) {
        initialTenant = {
          id: tenant.id,
          name: tenant.name || "",
          slug: tenant.slug || "",
          timezone: tenant.timezone || "Europe/Madrid",
        };
      } else {
        // Edge case: Membership points to non-existent tenant -> Treat as No Membership? Or Error?
        // For safety, fallback to selector if multi-tenant, or error if single.
        // Simplified: Treat as Error or No Tenant Selected
        console.error("Tenant not found for ID:", activeTenantId);
        bootstrapState = "NO_TENANT_SELECTED"; // Fallback to selector/list
      }

      const { data: roleAndPermissions, error: rpError } = permissionsResult;
      if (!rpError && roleAndPermissions) {
        const rp = roleAndPermissions as any;
        initialRole = rp.role ?? null;
        initialPermissions = rp.permissions ?? null;
      }
    }

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
          initialAuthStatus={authStatus as any}
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

  } catch (err) {
    // Error Barrier
    console.error("[PanelLayout] Error:", err);
    // Redirect to login on critical failure
    redirect("/login");
  }
}
