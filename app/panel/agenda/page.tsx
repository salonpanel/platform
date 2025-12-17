import { cookies } from "next/headers";
import { Suspense } from "react";
import { AgendaSkeleton } from "@/components/skeletons/AgendaSkeleton";
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
        setAll() { },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    console.error("[Agenda] Auth failed:", authError);
    return { error: "No authenticated user found" };
  }

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

  if (!targetTenantId) {
    return { error: "No membership found for this user" };
  }

  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("id, name, timezone")
    .eq("id", targetTenantId)
    .maybeSingle();

  if (!tenant) {
    return { error: "Tenant record not found" };
  }

  const range = getAgendaRange(selectedDate, viewMode);

  try {
    const data = await fetchAgendaDataset(supabase, tenant, range, { includeUserRole: true, userId: user.id });
    return { data };
  } catch (error: any) {
    console.error("[AgendaPage] fetchAgendaDataset failed:", error);
    return { error: error.message || "Error fetching agenda data" };
  }
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const impersonateOrgId = (resolvedSearchParams?.impersonate as string) || null;
  const initialDate = (resolvedSearchParams?.date as string) || new Date().toISOString().slice(0, 10);
  const initialViewMode = ((resolvedSearchParams?.view as ViewMode) || "day") as ViewMode;

  const result = await getInitialAgendaData(impersonateOrgId, initialDate, initialViewMode);

  return (
    <Suspense fallback={<AgendaSkeleton />}>
      <AgendaPageClient
        initialData={result?.data || null}
        error={result?.error || null}
        impersonateOrgId={impersonateOrgId}
        initialDate={initialDate}
        initialViewMode={initialViewMode}
      />
    </Suspense>
  );
}
