/**
 * Server-side layout para el panel
 * IMPORTANTE: La verificación de sesión se maneja en el Client Component (layout-client.tsx)
 * para evitar race conditions con cookies que se establecen en el API route
 */
import { ReactNode } from "react";
import PanelLayoutClient from "./layout-client";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Try a lightweight server-side user/tenant lookup when cookies are present.
  // This avoids an extra client round-trip on the very first load after login
  // while still keeping the client-side auth verification as a safe fallback.
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            /* lectura únicamente */
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return <PanelLayoutClient initialAuthStatus={"UNKNOWN"}>{children}</PanelLayoutClient>;
    }

    const sb = supabaseServer();
    const { data: membership } = await sb
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!membership?.tenant_id) {
      // Authenticated but without a tenant membership yet
      return <PanelLayoutClient initialAuthStatus={"AUTHENTICATED"}>{children}</PanelLayoutClient>;
    }

    const { data: tenant } = await sb
      .from("tenants")
      .select("id, name, timezone, slug")
      .eq("id", membership.tenant_id)
      .maybeSingle();

    if (!tenant) {
      return <PanelLayoutClient initialAuthStatus={"AUTHENTICATED"}>{children}</PanelLayoutClient>;
    }

    const initialTenant = {
      id: tenant.id,
      name: tenant.name || "",
      slug: tenant.slug || "",
      timezone: tenant.timezone || "Europe/Madrid",
    };

    // Try to fetch role & permissions for the current user + tenant to avoid an extra RPC on first load
    let initialPermissions: any = null;
    let initialRole: string | null = null;
    try {
      const { data: roleAndPermissions, error: rpError } = await sb
        .rpc("get_user_role_and_permissions", { p_user_id: user.id, p_tenant_id: initialTenant.id })
        .single();

      if (!rpError && roleAndPermissions) {
        const rp = roleAndPermissions as any;
        initialRole = rp.role ?? null;
        initialPermissions = rp.permissions ?? null;
      }
    } catch (e) {
      // ignore
    }

    return (
      <PanelLayoutClient
        initialAuthStatus={"AUTHENTICATED"}
        initialTenant={initialTenant}
        initialPermissions={initialPermissions}
        initialRole={initialRole}
      >
        {children}
      </PanelLayoutClient>
    );
  } catch (err) {
    // On any error, fallback to previous behavior (all client-side)
    return <PanelLayoutClient>{children}</PanelLayoutClient>;
  }
}
