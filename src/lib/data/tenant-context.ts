import { cache } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

// Define the shape of our context
export type TenantContext = {
    bootstrapState: "NO_MEMBERSHIP" | "NO_TENANT_SELECTED" | "AUTHENTICATED";
    tenant: {
        id: string;
        name: string;
        slug: string;
        timezone: string;
    } | null;
    role: string | null;
    permissions: any | null;
};

// Cached function to resolve tenant
// We pass simple arguments to be cache-friendly (instances might break cache key comparison if not careful, but React.cache handles reference equality)
// Better to pass userId and use a fresh client or pass the client if it's per-request.
// In Next.js, the per-request cache is valid.
export const getTenantContext = cache(async (
    supabase: SupabaseClient,
    userId: string,
    lastTenantId: string | undefined
): Promise<TenantContext> => {
    console.log("[TenantContext] Resolving context for user:", userId);

    // 1. Fetch Memberships
    const { data: memberships, error: membershipError } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(50);

    let bootstrapState: "NO_MEMBERSHIP" | "NO_TENANT_SELECTED" | "AUTHENTICATED" = "AUTHENTICATED";
    let activeTenantId: string | null = null;
    let tenant = null;
    let role = null;
    let permissions = null;

    // CASE 0: No Memberships
    if (membershipError || !memberships || memberships.length === 0) {
        console.log("[TenantContext] No memberships found.");
        return { bootstrapState: "NO_MEMBERSHIP", tenant: null, role: null, permissions: null };
    }

    // CASE 1-N: Resolve Active Tenant
    if (memberships.length === 1) {
        activeTenantId = memberships[0].tenant_id;
    } else {
        // Multi-tenant
        const isValidCookie = lastTenantId && memberships.some(m => m.tenant_id === lastTenantId);
        if (isValidCookie) {
            activeTenantId = lastTenantId as string;
        } else {
            console.log("[TenantContext] Multi-tenant ambiguity -> NO_TENANT_SELECTED");
            return { bootstrapState: "NO_TENANT_SELECTED", tenant: null, role: null, permissions: null };
        }
    }

    // 2. Fetch Tenant Details + Permissions
    if (activeTenantId) {
        const { data: tenantData } = await supabase
            .from("tenants")
            .select("id, name, timezone, slug")
            .eq("id", activeTenantId)
            .maybeSingle();

        if (tenantData) {
            tenant = {
                id: tenantData.id,
                name: tenantData.name || "",
                slug: tenantData.slug || "",
                timezone: tenantData.timezone || "Europe/Madrid",
            };

            const { data: rp } = await supabase
                .rpc("get_user_role_and_permissions", {
                    p_user_id: userId,
                    p_tenant_id: activeTenantId
                })
                .maybeSingle();

            if (rp) {
                const permissionsData = rp as any;
                role = permissionsData.role ?? null;
                permissions = permissionsData.permissions ?? null;
            }
        } else {
            console.warn(`[TenantContext] Critical: Tenant ${activeTenantId} not found.`);
            return { bootstrapState: "NO_TENANT_SELECTED", tenant: null, role: null, permissions: null };
        }
    }

    return {
        bootstrapState,
        tenant,
        role,
        permissions
    };
});
