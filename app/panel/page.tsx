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

  const { data: tenant } = await sb
    .from("tenants")
    .select("id, name, timezone")
    .eq("id", targetTenantId)
    .maybeSingle();

  if (!tenant) return null;

  return fetchDashboardDataset(sb, tenant);
}

export default async function PanelHomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const impersonateOrgId = (searchParams?.impersonate as string) || null;
  const initialData = await getDashboardInitialData(impersonateOrgId);

  return <PanelHomeClient initialData={initialData} impersonateOrgId={impersonateOrgId} />;
}
