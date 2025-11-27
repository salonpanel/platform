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
export function validateDashboardKpis(kpis: DashboardKpis) {
  if (process.env.NODE_ENV !== "development") return;
  if (!kpis) return; // Guard against undefined kpis

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
}

export async function fetchDashboardDataset(
  supabase: SupabaseClient,
  tenant: TenantInfo
): Promise<DashboardDataset | null> {
  if (!tenant?.id) return null;

  // Estados válidos para contar reservas e ingresos
  // Los ingresos se cuentan de reservas confirmadas, completadas o pagadas
  const completedStatuses = ['confirmed', 'completed', 'paid'];

  // Calcular fechas con timezone del tenant
  const now = new Date();
  const tenantTimezone = tenant.timezone || "Europe/Madrid";

  // Para cálculos de ocupación, necesitamos fechas en el timezone del tenant
  // Pero para queries SQL, convertimos a UTC
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

  const [
    upcomingRes,
    staffRes,
    bookingsTodayRes,
    bookingsLast7DaysRes,
    bookingsLast30DaysRes,
    servicesRes,
    staffBookingsTodayRes,
    staffSchedulesRes,
    completedBookingsTodayRes,
    completedBookingsLast7DaysRes,
    completedBookingsLast30DaysRes,
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

    // 8. Staff schedules (para calcular slots disponibles)
    supabase
      .from("staff_schedules")
      .select("staff_id, day_of_week, start_time, end_time")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true),

    // 9. Reservas completadas HOY (solo para ticket medio)
    supabase
      .from("bookings")
      .select("id, service:services(price_cents)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", todayStart)
      .lte("starts_at", todayEnd)
      .in("status", completedStatuses),

    // 10. Reservas completadas últimos 7 días (solo para ticket medio)
    supabase
      .from("bookings")
      .select("id, service:services(price_cents)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", sevenDaysAgoISO)
      .in("status", completedStatuses),

    // 11. Reservas completadas últimos 30 días (solo para ticket medio)
    supabase
      .from("bookings")
      .select("id, service:services(price_cents)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", thirtyDaysAgoISO)
      .in("status", completedStatuses),
  ]);

  // Procesar datos
  const bookingsTodayData = bookingsTodayRes.data || [];
  const bookingsLast7DaysData = bookingsLast7DaysRes.data || [];
  const bookingsLast30DaysData = bookingsLast30DaysRes.data || [];
  const staffSchedulesData = staffSchedulesRes.data || [];
  const completedBookingsTodayData = completedBookingsTodayRes.data || [];
  const completedBookingsLast7DaysData = completedBookingsLast7DaysRes.data || [];
  const completedBookingsLast30DaysData = completedBookingsLast30DaysRes.data || [];

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

  // === CALCULATE OCCUPANCY BASED ON REAL STAFF SCHEDULES ===

  // Helper: Calculate available slots for a period using staff schedules
  const calculateAvailableSlots = (period: 'today' | '7days' | '30days'): number => {
    const staffSchedules = staffSchedulesData;
    const activeStaff = staffRes.data || [];
    const staffIds = activeStaff.map(s => s.id);

    let totalSlots = 0;

    if (period === 'today') {
      // Today: calculate slots for today based on today's schedules
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const todaySchedules = staffSchedules.filter(s => s.day_of_week === today);

      for (const schedule of todaySchedules) {
        if (staffIds.includes(schedule.staff_id)) {
          // Calculate hours worked today
          const startTime = schedule.start_time.split(':');
          const endTime = schedule.end_time.split(':');
          const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
          const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);
          const hoursWorked = (endMinutes - startMinutes) / 60;

          // Assume 30-minute slots (2 slots per hour)
          const slotsPerHour = 2;
          totalSlots += Math.max(0, hoursWorked * slotsPerHour);
        }
      }
    } else {
      // For 7d/30d: calculate average daily slots across the period
      const daysToCheck = period === '7days' ? 7 : 30;
      const startDate = new Date();

      for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(checkDate.getDate() - dayOffset);
        const dayOfWeek = checkDate.getDay();

        const daySchedules = staffSchedules.filter(s => s.day_of_week === dayOfWeek);
        let daySlots = 0;

        for (const schedule of daySchedules) {
          if (staffIds.includes(schedule.staff_id)) {
            const startTime = schedule.start_time.split(':');
            const endTime = schedule.end_time.split(':');
            const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1]);
            const endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1]);
            const hoursWorked = (endMinutes - startMinutes) / 60;
            const slotsPerHour = 2; // 30-minute slots
            daySlots += Math.max(0, hoursWorked * slotsPerHour);
          }
        }

        totalSlots += daySlots;
      }
    }

    return Math.round(totalSlots);
  };

  // Helper: Count booked slots for a period
  const countBookedSlots = (period: 'today' | '7days' | '30days'): number => {
    let bookingData: any[];

    switch (period) {
      case 'today':
        bookingData = bookingsTodayData.filter(b => completedStatuses.includes(b.status));
        break;
      case '7days':
        bookingData = bookingsLast7DaysData.filter(b => completedStatuses.includes(b.status));
        break;
      case '30days':
        bookingData = bookingsLast30DaysData.filter(b => completedStatuses.includes(b.status));
        break;
    }

    return bookingData.length;
  };

  // Calculate occupancy percentages
  const availableSlotsToday = calculateAvailableSlots('today');
  const bookedSlotsToday = countBookedSlots('today');
  const occupancyTodayPercent = availableSlotsToday > 0 ? Math.round((bookedSlotsToday / availableSlotsToday) * 100) : 0;

  const availableSlots7Days = calculateAvailableSlots('7days');
  const bookedSlots7Days = countBookedSlots('7days');
  const occupancyLast7DaysPercent = availableSlots7Days > 0 ? Math.round((bookedSlots7Days / availableSlots7Days) * 100) : 0;

  const availableSlots30Days = calculateAvailableSlots('30days');
  const bookedSlots30Days = countBookedSlots('30days');
  const occupancyLast30DaysPercent = availableSlots30Days > 0 ? Math.round((bookedSlots30Days / availableSlots30Days) * 100) : 0;

  // === CALCULATE AVERAGE TICKETS BASED ON COMPLETED BOOKINGS ONLY ===

  // Helper: Calculate average ticket for completed bookings
  const calculateAvgTicket = (completedBookings: any[]): number => {
    if (completedBookings.length === 0) return 0;

    const totalRevenue = completedBookings.reduce((sum, booking) => {
      return sum + getServicePrice(booking);
    }, 0);

    return Math.round(totalRevenue / completedBookings.length);
  };

  const avgTicketToday = calculateAvgTicket(completedBookingsTodayData);
  const avgTicketLast7Days = calculateAvgTicket(completedBookingsLast7DaysData);
  const avgTicketLast30Days = calculateAvgTicket(completedBookingsLast30DaysData);

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
      // New server-side occupancy calculations
      occupancyTodayPercent,
      occupancyLast7DaysPercent,
      occupancyLast30DaysPercent,
      // New server-side average ticket calculations
      avgTicketToday,
      avgTicketLast30Days,
    },
    upcomingBookings,
    staffMembers,
  };
}
