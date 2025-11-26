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
};

export function createEmptyDashboardKpis(): DashboardDataset["kpis"] {
  return { ...EMPTY_DASHBOARD_KPIS, bookingsLast7Days: Array(7).fill(0), bookingsLast30DaysByDay: Array(30).fill(0) };
}

export async function fetchDashboardDataset(
  supabase: SupabaseClient,
  tenant: TenantInfo
): Promise<DashboardDataset | null> {
  if (!tenant?.id) return null;

  // Calcular fechas con timezone correcto
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
  
  // Fecha hace 7 días
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  // Fecha hace 30 días
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  // Estados válidos para contar reservas e ingresos
  // Los ingresos se cuentan de reservas confirmadas, completadas o pagadas
  const completedStatuses = ['confirmed', 'completed', 'paid'];

  const [
    upcomingRes,
    staffRes,
    bookingsTodayRes,
    bookingsLast7DaysRes,
    bookingsLast30DaysRes,
    servicesRes,
    staffBookingsTodayRes,
  ] = await Promise.all([
    // 1. Reservas de HOY y MAÑANA (para el widget de próximas)
    supabase
      .from("bookings")
      .select(`
        id, starts_at, ends_at, status,
        customer:customers(name, email),
        service:services(name, price_cents),
        staff:staff(name)
      `)
      .eq("tenant_id", tenant.id)
      .gte("starts_at", todayStart) // Desde el inicio de hoy, no desde ahora
      .not("status", "eq", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(15),

    // 2. Staff activo
    supabase
      .from("staff")
      .select("id, name, color, avatar_url, active")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),

    // 3. Reservas de HOY (todas las del día, no canceladas) - con precio del servicio
    supabase
      .from("bookings")
      .select("id, status, staff_id, service:services(price_cents)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", todayEnd)
      .not("status", "eq", "cancelled"),

    // 4. Reservas últimos 7 días (con fecha para agrupar) - con precio del servicio
    supabase
      .from("bookings")
      .select("id, starts_at, status, service:services(price_cents)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", sevenDaysAgoISO)
      .not("status", "eq", "cancelled"),

    // 5. Reservas últimos 30 días - con precio del servicio
    supabase
      .from("bookings")
      .select("id, starts_at, status, service:services(price_cents)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", thirtyDaysAgoISO)
      .not("status", "eq", "cancelled"),

    // 6. Servicios activos
    supabase
      .from("services")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", tenant.id)
      .eq("active", true),

    // 7. Citas de hoy por staff (para ocupación)
    supabase
      .from("bookings")
      .select("staff_id")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", todayEnd)
      .not("status", "eq", "cancelled"),
  ]);

  // Procesar datos
  const bookingsTodayData = bookingsTodayRes.data || [];
  const bookingsLast7DaysData = bookingsLast7DaysRes.data || [];
  const bookingsLast30DaysData = bookingsLast30DaysRes.data || [];

  // Helper para extraer precio del servicio (puede ser array o objeto)
  const getServicePrice = (booking: any): number => {
    const service = Array.isArray(booking.service) ? booking.service[0] : booking.service;
    return service?.price_cents || 0;
  };

  // === KPI: Reservas de hoy ===
  const bookingsToday = bookingsTodayData.length;

  // === KPI: Ingresos de hoy (solo completed/paid) - en centavos
  const revenueToday = bookingsTodayData
    .filter(b => completedStatuses.includes(b.status))
    .reduce((sum, b) => sum + getServicePrice(b), 0);

  // === KPI: Reservas últimos 7 días (por día) ===
  const bookingsByDay: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const key = date.toISOString().slice(0, 10);
    bookingsByDay[key] = 0;
  }
  
  for (const booking of bookingsLast7DaysData) {
    const dateKey = booking.starts_at.slice(0, 10);
    if (bookingsByDay[dateKey] !== undefined) {
      bookingsByDay[dateKey]++;
    }
  }
  
  const bookingsLast7Days = Object.values(bookingsByDay);
  const totalBookingsLast7Days = bookingsLast7DaysData.length;

  // === KPI: Reservas últimos 30 días (por día) ===
  const bookingsByDay30: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const key = date.toISOString().slice(0, 10);
    bookingsByDay30[key] = 0;
  }

  for (const booking of bookingsLast30DaysData) {
    const dateKey = booking.starts_at.slice(0, 10);
    if (bookingsByDay30[dateKey] !== undefined) {
      bookingsByDay30[dateKey]++;
    }
  }

  const bookingsLast30DaysByDay = Object.values(bookingsByDay30);

  // === KPI: Ingresos últimos 7 días (solo completed/paid) - en centavos
  const revenueLast7Days = bookingsLast7DaysData
    .filter(b => completedStatuses.includes(b.status))
    .reduce((sum, b) => sum + getServicePrice(b), 0);

  // === KPI: Reservas y revenue últimos 30 días - en centavos
  const totalBookingsLast30Days = bookingsLast30DaysData.length;
  const revenueLast30Days = bookingsLast30DaysData
    .filter(b => completedStatuses.includes(b.status))
    .reduce((sum, b) => sum + getServicePrice(b), 0);

  // === KPI: No-shows últimos 7 días ===
  const noShowsLast7Days = bookingsLast7DaysData
    .filter(b => b.status === 'no_show')
    .length;

  // === KPI: Ticket medio (ingresos / reservas completadas) ===
  const completedBookings7Days = bookingsLast7DaysData.filter(b => completedStatuses.includes(b.status)).length;
  const avgTicketLast7Days = completedBookings7Days > 0 ? revenueLast7Days / completedBookings7Days : 0;

  // === Staff activo ===
  const activeStaff = staffRes.data?.length || 0;
  const activeServices = servicesRes.count || 0;

  // === Próximas reservas ===
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

  // === Staff con ocupación real ===
  const staffBookingCounts: Record<string, number> = {};
  for (const booking of staffBookingsTodayRes.data || []) {
    if (booking.staff_id) {
      staffBookingCounts[booking.staff_id] = (staffBookingCounts[booking.staff_id] || 0) + 1;
    }
  }

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
      bookingsToday,
      activeServices,
      activeStaff,
      bookingsLast7Days,
      totalBookingsLast7Days,
      totalBookingsLast30Days,
      revenueToday,
      revenueLast7Days,
      revenueLast30Days,
      noShowsLast7Days,
      avgTicketLast7Days,
      bookingsLast30DaysByDay,
    },
    upcomingBookings,
    staffMembers,
  };
}
