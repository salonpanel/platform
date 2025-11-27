import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import PanelHomeClient from "./PanelHomeClient";
import { supabaseServer } from "@/lib/supabase";
import { fetchDashboardDataset, DashboardDataset } from "@/lib/dashboard-data";

async function getDashboardInitialData(
  impersonateOrgId: string | null
): Promise<DashboardDataset | null> {
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
          // Lectura únicamente
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const sb = supabaseServer();

  // Verificar si es admin de plataforma para permitir impersonación
  let targetTenantId: string | null = null;
  let tenantData: any = null;

  if (impersonateOrgId) {
    const { data: isAdmin } = await sb.rpc("check_platform_admin", {
      p_user_id: user.id,
    });
    if (isAdmin) {
      targetTenantId = impersonateOrgId;
    }
  }

  if (!targetTenantId) {
    const { data: membership } = await sb
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    targetTenantId = membership?.tenant_id || null;
  }

  if (!targetTenantId) return null;

  // Fetch tenant and dashboard data in parallel
  const [tenantResult, dashboardResult] = await Promise.all([
    sb
      .from("tenants")
      .select("id, name, timezone")
      .eq("id", targetTenantId)
      .maybeSingle(),
    // We'll fetch dashboard data after getting tenant info
    Promise.resolve(null)
  ]);

  const { data: tenant } = tenantResult;

  if (!tenant) return null;

  // Now fetch dashboard data with complete tenant info
  const dashboardResultFinal = await fetchDashboardDataset(sb, {
    id: tenant.id,
    name: tenant.name,
    timezone: tenant.timezone
  });

  if (!dashboardResultFinal) return null;

  // Return the dashboard data as-is since it already includes the tenant
  return dashboardResultFinal;
}

export default async function PanelHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const impersonateOrgId = (resolvedSearchParams?.impersonate as string) || null;
  const initialData = await getDashboardInitialData(impersonateOrgId);

  return <PanelHomeClient initialData={initialData} impersonateOrgId={impersonateOrgId} />;
}
