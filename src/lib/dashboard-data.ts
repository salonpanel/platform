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

export const EMPTY_DASHBOARD_KPIS: DashboardDataset["kpis"] = {
  bookingsToday: 0,
  bookingsLast7Days: Array(7).fill(0),
  activeServices: 0,
  activeStaff: 0,
  totalBookingsLast7Days: 0,
  totalBookingsLast30Days: 0,
  revenueToday: 0,
  revenueLast7Days: 0,
  revenueLast30Days: 0,
  noShowsLast7Days: 0,
  avgTicketLast7Days: 0,
  bookingsLast30DaysByDay: Array(30).fill(0),
  occupancyTodayPercent: 0,
  occupancyLast7DaysPercent: 0,
  occupancyLast30DaysPercent: 0,
  avgTicketToday: 0,
  avgTicketLast30Days: 0,
};

export function createEmptyDashboardKpis(): DashboardDataset["kpis"] {
  return { ...EMPTY_DASHBOARD_KPIS, bookingsLast7Days: Array(7).fill(0), bookingsLast30DaysByDay: Array(30).fill(0) };
}

// Runtime validation helper for dashboard KPIs - development only
export function validateDashboardKpis(kpis: DashboardKpis): DashboardKpis {
  if (process.env.NODE_ENV !== "development") return kpis;
  if (!kpis) return kpis; // Guard against undefined kpis

  if (kpis.bookingsToday < 0 || kpis.revenueToday < 0) {
    console.warn("[Dashboard KPIs] Detected negative values", kpis);
  }

  // Check for unrealistic percentages
  if (kpis.occupancyTodayPercent < 0 || kpis.occupancyTodayPercent > 200) {
    console.warn("[Dashboard KPIs] occupancyTodayPercent out of range:", kpis.occupancyTodayPercent);
  }

  if (kpis.occupancyLast7DaysPercent < 0 || kpis.occupancyLast7DaysPercent > 200) {
    console.warn("[Dashboard KPIs] occupancyLast7DaysPercent out of range:", kpis.occupancyLast7DaysPercent);
  }

  if (kpis.occupancyLast30DaysPercent < 0 || kpis.occupancyLast30DaysPercent > 200) {
    console.warn("[Dashboard KPIs] occupancyLast30DaysPercent out of range:", kpis.occupancyLast30DaysPercent);
  }

  // Check array lengths (with null-safe access)
  if (kpis.bookingsLast7Days?.length !== 7) {
    console.warn("[Dashboard KPIs] bookingsLast7Days should be 7 elements:", kpis.bookingsLast7Days);
  }

  if (kpis.bookingsLast30DaysByDay?.length !== 30) {
    console.warn("[Dashboard KPIs] bookingsLast30DaysByDay should be 30 elements:", kpis.bookingsLast30DaysByDay);
  }

  return kpis;
}

export async function fetchDashboardDataset(
  supabase: SupabaseClient,
  tenant: TenantInfo
): Promise<DashboardDataset | null> {
  if (!tenant?.id) return null;

  // 🚀 OPTIMIZACIÓN: Usamos la función SQL get_dashboard_kpis que consolida 11 queries en 1
  const { data: kpisData, error: kpisError } = await supabase.rpc('get_dashboard_kpis', { 
    tenant_id: tenant.id 
  });

  if (kpisError) {
    console.error("[Dashboard] Error fetching KPIs:", kpisError);
    return null;
  }

  // Validamos los KPIs antes de continuar
  const validatedKpis = validateDashboardKpis(kpisData);

  // 📋 Queries adicionales solo para los listados de próximas reservas y staff
  const [upcomingRes, staffRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id, starts_at, ends_at, status,
        customer:customers(name, email),
        service:services(name, price_cents),
        staff:staff(name)
      `)
      .eq("tenant_id", tenant.id)
      .gte("starts_at", new Date().toISOString())
      .not("status", "eq", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(15),
    supabase
      .from("staff")
      .select("id, name, color, avatar_url, active")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),
  ]);

  // Verificación de errores
  const resultsWithLabels = [
    { label: "upcomingRes", res: upcomingRes },
    { label: "staffRes", res: staffRes },
  ];

  for (const { label, res } of resultsWithLabels) {
    if (res?.error) {
      console.error("[DashboardData] Supabase error in query", {
        query: label,
        error: res.error,
        code: res.error.code,
        message: res.error.message,
        details: res.error.details,
        hint: res.error.hint,
      });
      throw new Error(
        `DashboardData query failed in ${label}: ${res.error.message || res.error.code || "unknown error"}`,
      );
    }
  }

  // Próximas reservas
  const upcomingBookings: UpcomingBooking[] = (upcomingRes.data || []).map((row: any) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const service = Array.isArray(row.service) ? row.service[0] : row.service;
    const staff = Array.isArray(row.staff) ? row.staff[0] : row.staff;

    return {
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at ?? null,
      status: row.status ?? null,
      customer: customer ? { name: customer?.name ?? null, email: customer?.email ?? null } : null,
      service: service ? { name: service?.name ?? null } : null,
      staff: staff ? { name: staff?.name ?? null } : null,
    };
  });

  // Staff activo (sin ocupación individual, eso viene en kpisData)
  const staffMembers: StaffMember[] = (staffRes.data || []).map((staff: any) => ({
    id: staff.id,
    name: staff.name || "Sin nombre",
    color: staff.color || null,
    avatar_url: staff.avatar_url || null,
    bookingsToday: 0, // Dato no crítico para el dashboard
    occupancyPercent: 0, // Dato no crítico para el dashboard
    isActive: staff.active ?? true,
  }));

  return {
    tenant: { 
      id: tenant.id, 
      name: tenant.name || "Tu barbería", 
      timezone: tenant.timezone || "Europe/Madrid" 
    },
    kpis: validatedKpis,
    upcomingBookings,
    staffMembers,
  };
}

