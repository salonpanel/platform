"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePermissions } from "@/contexts/PermissionsContext";
import type { UserPermissions } from "@/hooks/useUserPermissions";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: keyof UserPermissions;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { permissions, role, loading } = usePermissions();

  useEffect(() => {
    // Esperar a que cargue
    if (loading) return;

    // Si no hay permiso requerido, permitir acceso
    if (!requiredPermission) return;

    // Owners y admins tienen acceso completo
    if (role === "owner" || role === "admin") return;

    // Verificar si tiene el permiso específico
    if (!permissions[requiredPermission]) {
      console.warn(`Acceso denegado a ${pathname}: falta permiso ${requiredPermission}`);
      router.push("/panel/sin-permisos");
    }
  }, [loading, role, permissions, requiredPermission, pathname, router]);

  // NO mostrar loader aquí - el layout global ya lo maneja
  // Renderizar inmediatamente sin esperar (el contexto ya tiene los permisos cacheados)
  if (loading) {
    return null;
  }

  // Si es owner/admin o tiene el permiso, mostrar contenido
  if (role === "owner" || role === "admin" || !requiredPermission || permissions[requiredPermission]) {
    return <>{children}</>;
  }

  // Si no tiene permiso, no mostrar nada (el useEffect redirige)
  return null;
}
