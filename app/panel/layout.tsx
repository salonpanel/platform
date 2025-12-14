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

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Try a lightweight server-side user/tenant lookup when cookies are present.
  // This avoids an extra client round-trip on the very first load after login
  // while still keeping the client-side auth verification as a safe fallback.
  try {
    const supabase = await createClientForServer();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      redirect("/login?redirect=/panel");
    }

    const user = session.user;

    if (!user) {
      return (
        <BookingModalProvider>
          <PanelLayoutClient initialAuthStatus={"UNKNOWN"}>{children}</PanelLayoutClient>
          <BookingCreateModal />
          <BookingDetailModal />
        </BookingModalProvider>
      );
    }

    const sb = supabaseServer();

    // Fetch membership and tenant in parallel for better performance
    const [membershipResult] = await Promise.all([
      sb
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .maybeSingle()
    ]);

    const { data: membership } = membershipResult;

    if (!membership?.tenant_id) {
      // Authenticated but without a tenant membership yet
      return (
        <BookingModalProvider>
          <PanelLayoutClient initialAuthStatus={"AUTHENTICATED"}>{children}</PanelLayoutClient>
          <BookingCreateModal />
          <BookingDetailModal />
        </BookingModalProvider>
      );
    }

    // Now fetch tenant and permissions in parallel
    const [tenantResult, permissionsResult] = await Promise.all([
      sb
        .from("tenants")
        .select("id, name, timezone, slug")
        .eq("id", membership.tenant_id)
        .maybeSingle(),
      sb
        .rpc("get_user_role_and_permissions", { p_user_id: user.id, p_tenant_id: membership.tenant_id })
        .single()
    ]);

    const { data: tenant } = tenantResult;

    if (!tenant) {
      return (
        <BookingModalProvider>
          <PanelLayoutClient initialAuthStatus={"AUTHENTICATED"}>{children}</PanelLayoutClient>
          <BookingCreateModal />
          <BookingDetailModal />
        </BookingModalProvider>
      );
    }

    const initialTenant = {
      id: tenant.id,
      name: tenant.name || "",
      slug: tenant.slug || "",
      timezone: tenant.timezone || "Europe/Madrid",
    };

    // Extract permissions from parallel fetch
    let initialPermissions: any = null;
    let initialRole: string | null = null;
    const { data: roleAndPermissions, error: rpError } = permissionsResult;

    if (!rpError && roleAndPermissions) {
      const rp = roleAndPermissions as any;
      initialRole = rp.role ?? null;
      initialPermissions = rp.permissions ?? null;
    }

    return (
      <BookingModalProvider>
        <PanelLayoutClient
          initialAuthStatus={"AUTHENTICATED"}
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
    // On any error, fallback to previous behavior (all client-side)
    return (
      <BookingModalProvider>
        <PanelLayoutClient>{children}</PanelLayoutClient>
        <BookingCreateModal />
        <BookingDetailModal />
      </BookingModalProvider>
    );
  }
}
