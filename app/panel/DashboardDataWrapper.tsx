import { supabaseServer } from "@/lib/supabase";
import { fetchDashboardDataset, DashboardDataset } from "@/lib/dashboard-data";
import { createClientForServer } from "@/lib/supabase/server-client";
import PanelHomeClient from "./PanelHomeClient";
import { getTenantContextSafe } from "@/lib/data/tenant-context";
import { cookies } from "next/headers";

type Props = {
    impersonateOrgId: string | null;
    resolvedSearchParams?: any;
};

export default async function DashboardDataWrapper({ impersonateOrgId }: Props) {
    const cookieStore = await cookies();
    const supabase = await createClientForServer();

    // 1. Get User Session (Context Layer) - reused via cache if called in layout
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const user = session.user;
    const sb = supabaseServer(); // Service Role for data fetching

    // 2. Resolve Target Tenant
    // Default: Use Context (Layer 1)
    // Override: If impersonating (Admin only)

    let targetTenantId: string | null = null;
    const lastTenantId = cookieStore.get("last_tenant_id")?.value;

    if (impersonateOrgId) {
        const { data: isAdmin } = await sb.rpc("check_platform_admin", {
            p_user_id: user.id,
        });
        if (isAdmin) {
            targetTenantId = impersonateOrgId;
            console.log(`[DashboardWrapper] Admin impersonating tenant: ${targetTenantId}`);
        }
    }

    // If not impersonating, get from Context
    if (!targetTenantId) {
        const context = await getTenantContextSafe(sb, user.id, lastTenantId);
        if (context.status === "OK" && context.tenant) {
            targetTenantId = context.tenant.id;
        }
    }

    if (!targetTenantId) {
        // Should not happen if Layout did its job, but safe formatting
        return <PanelHomeClient initialData={null} impersonateOrgId={null} />;
    }

    // 3. Fetch Tenant Details for the Target (Double check for impersonation case)
    const { data: tenant } = await sb
        .from("tenants")
        .select("id, name, timezone")
        .eq("id", targetTenantId)
        .single();

    if (!tenant) return null;

    // 4. Fetch Dashboard Data (Layer 2)
    console.log(`[DashboardWrapper] Fetching data for tenant: ${tenant.id}`);
    const dashboardData = await fetchDashboardDataset(sb, {
        id: tenant.id,
        name: tenant.name,
        timezone: tenant.timezone
    });

    return (
        <PanelHomeClient
            initialData={dashboardData}
            impersonateOrgId={impersonateOrgId}
        />
    );
}
