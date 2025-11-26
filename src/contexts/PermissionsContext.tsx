"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { UserPermissions, DEFAULT_PERMISSIONS, FULL_PERMISSIONS } from "@/hooks/useUserPermissions";

type PermissionsContextType = {
  permissions: UserPermissions;
  role: string | null;
  loading: boolean;
  tenantId: string | null;
  setTenantId: (id: string | null) => void;
  refresh: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

type RpcUserRoleAndPermissions = {
  role: string;
  permissions: UserPermissions;
};

function isRpcUserRoleAndPermissions(obj: any): obj is RpcUserRoleAndPermissions {
  return obj && typeof obj.role === "string" && typeof obj.permissions === "object";
}

export function PermissionsProvider({ children, initialPermissions, initialRole, initialTenantId }: { children: ReactNode; initialPermissions?: UserPermissions | null; initialRole?: string | null; initialTenantId?: string | null }) {
  const [permissions, setPermissions] = useState<UserPermissions>(initialPermissions ?? FULL_PERMISSIONS);
  const [role, setRole] = useState<string | null>(initialRole ?? null);
  const [loading, setLoading] = useState(initialPermissions ? false : true);
  const [tenantId, setTenantId] = useState<string | null>(initialTenantId ?? null);
  const supabase = getSupabaseBrowser();

  const loadPermissions = useCallback(async () => {
    // If initialPermissions were provided and tenantId matches, don't reload
    if (!tenantId) {
      setLoading(false);
      return;
    }
    if (initialPermissions && initialTenantId && tenantId === initialTenantId) {
      // already initialized from server
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
  }, [supabase, tenantId, initialPermissions, initialTenantId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        role,
        loading,
        tenantId,
        setTenantId,
        refresh: loadPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within PermissionsProvider");
  }
  return context;
}
