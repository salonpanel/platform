"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { getCurrentTenant } from "@/lib/panel-tenant";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: keyof ReturnType<typeof useUserPermissions>["permissions"];
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { permissions, role, loading } = useUserPermissions(tenantId);

  useEffect(() => {
    getCurrentTenant().then((result) => {
      if (result.tenant) {
        setTenantId(result.tenant.id);
      }
    });
  }, []);

  useEffect(() => {
    // Esperar a que cargue
    if (loading || !tenantId) return;

    // Si no hay permiso requerido, permitir acceso
    if (!requiredPermission) return;

    // Owners y admins tienen acceso completo
    if (role === "owner" || role === "admin") return;

    // Verificar si tiene el permiso específico
    if (!permissions[requiredPermission]) {
      console.warn(`Acceso denegado a ${pathname}: falta permiso ${requiredPermission}`);
      router.push("/panel/sin-permisos");
    }
  }, [loading, role, permissions, requiredPermission, pathname, router, tenantId]);

  // Mientras carga, mostrar nada o un loader (evitar flash de contenido)
  if (loading || !tenantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--accent-aqua)]"></div>
      </div>
    );
  }

  // Si es owner/admin o tiene el permiso, mostrar contenido
  if (role === "owner" || role === "admin" || !requiredPermission || permissions[requiredPermission]) {
    return <>{children}</>;
  }

  // Si no tiene permiso, no mostrar nada (el useEffect redirige)
  return null;
}
