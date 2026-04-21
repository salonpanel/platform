import { SupabaseClient } from "@supabase/supabase-js";

type TenantInfo = { id: string; name?: string | null; timezone?: string | null };

export type UpcomingBooking = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: string | null;
  customer: { name: string | null; email: string | null } | null;
  service: { name: string | null } | null;
  staff: { name: string | null } | null;
};

export type StaffMember = {
  id: string;
  name: string;
  color: string | null;
  avatar_url: string | null;
  bookingsToday: number;
  occupancyPercent: number;
  isActive: boolean;
};

type MetricRow = {
  metric_date: string;
  confirmed_bookings: number;
  revenue_cents: number;
  active_services: number;
  active_staff: number;
  no_show_bookings: number;
};

export type DashboardKpis = {
  bookingsToday: number;
  activeServices: number;
  activeStaff: number;
  bookingsLast7Days: number[];
  totalBookingsLast7Days: number;
  totalBookingsLast30Days: number;
  revenueToday: number;
  revenueLast7Days: number;
  revenueLast30Days: number;
  noShowsLast7Days: number;
  avgTicketLast7Days: number;
  bookingsLast30DaysByDay: number[];
  // New server-side occupancy calculations
  occupancyTodayPercent: number;
  occupancyLast7DaysPercent: number;
  occupancyLast30DaysPercent: number;
  // New server-side average ticket calculations
  avgTicketToday: number;
  avgTicketLast30Days: number;
};

export type DashboardDataset = {
  tenant: { id: string; name: string; timezone: string };
  kpis: DashboardKpis;
  upcomingBookings: UpcomingBooking[];
  staffMembers: StaffMember[];
};

export const EMPTY_DASHBOARD_KPIS: DashboardKpis = {
  bookingsToday: 0,
  activeServices: 0,
  activeStaff: 0,
  bookingsLast7Days: [],
  totalBookingsLast7Days: 0,
  totalBookingsLast30Days: 0,
  revenueToday: 0,
  revenueLast7Days: 0,
  revenueLast30Days: 0,
  noShowsLast7Days: 0,
  avgTicketLast7Days: 0,
  bookingsLast30DaysByDay: [],
  occupancyTodayPercent: 0,
  occupancyLast7DaysPercent: 0,
  occupancyLast30DaysPercent: 0,
  avgTicketToday: 0,
  avgTicketLast30Days: 0,
};

export function createEmptyDashboardKpis(): DashboardKpis {
  return { ...EMPTY_DASHBOARD_KPIS };
}

/** Si PostgREST / jsonb devuelve un objeto anidado como string JSON, lo parsea. */
function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function parseJsonArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Normaliza KPIs del RPC (get_dashboard_kpis / panel) a arrays numéricos de longitud fija. */
export function normalizeKpisFromRpc(raw: unknown): DashboardKpis {
  const empty = createEmptyDashboardKpis();
  const k = parseJsonObject(raw);
  if (!k) return empty;

  const to7 = (a: unknown): number[] => {
    const parsed = parseJsonArray(a);
    if (!parsed) return Array(7).fill(0);
    const arr = parsed.map((v) => Number(v) || 0);
    while (arr.length < 7) arr.push(0);
    return arr.slice(0, 7);
  };
  const to30 = (a: unknown): number[] => {
    const parsed = parseJsonArray(a);
    if (!parsed) return Array(30).fill(0);
    const arr = parsed.map((v) => Number(v) || 0);
    while (arr.length < 30) arr.push(0);
    return arr.slice(0, 30);
  };

  const num = (v: unknown): number => {
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    ...empty,
    ...k,
    bookingsLast7Days: to7(k.bookingsLast7Days),
    bookingsLast30DaysByDay: to30(k.bookingsLast30DaysByDay),
    bookingsToday: num(k.bookingsToday),
    activeServices: num(k.activeServices),
    activeStaff: num(k.activeStaff),
    totalBookingsLast7Days: num(k.totalBookingsLast7Days),
    totalBookingsLast30Days: num(k.totalBookingsLast30Days),
    revenueToday: num(k.revenueToday),
    revenueLast7Days: num(k.revenueLast7Days),
    revenueLast30Days: num(k.revenueLast30Days),
    noShowsLast7Days: num(k.noShowsLast7Days),
    avgTicketLast7Days: num(k.avgTicketLast7Days),
    avgTicketToday: num(k.avgTicketToday),
    avgTicketLast30Days: num(k.avgTicketLast30Days),
    occupancyTodayPercent: num(k.occupancyTodayPercent),
    occupancyLast7DaysPercent: num(k.occupancyLast7DaysPercent),
    occupancyLast30DaysPercent: num(k.occupancyLast30DaysPercent),
  };
}

// Runtime validation helper for dashboard KPIs - development only
export function validateDashboardKpis(kpis: DashboardKpis): DashboardKpis {
  if (process.env.NODE_ENV !== "development") return kpis;
  if (!kpis) return kpis; // Guard against undefined kpis

  if (kpis.bookingsToday < 0) console.warn("[Dashboard] Negative bookingsToday");
  return kpis;
}

export async function fetchDashboardKPIs(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DashboardKpis> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_analytics_metrics_v1", {
    p_tenant_id: tenantId
  });

  if (rpcError) {
    console.error("[Dashboard] Secure RPC get_analytics_metrics_v1 failed:", rpcError);
    return createEmptyDashboardKpis();
  }

  return validateDashboardKpis(rpcData as DashboardKpis);
}

