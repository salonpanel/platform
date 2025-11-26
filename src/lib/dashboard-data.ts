import { SupabaseClient } from "@supabase/supabase-js";

type TenantInfo = {
  id: string;
  name?: string | null;
  timezone?: string | null;
};

type MetricRow = {
  metric_date: string;
  confirmed_bookings: number;
  revenue_cents: number;
  active_services: number;
  active_staff: number;
  no_show_bookings: number;
};

export type DashboardDataset = {
  tenant: {
    id: string;
    name: string;
    timezone: string;
  };
  kpis: {
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
  upcomingBookings: any[];
};

export async function fetchDashboardDataset(
  supabase: SupabaseClient,
  tenant: TenantInfo
): Promise<DashboardDataset | null> {
  if (!tenant?.id) return null;

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();
  const todayKey = new Date().toISOString().slice(0, 10);

  const [bookingsRes, servicesRes, staffRes, upcomingRes, metricsRes] = await Promise.all([
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
    supabase
      .from("bookings")
      .select(`
        id,
        starts_at,
        ends_at,
        status,
        customer:customers(name, email),
        service:services(name),
        staff:staff(name)
      `)
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
  ]);

  const metrics: MetricRow[] = metricsRes.data || [];
  const metricsByDay = metrics.reduce((acc, row) => {
    acc[row.metric_date] = row;
    return acc;
  }, {} as Record<string, MetricRow>);

  const ensureDaysArray = (days: number) => {
    return Array.from({ length: days }).map((_, idx) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - idx));
      const key = date.toISOString().slice(0, 10);
      return metricsByDay[key]?.confirmed_bookings || 0;
    });
  };

  const bookingsLast7Days = ensureDaysArray(7);
  const todayMetrics = metricsByDay[todayKey];

  const totalBookingsLast7Days = bookingsLast7Days.reduce((sum, value) => sum + value, 0);
  const bookingsLast30Days = Array.from({ length: 30 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - idx));
    const key = date.toISOString().slice(0, 10);
    return metricsByDay[key]?.confirmed_bookings || 0;
  });

  const revenueLast7Days = Array.from({ length: 7 }).reduce((sum, _, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    return sum + (metricsByDay[key]?.revenue_cents || 0);
  }, 0);

  const revenueLast30Days = Array.from({ length: 30 }).reduce((sum, _, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - idx));
    const key = date.toISOString().slice(0, 10);
    return sum + (metricsByDay[key]?.revenue_cents || 0);
  }, 0);

  const noShowsLast7Days = Array.from({ length: 7 }).reduce((sum, _, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    return sum + (metricsByDay[key]?.no_show_bookings || 0);
  }, 0);

  const totalRevenueLast7Days = revenueLast7Days;
  const avgTicketLast7Days = totalBookingsLast7Days > 0 ? totalRevenueLast7Days / totalBookingsLast7Days : 0;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name || "Tu barbería",
      timezone: tenant.timezone || "Europe/Madrid",
    },
    kpis: {
      bookingsToday: todayMetrics?.confirmed_bookings ?? bookingsRes.count ?? 0,
      activeServices: todayMetrics?.active_services ?? servicesRes.count ?? 0,
      activeStaff: todayMetrics?.active_staff ?? staffRes.count ?? 0,
      bookingsLast7Days,
      totalBookingsLast7Days,
      totalBookingsLast30Days: bookingsLast30Days.reduce((sum, value) => sum + value, 0),
      revenueToday: todayMetrics?.revenue_cents ?? 0,
      revenueLast7Days,
      revenueLast30Days,
      noShowsLast7Days,
      avgTicketLast7Days,
    },
    upcomingBookings: upcomingRes.data || [],
  };
}
