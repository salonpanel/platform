"use client";

import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import type { Service } from "@/types/services";
import { ServiciosClient } from "./ServiciosClient";
import { useServicesPageData } from "@/hooks/useOptimizedData";

export default function ServiciosPage() {
  const searchParams = useSearchParams();

  const impersonateOrgId = searchParams?.get("impersonate") || null;

  // Hook optimizado: obtiene tenant + servicios en UNA llamada con caché
  const { data: pageData, isLoading, error } = useServicesPageData(impersonateOrgId);

  // Extraer datos del hook
  const tenantId = pageData?.tenant?.id || null;
  const services = pageData?.services || [];

  if (isLoading) {
    return <div className="p-4">Cargando servicios...</div>;
  }

  if (error) {
    return (
      <Alert type="error" title="Error en servicios">
        {error.message || "Error al cargar servicios"}
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
    <ProtectedRoute requiredPermission="servicios">
      <ServiciosClient
        tenantId={tenantId}
        initialServices={services}
      />
    </ProtectedRoute>
  );
}
