"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import type { Service } from "@/types/services";
import { ServiciosClient } from "./ServiciosClient";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getCurrentTenant } from "@/lib/panel-tenant";

export default function ServiciosPage() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [initialServices, setInitialServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const impersonateOrgId = searchParams?.get("impersonate") || null;

        // 1) Obtener tenant actual (igual que en Agenda)
        const { tenant, role, status } = await getCurrentTenant(impersonateOrgId);

        if (!tenant) {
          setError(
            status === "UNAUTHENTICATED"
              ? "Tu sesión no está activa. Vuelve a iniciar sesión."
              : "No tienes acceso a ninguna barbería"
          );
          setLoading(false);
          return;
        }

        setTenantId(tenant.id);

        // 2) Cargar servicios del tenant
        const { data: services, error: servicesError } = await supabase
          .from("services")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("name");

        if (servicesError) {
          console.error("Error al cargar servicios:", servicesError);
          setError("Error al cargar servicios");
          setLoading(false);
          return;
        }

        setInitialServices((services ?? []) as Service[]);
        setLoading(false);
      } catch (err) {
        console.error("[Servicios] Error al cargar datos iniciales:", err);
        setError("Error inesperado al cargar servicios");
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.toString()]);

  if (loading) {
    return <div className="p-4">Cargando servicios...</div>;
  }

  if (error) {
    return (
      <Alert type="error" title="Error en servicios">
        {error}
      </Alert>
    );
  }

  if (!tenantId) {
    return (
      <Alert type="error" title="No se encontró ninguna barbería">
        No tienes acceso a ninguna organización. Solicita acceso a un tenant para continuar.
      </Alert>
    );
  }

  return (
    <ServiciosClient
      tenantId={tenantId}
      initialServices={initialServices}
    />
  );
}
