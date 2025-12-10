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
  const anchorDate = new Date(selectedDate);

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

  const [staffRes, servicesRes, customersRes, blockingsRes, schedulesRes, roleRes, bookingsRpcRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, active")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("services")
      .select("id, name, duration_min, price_cents, buffer_min")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("customers")
      .select("id, name, email, phone, notes")
      .eq("tenant_id", tenant.id)
      .order("name")
      .limit(100),
    supabase
      .from("staff_blockings")
      .select("*")
      .eq("tenant_id", tenant.id)
      .gte("start_at", range.startISO)
      .lte("end_at", range.endISO)
      .order("start_at"),
    supabase
      .from("staff_schedules")
      .select("staff_id, start_time, end_time")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true),
    options?.includeUserRole
      ? (async () => {
          const userId = options.userId || (await supabase.auth.getUser()).data.user?.id || null;
          if (!userId) return null;
          const { data } = await supabase
            .from("memberships")
            .select("role")
            .eq("tenant_id", tenant.id)
            .eq("user_id", userId)
            .maybeSingle();
          return data?.role || null;
        })()
      : Promise.resolve(null),
    supabase.rpc("get_agenda", {
      p_tenant_id: tenant.id,
      p_start_date: range.startISO,
      p_end_date: range.endISO,
    })
  ]);

  if (staffRes.error) throw staffRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (customersRes.error) throw customersRes.error;
  if (blockingsRes.error) throw blockingsRes.error;
  if (schedulesRes.error) throw schedulesRes.error;
  if (bookingsRpcRes.error) throw bookingsRpcRes.error;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name || "Tu barbería",
      timezone: tenant.timezone || "Europe/Madrid",
    },
    staff: staffRes.data || [],
    services: (servicesRes.data || []).map(s => ({ ...s, buffer_min: s.buffer_min ?? 0 })),
    customers: customersRes.data || [],
    bookings: bookingsRpcRes.data || [],
    blockings: blockingsRes.data || [],
    schedules: schedulesRes.data || [],
    userRole: await roleRes,
    range,
  };
}

export function extendRangeForPrefetch(range: { startISO: string; endISO: string }) {
  const startDate = new Date(range.startISO);
  const endDate = new Date(range.endISO);

  return {
    startISO: addDays(startDate, -1).toISOString(),
    endISO: addDays(endDate, 1).toISOString(),
  };
}
