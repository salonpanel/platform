import type { SupabaseClient } from "@supabase/supabase-js";

export type PermissionKey =
  | "dashboard"
  | "agenda"
  | "clientes"
  | "servicios"
  | "staff"
  | "marketing"
  | "reportes"
  | "ajustes";

export async function hasTenantPermission(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  required: PermissionKey
): Promise<boolean> {
  // 1) Leer rol de memberships
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = membership?.role as string | undefined;
  if (!role) return false;
  if (role === "owner" || role === "admin") return true;

  // 2) Para otros roles (p.ej. staff), consultar permisos granulares
  const { data: up } = await supabase
    .from("user_permissions")
    .select("permissions")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  const perms = (up?.permissions as Record<string, boolean> | null) || null;
  return Boolean(perms?.[required]);
}
