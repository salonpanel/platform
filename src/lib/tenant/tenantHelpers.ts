/**
 * Unified Tenant Data Helpers
 * Provides resilient functions for fetching tenant staff and services
 * with proper error handling and session validation
 */

import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { guardTenantQuery, logTenantQueryResult } from "./validateTenantId";

export interface TenantStaffOption {
  id: string;
  name: string;
  active: boolean;
}

export interface TenantServiceOption {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Fetches all staff for a tenant with resilience
 */
export async function fetchTenantStaff(tenantId: string): Promise<TenantStaffOption[]> {
  // 🔒 GUARDRAIL: Strict validation using reusable utility
  if (!guardTenantQuery(tenantId, "fetchTenantStaff")) {
    return [];
  }

  const supabase = getSupabaseBrowser();

  try {
    // Validate session
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[fetchTenantStaff] Session error:", sessionError);
      return [];
    }

    if (!session?.session?.user?.id) {
      console.warn("[fetchTenantStaff] No authenticated user");
      return [];
    }

    const { data, error } = await supabase
      .from("staff")
      .select("id, display_name, name, active")
      .eq("tenant_id", tenantId)
      .order("name");

    if (error) {
      console.error("[fetchTenantStaff] Database error:", error);
      return [];
    }

    // 🔍 DEV LOGGING: Track results using reusable utility
    logTenantQueryResult(data?.length || 0, "fetchTenantStaff", {
      tenantId,
      staffNames: data?.map(s => s.name || s.display_name) || []
    });

    return (data || []).map(staff => ({
      id: staff.id,
      name: staff.display_name || staff.name,
      active: staff.active ?? true,
    }));
  } catch (err) {
    console.error("[fetchTenantStaff] Unexpected error:", err);
    return [];
  }
}

/**
 * Fetches all services for a tenant with resilience
 */
export async function fetchTenantServices(tenantId: string): Promise<TenantServiceOption[]> {
  // 🔒 GUARDRAIL: Strict validation using reusable utility
  if (!guardTenantQuery(tenantId, "fetchTenantServices")) {
    return [];
  }

  const supabase = getSupabaseBrowser();

  try {
    // Validate session
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[fetchTenantServices] Session error:", sessionError);
      return [];
    }

    if (!session?.session?.user?.id) {
      console.warn("[fetchTenantServices] No authenticated user");
      return [];
    }

    const { data, error } = await supabase
      .from("services")
      .select("id, name, active")
      .eq("tenant_id", tenantId)
      .order("name");

    if (error) {
      console.error("[fetchTenantServices] Database error:", error);
      return [];
    }

    // 🔍 DEV LOGGING: Track results using reusable utility
    logTenantQueryResult(data?.length || 0, "fetchTenantServices", {
      tenantId,
      serviceNames: data?.map(s => s.name) || []
    });

    return (data || []).map(service => ({
      id: service.id,
      name: service.name,
      active: service.active ?? true,
    }));
  } catch (err) {
    console.error("[fetchTenantServices] Unexpected error:", err);
    return [];
  }
}

/**
 * Validates tenant access for current user
 */
export async function validateTenantAccess(tenantId: string): Promise<boolean> {
  if (!tenantId || tenantId.trim() === "") {
    return false;
  }

  const supabase = getSupabaseBrowser();

  try {
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.session?.user?.id) {
      return false;
    }

    // Check if user has membership for this tenant
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", session.session.user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (membershipError) {
      console.error("[validateTenantAccess] Membership check error:", membershipError);
      return false;
    }

    return !!membership;
  } catch (err) {
    console.error("[validateTenantAccess] Unexpected error:", err);
    return false;
  }
}
