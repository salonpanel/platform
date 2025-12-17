"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";

export function useCurrentTenantWithImpersonation() {
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState("Europe/Madrid");
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const impersonateOrgId = useMemo(
    () => searchParams?.get("impersonate") || null,
    [searchParams?.toString()]
  );

  useEffect(() => {
    let abort = false;

    const fetchTenant = async () => {
      setLoadingTenant(true);
      try {
        const { tenant } = await getCurrentTenant(impersonateOrgId);
        if (abort) return;

        if (tenant) {
          setTenantId(tenant.id);
          setTenantTimezone(tenant.timezone || "Europe/Madrid");
          setTenantName(tenant.name);
          setTenantError(null);
        } else {
          setTenantId(null);
          setTenantError("No tienes acceso a ninguna barbería");
        }
      } catch (err: any) {
        if (abort) return;
        setTenantId(null);
        setTenantError(err?.message || "Error al cargar información");
      } finally {
        if (!abort) {
          setLoadingTenant(false);
        }
      }
    };

    fetchTenant();

    return () => {
      abort = true;
    };
  }, [impersonateOrgId]);

  return {
    tenantId,
    tenantTimezone,
    tenantName,
    loadingTenant,
    tenantError,
    impersonateOrgId,
  };
}





