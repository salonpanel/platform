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
    // Esperar a que cargue y que haya tenantId
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

  // NO mostrar loader aquí - el layout global ya lo maneja
  // Esto evita loaders anidados y mejora la UX
  if (loading || !tenantId) {
    return null;
  }

  // Si es owner/admin o tiene el permiso, mostrar contenido
  if (role === "owner" || role === "admin" || !requiredPermission || permissions[requiredPermission]) {
    return <>{children}</>;
  }

  // Si no tiene permiso, no mostrar nada (el useEffect redirige)
  return null;
}
