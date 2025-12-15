import { cache } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

// Define the shape of our context
export type TenantContext = {
    status: "OK" | "NO_TENANT_SELECTED" | "NO_MEMBERSHIP" | "ERROR";
    tenant: {
        id: string;
        name: string;
        slug: string;
        timezone: string;
    } | null;
    role: string | null;
    permissions: any | null;
    error?: string;
};

// Internal worker function
async function resolveContext(
    supabase: SupabaseClient,
    userId: string,
    lastTenantId: string | undefined
): Promise<TenantContext> {
    // 1. Fetch Memberships
    const { data: memberships, error: membershipError } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(50);

    if (membershipError) {
        console.error("[TenantContext] Membership error:", membershipError);
        return { status: "ERROR", tenant: null, role: null, permissions: null, error: membershipError.message };
    }

    // CASE 0: No Memberships
    if (!memberships || memberships.length === 0) {
        return { status: "NO_MEMBERSHIP", tenant: null, role: null, permissions: null };
    }

    let activeTenantId: string | null = null;

    // CASE 1-N: Resolve Active Tenant
    if (memberships.length === 1) {
        activeTenantId = memberships[0].tenant_id;
    } else {
        // Multi-tenant
        // Check if lastTenantId is valid for this user
        const isValidCookie = lastTenantId && memberships.some(m => m.tenant_id === lastTenantId);
        if (isValidCookie) {
            activeTenantId = lastTenantId as string;
        } else {
            // Ambiguity -> Let client handle selection
            return { status: "NO_TENANT_SELECTED", tenant: null, role: null, permissions: null };
        }
    }

    // 2. Fetch Tenant Details + Permissions
    if (activeTenantId) {
        const { data: tenantData, error: tenantError } = await supabase
            .from("tenants")
            .select("id, name, timezone, slug")
            .eq("id", activeTenantId)
            .maybeSingle();

        if (tenantError) {
            console.error("[TenantContext] Tenant fetch error:", tenantError);
            return { status: "ERROR", tenant: null, role: null, permissions: null, error: tenantError.message };
        }

        if (tenantData) {
            const { data: rp, error: rpError } = await supabase
                .rpc("get_user_role_and_permissions", {
                    p_user_id: userId,
                    p_tenant_id: activeTenantId
                })
                .maybeSingle();

            if (rpError) {
                console.error("[TenantContext] Permissions fetch error:", rpError);
                // We don't block access if permissions fail, but maybe we should? 
                // For now, return what we have or ERROR? 
                // Safety: Return ERROR to avoid partial state.
                return { status: "ERROR", tenant: null, role: null, permissions: null, error: rpError.message };
            }

            let role = null;
            let permissions = null;

            if (rp) {
                const permissionsData = rp as any;
                role = permissionsData.role ?? null;
                permissions = permissionsData.permissions ?? null;
            }

            return {
                status: "OK",
                tenant: {
                    id: tenantData.id,
                    name: tenantData.name || "",
                    slug: tenantData.slug || "",
                    timezone: tenantData.timezone || "Europe/Madrid",
                },
                role,
                permissions
            };
        } else {
            console.warn(`[TenantContext] Critical: Tenant ${activeTenantId} not found.`);
            // membership exists but tenant doesn't? Data inconsistency.
            return { status: "ERROR", tenant: null, role: null, permissions: null, error: "Tenant not found" };
        }
    }

    return { status: "NO_TENANT_SELECTED", tenant: null, role: null, permissions: null };
}

// Cached Safe Wrapper
export const getTenantContextSafe = cache(async (
    supabase: SupabaseClient,
    userId: string,
    lastTenantId: string | undefined
): Promise<TenantContext> => {
    try {
        return await resolveContext(supabase, userId, lastTenantId);
    } catch (err: any) {
        console.error("[TenantContext] Unexpected crash:", err);
        return {
            status: "ERROR",
            tenant: null,
            role: null,
            permissions: null,
            error: err.message || "Unknown context error"
        };
    }
});
