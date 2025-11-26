import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase";
import { fetchAgendaDataset, getAgendaRange } from "@/lib/agenda-data";
import AgendaPageClient from "./AgendaPageClient";
import { ViewMode } from "@/types/agenda";

async function getInitialAgendaData(impersonateOrgId: string | null, selectedDate: string, viewMode: ViewMode) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const serviceClient = supabaseServer();
  let targetTenantId: string | null = null;

  if (impersonateOrgId) {
    const { data: isAdmin } = await serviceClient.rpc("check_platform_admin", {
      p_user_id: user.id,
    });

    if (isAdmin) {
      targetTenantId = impersonateOrgId;
    }
  }

  if (!targetTenantId) {
    const { data: membership } = await serviceClient
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    targetTenantId = membership?.tenant_id || null;
  }

  if (!targetTenantId) return null;

  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("id, name, timezone")
    .eq("id", targetTenantId)
    .maybeSingle();

  if (!tenant) return null;

  const range = getAgendaRange(selectedDate, viewMode);

  return fetchAgendaDataset(serviceClient, tenant, range, { includeUserRole: true, userId: user.id });
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const impersonateOrgId = (searchParams?.impersonate as string) || null;
  const initialDate = (searchParams?.date as string) || new Date().toISOString().slice(0, 10);
  const initialViewMode = ((searchParams?.view as ViewMode) || "day") as ViewMode;

  const initialData = await getInitialAgendaData(impersonateOrgId, initialDate, initialViewMode);

  return (
    <AgendaPageClient
      initialData={initialData}
      impersonateOrgId={impersonateOrgId}
      initialDate={initialDate}
      initialViewMode={initialViewMode}
    />
  );
}
