"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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

type RpcUserRoleAndPermissions = {
  role: string;
  permissions: UserPermissions;
};

function isRpcUserRoleAndPermissions(obj: any): obj is RpcUserRoleAndPermissions {
  return obj && typeof obj.role === "string" && typeof obj.permissions === "object";
}

export function useUserPermissions(tenantId: string | null) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [permissions, setPermissions] = useState<UserPermissions>(FULL_PERMISSIONS);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPermissions(DEFAULT_PERMISSIONS);
        setRole(null);
        setLoading(false);
        return;
      }

      // Usar la función RPC optimizada (una sola consulta)
      const { data, error } = await supabase
        .rpc("get_user_role_and_permissions", {
          p_user_id: user.id,
          p_tenant_id: tenantId,
        })
        .single();

      if (error || !isRpcUserRoleAndPermissions(data)) {
        setPermissions(DEFAULT_PERMISSIONS);
        setRole(null);
        setLoading(false);
        return;
      }

      setRole(data.role);
      if (data.role === "owner" || data.role === "admin") {
        setPermissions(FULL_PERMISSIONS);
      } else {
        setPermissions(data.permissions as UserPermissions);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading permissions (rpc):", error);
      setPermissions(FULL_PERMISSIONS);
      setRole(null);
      setLoading(false);
    }
  }, [supabase, tenantId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return { permissions, role, loading };
}
