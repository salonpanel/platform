"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type UserPermissions = {
  dashboard: boolean;
  agenda: boolean;
  clientes: boolean;
  servicios: boolean;
  staff: boolean;
  marketing: boolean;
  reportes: boolean;
  ajustes: boolean;
};

export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: true,
  agenda: true,
  clientes: true,
  servicios: false,
  staff: false,
  marketing: false,
  reportes: false,
  ajustes: false,
};

export const FULL_PERMISSIONS: UserPermissions = {
  dashboard: true,
  agenda: true,
  clientes: true,
  servicios: true,
  staff: true,
  marketing: true,
  reportes: true,
  ajustes: true,
};

export function useUserPermissions(tenantId: string | null) {
  const supabase = getSupabaseBrowser();
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        // Obtener rol del usuario
        const { data: membership } = await supabase
          .from("memberships")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .single();

        if (!membership) {
          setLoading(false);
          return;
        }

        setRole(membership.role);

        // Owners y admins tienen todos los permisos
        if (membership.role === "owner" || membership.role === "admin") {
          setPermissions(FULL_PERMISSIONS);
          setLoading(false);
          return;
        }

        // Para staff, obtener permisos personalizados
        const { data: userPerms } = await supabase
          .from("user_permissions")
          .select("permissions")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId)
          .single();

        if (userPerms?.permissions) {
          setPermissions(userPerms.permissions as UserPermissions);
        } else {
          // Si no tiene permisos configurados, usar defaults
          setPermissions(DEFAULT_PERMISSIONS);
        }
      } catch (error) {
        console.error("Error loading permissions:", error);
        setPermissions(DEFAULT_PERMISSIONS);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [supabase, tenantId]);

  return { permissions, role, loading };
}
