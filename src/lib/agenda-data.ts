import { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ViewMode } from "@/types/agenda";
import { validateTenantObject, logTenantQueryResult } from "@/lib/tenant/validateTenantId";

export type AgendaDataset = {
  tenant: {
    id: string;
    name: string;
    timezone: string;
  };
  staff: Array<{ id: string; name: string; active?: boolean | null }>;
  services: Array<{ id: string; name: string; duration_min: number; price_cents: number; buffer_min: number }>;
  customers: Array<{ id: string; name: string; email: string | null; phone: string | null; notes?: string | null }>;
  bookings: any[];
  blockings: any[];
  schedules: Array<{ staff_id: string; start_time: string; end_time: string }>;
  userRole?: string | null;
  range: { startISO: string; endISO: string; viewMode: ViewMode; anchorDate: string };
};

export function getAgendaRange(selectedDate: string, viewMode: ViewMode) {
  let anchorDate = new Date(selectedDate);

  // Validation: Prevent "Invalid time value" crash
  if (isNaN(anchorDate.getTime())) {
    console.warn(`[getAgendaRange] Invalid date received: "${selectedDate}". Falling back to today.`);
    anchorDate = new Date();
  }

  if (viewMode === "week") {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return { startISO: start.toISOString(), endISO: end.toISOString(), viewMode, anchorDate: selectedDate };
  }

  if (viewMode === "month") {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return { startISO: start.toISOString(), endISO: end.toISOString(), viewMode, anchorDate: selectedDate };
  }

  const start = startOfDay(anchorDate);
  const end = endOfDay(anchorDate);
  return { startISO: start.toISOString(), endISO: end.toISOString(), viewMode, anchorDate: selectedDate };
}

export async function fetchAgendaDataset(
  supabase: SupabaseClient,
  tenant: { id: string; name?: string | null; timezone?: string | null },
  range: { startISO: string; endISO: string; viewMode: ViewMode; anchorDate: string },
  options?: { includeUserRole?: boolean; userId?: string | null }
): Promise<AgendaDataset> {
  if (!validateTenantObject(tenant, "fetchAgendaDataset")) {
    throw new Error("Invalid tenant object provided to fetchAgendaDataset");
  }

  // Phase H.5: Unified RPC Call
  const { data, error } = await supabase.rpc("panel_fetch_agenda_dataset_v1", {
    p_tenant_id: tenant.id,
    p_start_date: range.startISO,
    p_end_date: range.endISO,
  });

  if (error) {
    console.error("RPC panel_fetch_agenda_dataset_v1 error:", error);
    throw new Error(`Error loading agenda: ${error.message}`);
  }

  // Handle RPC-level error object
  if (data?.status === "ERROR") {
    console.error("RPC logic error:", data.error);
    throw new Error(`Error loading agenda: ${data.error?.message || "Internal RPC Error"}`);
  }

  // Phase H.5.2: Handling Special Statuses
  const status = data?.status;
  if (!data || (status !== "OK" && status !== "EMPTY_NO_STAFF")) {
    // Unexpected status or missing data
    throw new Error("Invalid response from Agenda RPC");
  }

  // NOTE: If status is EMPTY_NO_STAFF, the arrays will be empty as per RPC definition.
  // We can let it flow through or add specific metadata if needed.

  // Helper to ensure array
  const safeArray = (arr: any) => Array.isArray(arr) ? arr : [];

  return {
    tenant: {
      id: tenant.id,
      name: data.tenant?.name || tenant.name || "Tu barbería",
      timezone: data.tenant?.timezone || tenant.timezone || "Europe/Madrid",
    },
    staff: safeArray(data.staff),
    services: safeArray(data.services).map((s: any) => ({ ...s, buffer_min: s.buffer_min ?? 0 })),
    customers: [], // Async loaded
    bookings: safeArray(data.bookings),
    blockings: safeArray(data.blockings),
    schedules: safeArray(data.schedules),
    // For userRole, we might still need to fetch it if it's not in the RPC? 
    // The RPC validates membership but doesn't explicitly return role in the v1 signature.
    // If strict role check is needed, we can keep the separate call or add it to RPC later.
    // For now, let's keep the option logic if needed, OR just assume it's separate.
    // The previous implementation fetched it in parallel.
    // To match "ONE RPC", we should ideally include it, but let's stick to the H.5 plan strict scope.
    // The plan said: "Retain helper functions".
    // If getting the role is minimal cost, we can do it separately or just null it if not critical.
    // Let's check where userRole is used.
    // It's used likely for permission checks in UI.
    // Let's keep the existing role fetch if options.includeUserRole is true, to avoid breaking UI permissions.
    // But since we want to avoid multiple queries...
    // The RPC checks membership, so the user IS a member.
    // Let's do a quick separate fetch ONLY if requested, or better:
    // User Instructions: "fetchAgendaDataset orchestrates 6-7 queries ... duplicate ... replace with ONE RPC".
    // I will remove the Promise.all. If role is needed, I'll fetch it separately quickly or modify RPC.
    // Modifying RPC is safer but I already applied it.
    // Actually, I can just fetch the role separately or assume the UI can handle null/re-fetch.
    // Let's keep the role fetch simple if requested.
    userRole: options?.includeUserRole ? await fetchUserRole(supabase, tenant.id, options.userId) : null,
    range,
  };
}

async function fetchUserRole(supabase: SupabaseClient, tenantId: string, userId?: string | null) {
  const uid = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", uid)
    .maybeSingle();
  return data?.role || null;
}

export function extendRangeForPrefetch(range: { startISO: string; endISO: string }) {
  const startDate = new Date(range.startISO);
  const endDate = new Date(range.endISO);

  return {
    startISO: addDays(startDate, -1).toISOString(),
    endISO: addDays(endDate, 1).toISOString(),
  };
}
