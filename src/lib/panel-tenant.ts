"use client";

import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type UserMembership = {
  tenant_id: string;
  role: "owner" | "admin" | "staff" | "viewer";
};

export type CurrentTenantStatus =
  | "OK"
  | "UNAUTHENTICATED"
  | "NO_MEMBERSHIP"
  | "ERROR";

export type CurrentTenantResult = {
  tenant: TenantInfo | null;
  role: string | null;
  isImpersonating: boolean;
  status: CurrentTenantStatus;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  } | null;
};

const BASE_RESULT: CurrentTenantResult = {
  tenant: null,
  role: null,
  isImpersonating: false,
  status: "ERROR",
  error: null,
};

function isAuthSessionMissingError(error: unknown) {
  if (!error) return false;
  if (typeof error === "string") {
    return error.toLowerCase().includes("auth session missing");
  }
  if (error instanceof Error) {
    return (
      error.name === "AuthSessionMissingError" ||
      error.message.toLowerCase().includes("auth session missing")
    );
  }

  if (typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const message = String((error as Record<string, unknown>).message || "");
    return message.toLowerCase().includes("auth session missing");
  }

  return false;
}

function serializeError(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as unknown as Record<string, unknown>).code as string | undefined,
      details: (error as unknown as Record<string, unknown>).details,
    };
  }

  if (typeof error === "object") {
    return {
      message: String((error as Record<string, unknown>).message ?? "Error desconocido"),
      code: (error as Record<string, unknown>).code as string | undefined,
      details: (error as Record<string, unknown>).details,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * Obtiene el tenant actual del usuario desde memberships
 * Soporta impersonación si el usuario es platform admin
 */
export async function getCurrentTenant(
  impersonateOrgId?: string | null
): Promise<CurrentTenantResult> {
  const supabase = getSupabaseBrowser();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.warn("[getCurrentTenant] Error getUser:", userError);

      if (isAuthSessionMissingError(userError)) {
        return {
          ...BASE_RESULT,
          status: "UNAUTHENTICATED",
          error: serializeError(userError),
        };
      }

      return {
        ...BASE_RESULT,
        status: "ERROR",
        error: serializeError(userError),
      };
    }

    if (!user) {
      console.warn("[getCurrentTenant] No hay sesión activa");
      return {
        ...BASE_RESULT,
        status: "UNAUTHENTICATED",
      };
    }

    let targetTenantId: string | null = null;
    let isImpersonating = false;
    let userRole: string | null = null;

    // Verificar impersonación
    if (impersonateOrgId) {
      const { data: isAdmin, error: adminError } = await supabase.rpc("check_platform_admin", {
        p_user_id: user.id,
      });

      if (adminError) {
        console.error("[getCurrentTenant] Error check_platform_admin:", adminError);
      }

      if (isAdmin) {
        targetTenantId = impersonateOrgId;
        isImpersonating = true;
      }
    }

    // Si no hay impersonación, obtener desde memberships
    if (!targetTenantId) {
      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        console.error("[getCurrentTenant] Error membership:", membershipError);
        return {
          ...BASE_RESULT,
          status: "ERROR",
          error: serializeError(membershipError),
        };
      }

      if (membership) {
        targetTenantId = membership.tenant_id;
        userRole = membership.role;
      } else {
        console.warn("[getCurrentTenant] Usuario sin memberships:", {
          user_id: user.id,
          email: user.email,
        });
        return {
          ...BASE_RESULT,
          status: "NO_MEMBERSHIP",
        };
      }
    }

    if (!targetTenantId) {
      return {
        ...BASE_RESULT,
        status: "NO_MEMBERSHIP",
      };
    }

    // Cargar información del tenant
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, slug, timezone")
      .eq("id", targetTenantId)
      .maybeSingle();

    if (tenantError) {
      console.error("[getCurrentTenant] Error tenant:", tenantError);
      return {
        ...BASE_RESULT,
        status: "ERROR",
        error: serializeError(tenantError),
      };
    }

    if (!tenantData) {
      console.warn("[getCurrentTenant] Tenant inexistente para membership:", targetTenantId);
      return {
        ...BASE_RESULT,
        status: "ERROR",
        error: {
          message: "No se encontró información del tenant asociado.",
        },
      };
    }

    return {
      tenant: {
        id: tenantData.id,
        name: tenantData.name,
        slug: tenantData.slug,
        timezone: tenantData.timezone || "Europe/Madrid",
      },
      role: userRole,
      isImpersonating,
      status: "OK",
      error: null,
    };
  } catch (err) {
    if (isAuthSessionMissingError(err)) {
      return {
        ...BASE_RESULT,
        status: "UNAUTHENTICATED",
        error: serializeError(err),
      };
    }

    console.error("[getCurrentTenant] Error inesperado:", err);
    return {
      ...BASE_RESULT,
      status: "ERROR",
      error: serializeError(err),
    };
  }
}

