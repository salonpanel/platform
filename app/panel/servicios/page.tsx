"use client";

import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass";
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
      <GlassCard className="border-red-500/50 bg-red-500/10 p-6 m-4">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error en servicios</h3>
        <p className="text-sm text-red-300">{error.message || "Error al cargar servicios"}</p>
      </GlassCard>
    );
  }

  if (!tenantId) {
    return (
      <GlassCard className="border-red-500/50 bg-red-500/10 p-6 m-4">
        <h3 className="text-lg font-semibold text-red-400 mb-2">No se encontró ninguna barbería</h3>
        <p className="text-sm text-red-300">No tienes acceso a ninguna organización. Solicita acceso a un tenant para continuar.</p>
      </GlassCard>
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