// export async function fetchUpcomingBookings(
//   supabase: SupabaseClient,
//   tenantId: string
// ): Promise<UpcomingBooking[]> {
//   const { data, error } = await supabase
//     .from("bookings")
//     .select(`
//         id, starts_at, ends_at, status,
//         customer:customers(name, email),
//         service:services!bookings_service_id_fkey(name, price_cents),
//         staff:staff!bookings_staff_id_fkey(name)
//       `)
//     .eq("tenant_id", tenantId)
//     .gte("starts_at", new Date().toISOString())
//     .not("status", "eq", "cancelled")
//     .order("starts_at", { ascending: true })
//     .limit(15);

//   if (error) {
//     console.error("Error fetching upcoming bookings", error);
//     return [];
//   }

//   return (data || []).map((row: any) => {
//     const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
//     const service = Array.isArray(row.service) ? row.service[0] : row.service;
//     const staff = Array.isArray(row.staff) ? row.staff[0] : row.staff;

//     return {
//       id: row.id,
//       starts_at: row.starts_at,
//       ends_at: row.ends_at ?? null,
//       status: row.status ?? null,
//       customer: customer ? { name: customer?.name ?? null, email: customer?.email ?? null } : null,
//       service: service ? { name: service?.name ?? null } : null,
//       staff: staff ? { name: staff?.name ?? null } : null,
//     };
//   });
// }
export async function fetchUpcomingBookings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<UpcomingBooking[]> {
  const { data, error } = await supabase.rpc("panel_fetch_upcoming_bookings_v1", {
    p_tenant_id: tenantId,
    p_limit: 15
  });

  if (error) {
    console.error("Error fetching upcoming bookings (RPC):", error);
    return [];
  }

  // Map RPC result to UpcomingBooking type if needed, or if RPC matches exactly:
  // RPC returns: { id, starts_at, ends_at, status, customer: {name, email}, service: {name}, staff: {name} }
  // This matches our type almost exactly.
  // We just need to handle nulls safely as per the type definition.

  return (data || []).map((row: any) => ({
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? null,
    status: row.status ?? null,
    customer: row.customer ? { name: row.customer.name, email: row.customer.email } : null,
    service: row.service ? { name: row.service.name } : null,
    staff: row.staff ? { name: row.staff.name } : null,
  }));
}

export async function fetchActiveStaff(
  supabase: SupabaseClient,
  tenantId: string
): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, color, avatar_url, active")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Error fetching active staff", error);
    return [];
  }

  return (data || []).map((staff: any) => ({
    id: staff.id,
    name: staff.name || "Sin nombre",
    color: staff.color || null,
    avatar_url: staff.avatar_url || null,
    bookingsToday: 0,
    occupancyPercent: 0,
    isActive: staff.active ?? true,
  }));
}

export async function fetchDashboardDataset(
  supabase: SupabaseClient,
  tenant: TenantInfo
): Promise<DashboardDataset | null> {
  if (!tenant?.id) return null;

  // Use the new unified RPC for fast, atomic data loading
  const { data: rawData, error } = await supabase.rpc("panel_fetch_dashboard_dataset_v1", {
    p_tenant_id: tenant.id,
  });

  if (error) {
    console.error("[Dashboard] Error loading dataset:", error);
    return null;
  }

  const data =
    parseJsonObject(rawData) ??
    (rawData !== null &&
    rawData !== undefined &&
    typeof rawData === "object" &&
    !Array.isArray(rawData)
      ? (rawData as Record<string, unknown>)
      : null);
  if (!data) {
    console.error("[Dashboard] RPC payload missing or not an object:", rawData);
    return null;
  }

  if (data.status === "ERROR") {
    console.error("[Dashboard] RPC returned error:", data.error);
    return null;
  }

  // If successful, return the dataset
  if (data.status === "OK") {
    const staffRaw = parseJsonArray((data as any).staffMembers) ?? ((data as any).staffMembers as any[]);
    const rawStaff = (Array.isArray(staffRaw) ? staffRaw : []) as any[];
    const staffMembers: StaffMember[] = rawStaff.map((s) => ({
      id: s.id,
      name: s.name ?? "Sin nombre",
      color: s.color ?? null,
      avatar_url: s.avatar_url ?? null,
      bookingsToday: s.bookingsToday ?? 0,
      occupancyPercent: s.occupancyPercent ?? 0,
      isActive: s.isActive ?? s.active ?? true,
    }));

    const upcomingParsed =
      parseJsonArray((data as { upcomingBookings?: unknown }).upcomingBookings) ??
      ((data as { upcomingBookings?: unknown }).upcomingBookings as unknown[] | undefined);
    const upcomingBookings = (Array.isArray(upcomingParsed) ? upcomingParsed : []) as UpcomingBooking[];

    const tenantRaw = (data as { tenant?: unknown }).tenant;
    const tenantObj =
      parseJsonObject(tenantRaw) ?? (tenantRaw && typeof tenantRaw === "object" && !Array.isArray(tenantRaw) ? tenantRaw : null);

    const tenantSafe: DashboardDataset["tenant"] = tenantObj
      ? (tenantObj as DashboardDataset["tenant"])
      : {
          id: tenant.id,
          name: tenant.name ?? "Tu negocio",
          timezone: tenant.timezone ?? "Europe/Madrid",
        };

    return {
      tenant: tenantSafe,
      kpis: validateDashboardKpis(normalizeKpisFromRpc((data as { kpis?: unknown }).kpis)),
      upcomingBookings,
      staffMembers,
    };
  }

  return null;
}

