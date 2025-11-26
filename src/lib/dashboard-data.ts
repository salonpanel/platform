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
};

export function createEmptyDashboardKpis(): DashboardDataset["kpis"] {
  return { ...EMPTY_DASHBOARD_KPIS, bookingsLast7Days: Array(7).fill(0) };
}

export async function fetchDashboardDataset(
  supabase: SupabaseClient,
  tenant: TenantInfo
): Promise<DashboardDataset | null> {
  if (!tenant?.id) return null;

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();
  const todayKey = new Date().toISOString().slice(0, 10);

  const [upcomingRes, metricsRes, staffRes, staffBookingsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `id, starts_at, ends_at, status, customer:customers(name, email), service:services(name), staff:staff(name)`
      )
      .eq("tenant_id", tenant.id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("org_metrics_daily")
      .select(
        "metric_date, confirmed_bookings, revenue_cents, active_services, active_staff, no_show_bookings"
      )
      .eq("tenant_id", tenant.id)
      .order("metric_date", { ascending: false })
      .limit(31),
    // 🔥 Obtener staff activo
    supabase
      .from("staff")
      .select("id, name, color, avatar_url, active")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),
    // 🔥 Obtener citas de hoy por staff para calcular ocupación
    supabase
      .from("bookings")
      .select("staff_id")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", todayEnd)
      .in("status", ["confirmed", "completed", "paid"]),
  ]);

  if (upcomingRes.error) throw upcomingRes.error;
  if (metricsRes.error) throw metricsRes.error;

  const metrics: MetricRow[] = metricsRes.data || [];
  const metricsByDay = metrics.reduce<Record<string, MetricRow>>((acc, row) => {
    acc[row.metric_date] = row;
    return acc;
  }, {});

  const ensureDaysArray = (days: number) =>
    Array.from({ length: days }).map((_, idx) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - idx));
      const key = date.toISOString().slice(0, 10);
      return metricsByDay[key]?.confirmed_bookings || 0;
    });

  const bookingsLast7Days = ensureDaysArray(7);
  const todayMetrics = metricsByDay[todayKey];

  const totalBookingsLast7Days = bookingsLast7Days.reduce((sum, value) => sum + value, 0);
  const bookingsLast30Days = Array.from({ length: 30 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - idx));
    const key = date.toISOString().slice(0, 10);
    return metricsByDay[key]?.confirmed_bookings || 0;
  });

  const revenueLast7Days = Array.from({ length: 7 }).reduce<number>((sum, _, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    return sum + (metricsByDay[key]?.revenue_cents || 0);
  }, 0);

  const revenueLast30Days = Array.from({ length: 30 }).reduce<number>((sum, _, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - idx));
    const key = date.toISOString().slice(0, 10);
    return sum + (metricsByDay[key]?.revenue_cents || 0);
  }, 0);

  const noShowsLast7Days = Array.from({ length: 7 }).reduce<number>((sum, _, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    return sum + (metricsByDay[key]?.no_show_bookings || 0);
  }, 0);

  const totalRevenueLast7Days = revenueLast7Days;
  const avgTicketLast7Days = totalBookingsLast7Days > 0 ? totalRevenueLast7Days / totalBookingsLast7Days : 0;

  let bookingsToday = todayMetrics?.confirmed_bookings;
  let activeServices = todayMetrics?.active_services;
  let activeStaff = todayMetrics?.active_staff;

  if (bookingsToday === undefined || activeServices === undefined || activeStaff === undefined) {
    const [bookingsRes, servicesRes, staffRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id", { head: true, count: "planned" })
        .eq("tenant_id", tenant.id)
        .gte("starts_at", todayStart)
        .lte("starts_at", todayEnd),
      supabase
        .from("services")
        .select("id", { head: true, count: "planned" })
        .eq("tenant_id", tenant.id)
        .eq("active", true),
      supabase
        .from("staff")
        .select("id", { head: true, count: "planned" })
        .eq("tenant_id", tenant.id)
        .eq("active", true),
    ]);

    bookingsToday = bookingsToday ?? bookingsRes.count ?? 0;
    activeServices = activeServices ?? servicesRes.count ?? 0;
    activeStaff = activeStaff ?? staffRes.count ?? 0;
  }

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

  // 🔥 Procesar staff con ocupación real
  const staffBookingCounts: Record<string, number> = {};
  for (const booking of staffBookingsRes.data || []) {
    if (booking.staff_id) {
      staffBookingCounts[booking.staff_id] = (staffBookingCounts[booking.staff_id] || 0) + 1;
    }
  }

  // Calcular ocupación: asumimos 8 citas máx por día = 100%
  const MAX_BOOKINGS_PER_DAY = 8;
  const staffMembers: StaffMember[] = (staffRes.data || []).map((staff: any) => {
    const bookingsCount = staffBookingCounts[staff.id] || 0;
    const occupancy = Math.min(Math.round((bookingsCount / MAX_BOOKINGS_PER_DAY) * 100), 100);

    return {
      id: staff.id,
      name: staff.name || "Sin nombre",
      color: staff.color || null,
      avatar_url: staff.avatar_url || null,
      bookingsToday: bookingsCount,
      occupancyPercent: occupancy,
      isActive: staff.active ?? true,
    };
  });

  return {
    tenant: { id: tenant.id, name: tenant.name || "Tu barbería", timezone: tenant.timezone || "Europe/Madrid" },
    kpis: {
      bookingsToday: bookingsToday ?? 0,
      activeServices: activeServices ?? 0,
      activeStaff: activeStaff ?? 0,
      bookingsLast7Days,
      totalBookingsLast7Days,
      totalBookingsLast30Days: bookingsLast30Days.reduce((sum: number, value: number) => sum + value, 0),
      revenueToday: todayMetrics?.revenue_cents ?? 0,
      revenueLast7Days,
      revenueLast30Days,
      noShowsLast7Days,
      avgTicketLast7Days,
    },
    upcomingBookings,
    staffMembers,
  };
}
