"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { format, subDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  Euro,
  BarChart3,
  User,
  TrendingUp,
  Sparkles,
  Plus,
  Scissors
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardDataset, validateDashboardKpis } from "@/lib/dashboard-data";
import { useDashboardData } from "@/hooks/useOptimizedData";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useTenant } from "@/contexts/TenantContext";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useBookingModal } from "@/contexts/BookingModalContext";

// Variantes de animación para secciones
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

type KPITrend = "up" | "down" | "neutral";

type PanelHomeClientProps = {
  impersonateOrgId: string | null;
  initialData: DashboardDataset | null;
};

function PanelHomeContent({ impersonateOrgId, initialData }: PanelHomeClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openCreate, openDetail } = useBookingModal();
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [bookingsTab, setBookingsTab] = useState<"today" | "tomorrow" | "week">("today");
  const [performancePeriod, setPerformancePeriod] = useState<"7d" | "30d">("7d");

  const currentImpersonation = useMemo(() => {
    return searchParams?.get("impersonate") || impersonateOrgId || null;
  }, [searchParams?.toString(), impersonateOrgId]);

  // Tenant: Permissions puede ir antes que el id; TenantContext (layout) suele traerlo ya.
  const { tenantId: ctxTenantId } = usePermissions();
  const { tenant: tenantFromLayout } = useTenant();
  const resolvedTenantId = ctxTenantId ?? tenantFromLayout?.id ?? null;

  // Hook optimizado: obtiene tenant + datos en UNA llamada con caché
  // No pasar enabled: !!ctxTenantId — si Permissions aún no tiene tenantId pero el layout sí,
  // el fetch quedaba desactivado y el dashboard mostraba todo a 0.
  const dashboardData = useDashboardData(currentImpersonation, {
    tenantId: resolvedTenantId,
    initialData,
    timezone: initialData?.tenant?.timezone ?? tenantFromLayout?.timezone,
  });

  const { tenant: hookTenant, kpis, upcomingBookings: rawBookings, staffMembers: rawStaffMembers, isLoading: isLoadingStats } = dashboardData;

  const tenant = hookTenant;
  const currentKpis = kpis;
  const currentUpcomingBookings = rawBookings;
  const currentStaffMembers = rawStaffMembers || [];
  const isLoading = isLoadingStats && !hookTenant;

  // Validate KPIs in development mode
  useEffect(() => {
    if (currentKpis) {
      validateDashboardKpis(currentKpis);
    }
  }, [currentKpis]);

  const tenantTimezone = tenant?.timezone || "Europe/Madrid";
  const shouldShowTimezone = tenantTimezone && tenantTimezone !== "Europe/Madrid";

  // Helper para formatear moneda
  const formatCurrency = (valueInCents: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(valueInCents / 100);
  // Normalizar KPIs → use a defensive cast to support both legacy & full shapes
  const kp = currentKpis as any;
  const stats = {
    bookingsToday: kp?.bookingsToday ?? 0,
    bookingsLast7Days: kp?.bookingsLast7Days ?? Array(7).fill(0),
    activeServices: kp?.activeServices ?? 0,
    activeStaff: kp?.activeStaff ?? 0,
    revenueToday: kp?.revenueToday ?? 0,
    totalBookingsLast7Days: kp?.totalBookingsLast7Days ?? 0,
    revenueLast7Days: kp?.revenueLast7Days ?? 0,
    totalBookingsLast30Days: kp?.totalBookingsLast30Days ?? 0,
    revenueLast30Days: kp?.revenueLast30Days ?? 0,
    noShowsLast7Days: kp?.noShowsLast7Days ?? 0,
    avgTicketLast7Days: kp?.avgTicketLast7Days ?? 0,
    newClientsToday: kp?.newClientsToday ?? 0,
    bookingsLast30DaysByDay: kp?.bookingsLast30DaysByDay ?? Array(30).fill(0),
  };

  // Transformar datos de reservas para compatibilidad con el componente
  const allBookings = (currentUpcomingBookings || []).map((booking: any) => ({
    id: booking.id,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    status: booking.status,
    customer: Array.isArray(booking.customer) ? booking.customer[0] : booking.customer,
    service: Array.isArray(booking.service) ? booking.service[0] : booking.service,
    staff: Array.isArray(booking.staff) ? booking.staff[0] : booking.staff,
  }));

  // Filtrar por día según la zona horaria del tenant (no la del navegador)
  const filteredBookings = useMemo(() => {
    const tz = tenantTimezone;
    const todayKey = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
    const zonedNow = toZonedTime(new Date(), tz);
    const tomorrowKey = formatInTimeZone(addDays(zonedNow, 1), tz, "yyyy-MM-dd");

    return allBookings.filter((booking) => {
      const bookingKey = formatInTimeZone(new Date(booking.starts_at), tz, "yyyy-MM-dd");
      switch (bookingsTab) {
        case "today":
          return bookingKey === todayKey;
        case "tomorrow":
          return bookingKey === tomorrowKey;
        case "week":
        default:
          return true;
      }
    });
  }, [allBookings, bookingsTab, tenantTimezone]);

  const upcomingBookings = filteredBookings;

  // Staff con datos reales
  const staffMembers = currentStaffMembers || [];

  // === CÁLCULOS DE TICKET MEDIO POR PERIODO - USING SERVER DATA ===
  const ticketCalculations = useMemo(() => ({
    avgTicketToday: kp?.avgTicketToday ?? 0,
    avgTicket7d: kp?.avgTicketLast7Days ?? 0,  // Using existing server-calculated field
    avgTicket30d: kp?.avgTicketLast30Days ?? 0,
  }), [kp]);

  // 🔥 Ticket medio dinámico según periodo seleccionado - USING SERVER DATA
  const currentAvgTicket = useMemo(() => {
    switch (period) {
      case "week":
        return ticketCalculations.avgTicket7d;
      case "month":
        return ticketCalculations.avgTicket30d;
      default:
        return ticketCalculations.avgTicketToday;
    }
  }, [period, ticketCalculations]);

  // 🔥 Ocupación dinámica según periodo seleccionado - USING SERVER DATA
  // Force occupancy to 0 when no staff is configured
  const currentOccupancy = useMemo(() => {
    if (staffMembers.length === 0) return 0;

    switch (period) {
      case "week":
        return kp?.occupancyLast7DaysPercent ?? 0;
      case "month":
        return kp?.occupancyLast30DaysPercent ?? 0;
      default:
        return kp?.occupancyTodayPercent ?? 0;
    }
  }, [period, kp, staffMembers.length]);

  const topServices: any[] = [];
  const operationalAlerts: any[] = [];

  const todayLabel = useMemo(() => {
    const formatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);

  const bookingsTrend = useMemo(() => {
    if (stats.bookingsLast7Days.length < 2) return "neutral";
    const last = stats.bookingsLast7Days[stats.bookingsLast7Days.length - 1];
    const previous = stats.bookingsLast7Days[stats.bookingsLast7Days.length - 2];
    if (last > previous) return "up";
    if (last < previous) return "down";
    return "neutral";
  }, [stats.bookingsLast7Days]);

  const bookingsTrendValue = useMemo(() => {
    if (stats.bookingsLast7Days.length < 2) return "";
    const last = stats.bookingsLast7Days[stats.bookingsLast7Days.length - 1];
    const previous = stats.bookingsLast7Days[stats.bookingsLast7Days.length - 2];
    const diff = last - previous;
    if (diff === 0) return "Sin cambios";
    return `${diff > 0 ? "+" : ""}${diff} vs ayer`;
  }, [stats.bookingsLast7Days]);

  // === NORMALIZACIÓN DE DATOS DIARIOS ===
  // Función para normalizar series diarias: asegura labels correctas y llena huecos con 0
  const normalizeDailySeries = useMemo(() => {
    return (daysBack: number, rawData: number[]): { values: number[]; labels: string[]; total: number } => {
      const values: number[] = [];
      const labels: string[] = [];
      let total = 0;

      // Generar fechas desde hoy hacia atrás
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const dateKey = date.toISOString().slice(0, 10);
        const dayIndex = daysBack - 1 - i; // Índice en array (0 = día más antiguo)

        // Usar dato real si existe, sino 0
        const value = rawData[dayIndex] ?? 0;
        values.push(value);
        total += value;

        // Label: mostrar día del mes, cada 3 días para legibilidad
        const shouldShowLabel = i % 3 === 0 || i === daysBack - 1; // Último día siempre
        labels.push(shouldShowLabel ? date.toLocaleDateString('es-ES', { day: 'numeric' }) : '');
      }

      return { values, labels, total };
    };
  }, []);

  // === CÁLCULOS DERIVADOS OPTIMIZADOS CON useMemo ===
  const chartCalculations = useMemo(() => {
    if (performancePeriod === "7d") {
      // Para 7 días: usar datos directos
      const values = stats.bookingsLast7Days;
      const hasValues = values.length > 0;
      const max = hasValues ? Math.max(...values, 1) : 1;
      const hasPositiveValues = values.some((value: number) => value > 0);
      const showBars = hasValues && hasPositiveValues;
      const total = values.reduce((sum: number, value: number) => sum + value, 0);
      const avg = values.length > 0 ? total / values.length : 0;

      return {
        bookingValues: values,
        chartMax: max,
        showChartBars: showBars,
        totalBookingsInRange: total,
        avgBookingsInRange: avg,
        chartLabels: [], // 7d usa lógica diferente en render
      };
    } else {
      // Para 30 días: usar normalización
      const { values, labels, total } = normalizeDailySeries(30, stats.bookingsLast30DaysByDay);
      const hasValues = values.length > 0;
      const max = hasValues ? Math.max(...values, 1) : 1;
      const hasPositiveValues = values.some((value: number) => value > 0);
      const showBars = hasValues && hasPositiveValues;
      const avg = values.length > 0 ? total / values.length : 0;

      return {
        bookingValues: values,
        chartMax: max,
        showChartBars: showBars,
        totalBookingsInRange: total,
        avgBookingsInRange: avg,
        chartLabels: labels,
      };
    }
  }, [stats.bookingsLast7Days, stats.bookingsLast30DaysByDay, performancePeriod, normalizeDailySeries]);

  const { bookingValues, chartMax, showChartBars, totalBookingsInRange, avgBookingsInRange } = chartCalculations;

  // QA Sanity Check: For 30-day chart, ensure sum of values equals total bookings
  useEffect(() => {
    if (performancePeriod === "30d" && totalBookingsInRange !== stats.totalBookingsLast30Days) {
      console.warn('[QA Check] 30-day chart total mismatch:', {
        chartTotal: totalBookingsInRange,
        expectedTotal: stats.totalBookingsLast30Days,
        difference: totalBookingsInRange - stats.totalBookingsLast30Days
      });
    }
  }, [performancePeriod, totalBookingsInRange, stats.totalBookingsLast30Days]);

  const periodOptions = [
    { id: "today", label: "Hoy" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
  ];

  // Helpers para KPIs según periodo
  const getBookingsKPI = () => {
    switch (period) {
      case "today":
        return {
          label: "Reservas hoy",
          value: stats.bookingsToday,
          trendLabel: bookingsTrendValue,
          trend: bookingsTrend as KPITrend,
        };
      case "week":
        return {
          label: "Reservas últimos 7 días",
          value: stats.totalBookingsLast7Days,
          trendLabel: "vs semana anterior",
          trend: "neutral" as KPITrend,
        };
      case "month":
        return {
          label: "Reservas últimos 30 días",
          value: stats.totalBookingsLast30Days,
          trendLabel: "vs mes anterior",
          trend: "neutral" as KPITrend,
        };
    }
  };

  const getRevenueKPI = (): { label: string; value: string; trendLabel: string; trend: KPITrend } => {
    switch (period) {
      case "today":
        return {
          label: "Ingresos hoy",
          value: formatCurrency(stats.revenueToday || 0),
          trendLabel: "vs ayer",
          trend: "neutral",
        };
      case "week":
        return {
          label: "Ingresos últimos 7 días",
          value: formatCurrency(stats.revenueLast7Days || 0),
          trendLabel: "vs semana anterior",
          trend: "neutral",
        };
      case "month":
        return {
          label: "Ingresos últimos 30 días",
          value: formatCurrency(stats.revenueLast30Days || 0),
          trendLabel: "vs mes anterior",
          trend: "neutral",
        };
    }
  };

  const getOccupancyLabel = (period: "today" | "week" | "month") => {
    if (period === "week") return "Ocupación semana";
    if (period === "month") return "Ocupación mes";
    return "Ocupación hoy";
  };

  const getTicketLabel = (period: "today" | "week" | "month") => {
    if (period === "week") return "Ticket 7d";
    if (period === "month") return "Ticket 30d";
    return "Ticket hoy";
  };

  const bookingsKPI = getBookingsKPI();
  const revenueKPI = getRevenueKPI();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {/* Container: sin px extra (PageContainer ya aplica clamp); ritmo vertical por viewport */}
        <div className="w-full min-w-0 max-w-full px-0 py-2.5 min-[400px]:py-3 sm:py-4">

          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: HERO HEADER (flotante, sin card)
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-row items-start justify-between gap-3 mb-3 sm:mb-4"
          >
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-[clamp(1rem,2.5vw+0.2rem,1.375rem)] font-semibold text-white tracking-tight leading-snug">
                {todayLabel}
              </p>
              {shouldShowTimezone && (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{tenantTimezone}</p>
              )}
            </div>

            <div className="relative shrink-0 pt-0.5">
              <label htmlFor="dashboard-period" className="sr-only">
                Periodo de métricas
              </label>
              <select
                id="dashboard-period"
                value={period}
                onChange={(e) =>
                  setPeriod(e.target.value as "today" | "week" | "month")
                }
                className={cn(
                  "h-9 min-w-[6.75rem] sm:min-w-[7.5rem] cursor-pointer appearance-none rounded-lg border border-white/10",
                  "bg-[var(--bg-card)]/70 py-2 pl-2.5 pr-8 text-xs sm:text-sm font-medium text-white",
                  "backdrop-blur-xl transition-colors",
                  "hover:border-white/15 hover:bg-[var(--bg-card)]/85",
                  "focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                )}
              >
                {periodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)] sm:h-4 sm:w-4"
                aria-hidden
              />
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="grid grid-cols-4 gap-1.5 sm:gap-3 lg:gap-4 mb-4 sm:mb-5"
          >
            {/* KPI: Reservas - Label dinámico según periodo */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(79,161,216,0.12)" }}
              onClick={() => router.push("/panel/agenda")}
              className="cursor-pointer glass min-w-0 rounded-lg sm:rounded-xl p-2 sm:p-3.5 lg:p-4 border border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-0.5 sm:gap-2 mb-1 sm:mb-2">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-emerald-500/15 shrink-0">
                  <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
                </div>
                <span className={cn(
                  "text-[10px] sm:text-xs lg:text-sm ml-auto tabular-nums leading-none",
                  bookingsKPI.trend === 'up' ? "text-emerald-400" :
                    bookingsKPI.trend === 'down' ? "text-red-400" : "text-[var(--text-secondary)]"
                )}>
                  {bookingsKPI.trend === 'up' ? '↑' : bookingsKPI.trend === 'down' ? '↓' : '~'}
                </span>
              </div>
              <div className="text-[clamp(0.8125rem,2.6vw+0.2rem,1.75rem)] font-bold text-white leading-none sm:leading-tight mb-0.5 tabular-nums">{bookingsKPI.value}</div>
              <div className="text-[0.5625rem] sm:text-xs text-[var(--text-secondary)] uppercase tracking-wide leading-tight sm:leading-normal">
                {period === 'today' ? 'Reservas hoy' : period === 'week' ? 'Reservas 7d' : 'Reservas 30d'}
              </div>
            </motion.div>

            {/* KPI: Ingresos - Label dinámico según periodo */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(52,211,153,0.12)" }}
              onClick={() => router.push("/panel/monedero")}
              className="cursor-pointer glass min-w-0 rounded-lg sm:rounded-xl p-2 sm:p-3.5 lg:p-4 border border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-0.5 sm:gap-2 mb-1 sm:mb-2">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-emerald-500/15 shrink-0">
                  <Euro className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400" />
                </div>
                <span className={cn(
                  "text-[10px] sm:text-xs lg:text-sm ml-auto tabular-nums leading-none",
                  revenueKPI.trend === 'up' ? "text-emerald-400" :
                    revenueKPI.trend === 'down' ? "text-red-400" : "text-[var(--text-secondary)]"
                )}>
                  {revenueKPI.trend === 'up' ? '↑' : revenueKPI.trend === 'down' ? '↓' : '~'}
                </span>
              </div>
              <div className="text-[clamp(0.6875rem,2.4vw+0.15rem,1.75rem)] font-bold text-white leading-none sm:leading-tight mb-0.5 tabular-nums break-all sm:break-normal">{revenueKPI.value}</div>
              <div className="text-[0.5625rem] sm:text-xs text-[var(--text-secondary)] uppercase tracking-wide leading-tight sm:leading-normal">
                {period === 'today' ? 'Ingresos hoy' : period === 'week' ? 'Ingresos 7d' : 'Ingresos 30d'}
              </div>
            </motion.div>

            {/* KPI: Ocupación - Siempre es de hoy */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(59,130,246,0.12)" }}
              onClick={() => router.push("/panel/agenda")}
              className="cursor-pointer glass min-w-0 rounded-lg sm:rounded-xl p-2 sm:p-3.5 lg:p-4 border border-white/10 hover:border-blue-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-0.5 sm:gap-2 mb-1 sm:mb-2">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-blue-500/15 shrink-0">
                  <BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400" />
                </div>
                <span className="text-[9px] sm:text-xs lg:text-sm ml-auto text-[var(--text-secondary)] tabular-nums leading-none max-sm:max-w-[2.25rem] truncate">
                  {staffMembers.length} prof.
                </span>
              </div>
              <div className="text-[clamp(0.8125rem,2.6vw+0.2rem,1.75rem)] font-bold text-white leading-none sm:leading-tight mb-0.5 tabular-nums">
                {currentOccupancy}%
              </div>
              <div className="text-[0.5625rem] sm:text-xs text-[var(--text-secondary)] uppercase tracking-wide leading-tight sm:leading-normal">{getOccupancyLabel(period)}</div>
            </motion.div>

            {/* KPI: Ticket medio - Siempre 7 días (referencia estable) */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(168,85,247,0.12)" }}
              onClick={() => router.push("/panel/monedero")}
              className="cursor-pointer glass min-w-0 rounded-lg sm:rounded-xl p-2 sm:p-3.5 lg:p-4 border border-white/10 hover:border-purple-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-0.5 mb-1 sm:mb-2">
                <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-purple-500/15 shrink-0">
                  <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-400" />
                </div>
              </div>
              <div className="text-[clamp(0.6875rem,2.4vw+0.15rem,1.75rem)] font-bold text-white leading-none sm:leading-tight mb-0.5 tabular-nums break-all sm:break-normal">{formatCurrency(currentAvgTicket)}</div>
              <div className="text-[0.5625rem] sm:text-xs text-[var(--text-secondary)] uppercase tracking-wide leading-tight sm:leading-normal">{getTicketLabel(period)}</div>
            </motion.div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              GRID PRINCIPAL - Responsive: stack en móvil, 12 cols en desktop
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-5">

            {/* ═══════════════════════════════════════════════════════════════
                FILA 3: PRÓXIMAS RESERVAS (8/12) + STAFF (4/12)
                ═══════════════════════════════════════════════════════════════ */}

            {/* Próximas reservas */}
            {/* Próximas reservas - COMPACTADO */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="hidden lg:block lg:col-span-8"
              whileHover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
            >
              <div className="glass rounded-xl border border-white/10 hover:border-white/15 transition-all overflow-hidden">
                {/* Header compacto */}
                <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-white/10">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
                    <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Próximas reservas</h2>
                    <div className="flex items-center rounded-full bg-white/10 p-0.5 text-xs">
                      {[
                        { id: "today", label: "Hoy" },
                        { id: "tomorrow", label: "Mañana" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setBookingsTab(tab.id as "today" | "tomorrow" | "week")}
                          className={cn(
                            "px-2 py-1 rounded-full transition-all duration-150",
                            bookingsTab === tab.id ? "bg-white text-slate-900 font-medium" : "text-[var(--text-secondary)] hover:text-white"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/panel/agenda")}
                    className="shrink-0 text-xs sm:text-sm text-emerald-400 hover:text-white transition-colors font-medium"
                  >
                    Ver agenda →
                  </button>
                </div>

                {/* Lista de reservas - padding reducido */}
                <div className="px-2.5 sm:px-3 py-2">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-4">
                      <Calendar className="h-6 w-6 text-[var(--text-secondary)] mx-auto mb-1" />
                      <p className="text-sm text-[var(--text-secondary)]">Sin reservas próximas</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {upcomingBookings.slice(0, 4).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between px-2 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                          onClick={() => openDetail(booking.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-sm font-semibold text-white w-10 shrink-0 font-mono tabular-nums">
                              {format(new Date(booking.starts_at), "HH:mm")}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {booking.customer?.name || "Cliente"}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)] truncate">
                                {booking.service?.name || "Servicio"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="hidden sm:block text-xs text-[var(--text-secondary)] max-w-[5rem] truncate">
                              {booking.staff?.name || "—"}
                            </span>
                            <div className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold",
                              booking.status === 'paid' ? "bg-emerald-500/20 text-emerald-400" :
                                booking.status === 'confirmed' ? "bg-blue-500/20 text-blue-400" :
                                  "bg-amber-500/20 text-amber-400"
                            )}>
                              {booking.status === 'paid' ? "Pagado" : booking.status === 'confirmed' ? "Conf." : "Pend."}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Staff - COMPACTADO con hover glow */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="lg:col-span-4"
              whileHover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
            >
              <div className="glass rounded-xl border border-white/10 hover:border-white/15 transition-all overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-2 border-b border-white/10">
                  <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Staff hoy</h2>
                  <span className="text-xs sm:text-sm text-[var(--text-secondary)] tabular-nums">{staffMembers.length} activo{staffMembers.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="px-2.5 sm:px-3 py-2 flex-1">
                  {staffMembers.length > 0 ? (
                    <div className="divide-y divide-white/[0.06]">
                      {staffMembers.slice(0, 4).map((staff: any, i: number) => {
                        const colors = ["from-blue-500 to-purple-500", "from-emerald-500 to-blue-500", "from-pink-500 to-purple-500", "from-amber-500 to-pink-500"];
                        const occ = staff.occupancyPercent || 0;
                        const initial = staff.name?.charAt(0)?.toUpperCase() || "?";
                        return (
                          <div key={staff.id} className="flex items-center justify-between py-2.5 sm:py-2 lg:py-2 first:pt-0 last:pb-0 min-h-[3rem] sm:min-h-0">
                            <div className="flex items-center gap-2">
                              {staff.avatar_url ? (
                                <img src={staff.avatar_url} alt={staff.name} className="w-7 h-7 sm:w-6 sm:h-6 rounded-full object-cover" />
                              ) : (
                                <div className={cn("w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] sm:text-xs font-bold text-white", colors[i % colors.length])}>
                                  {initial}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base text-white font-medium truncate">{staff.name}</div>
                                <div className="text-xs text-[var(--text-secondary)]">{staff.bookingsToday} cita{staff.bookingsToday !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                            <div className={cn("text-sm sm:text-base font-semibold tabular-nums", occ >= 70 ? "text-emerald-400" : occ >= 40 ? "text-blue-400" : "text-[var(--text-secondary)]")}>
                              {occ}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <User className="h-6 w-6 text-[var(--text-secondary)] mx-auto mb-1" />
                      <p className="text-sm text-[var(--text-secondary)] mb-2">Sin staff activo</p>
                      <button
                        type="button"
                        onClick={() => router.push("/panel/staff")}
                        className="text-xs sm:text-sm text-emerald-400 hover:text-white transition-colors font-medium"
                      >
                        Añadir staff →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 4: PERFORMANCE (8/12) + ACCIONES (4/12)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 pb-1 md:pb-0">
            {/* Performance - COMPACTADO */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.2 }}
              className="lg:col-span-8"
              whileHover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
            >
              <div className="glass rounded-xl border border-white/10 hover:border-white/15 transition-all overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-2 border-b border-white/10">
                  <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Performance</h2>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setPerformancePeriod("7d")}
                      className={cn(
                        "min-h-9 min-w-[2.5rem] px-2 py-1.5 text-xs sm:text-sm rounded-lg transition-colors lg:min-h-0",
                        performancePeriod === "7d" ? "bg-white/10 text-white font-medium" : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 active:bg-white/15"
                      )}
                    >7d</button>
                    <button
                      type="button"
                      onClick={() => setPerformancePeriod("30d")}
                      className={cn(
                        "min-h-9 min-w-[2.5rem] px-2 py-1.5 text-xs sm:text-sm rounded-lg transition-colors lg:min-h-0",
                        performancePeriod === "30d" ? "bg-white/10 text-white font-medium" : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 active:bg-white/15"
                      )}
                    >30d</button>
                  </div>
                </div>
                <div className="px-3 sm:px-4 py-2.5 sm:py-3">
                  {/* Header del gráfico con divisor */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.06] mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-white">Reservas diarias</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {performancePeriod === "7d" ? "Últimos 7 días" : "Últimos 30 días"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
                        {performancePeriod === "7d" ? totalBookingsInRange : stats.totalBookingsLast30Days}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">total</div>
                    </div>
                  </div>

                  {/* Gráfico: ancho fluido según viewport (no solo "móvil/desktop") */}
                  <div className="w-full max-w-full min-[420px]:max-w-[92%] sm:max-w-[88%] lg:max-w-[85%] mx-auto">
                    {showChartBars ? (
                      <div className="flex items-end gap-0.5 min-[400px]:gap-1 h-[4.25rem] min-[480px]:h-20 sm:h-24 mb-2 sm:mb-3">
                        {bookingValues.map((count: number, index: number) => {
                          const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-blue-500"
                                style={{ minHeight: count > 0 ? "4px" : "0" }}
                              />
                              <span className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums leading-none">
                                {performancePeriod === "7d"
                                  ? format(subDays(new Date(), 6 - index), "dd")
                                  : chartCalculations.chartLabels?.[index] || ""}
                              </span>
                              <span className="text-xs font-semibold text-white tabular-nums">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-9 flex items-center justify-center text-sm text-[var(--text-secondary)]">Sin datos</div>
                    )}
                  </div>

                  {/* Métricas compactas centradas - cambian según periodo */}
                  <div className="flex justify-center gap-4 sm:gap-6 pt-2 border-t border-white/[0.06]">
                    <div className="text-center min-w-0">
                      <div className="text-sm font-bold text-emerald-400 tabular-nums">
                        {formatCurrency(performancePeriod === "7d" ? stats.revenueLast7Days : stats.revenueLast30Days)}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {performancePeriod === "7d" ? "Ingresos 7d" : "Ingresos 30d"}
                      </div>
                    </div>
                    <div className="text-center min-w-0">
                      <div className="text-sm font-bold text-blue-400 tabular-nums">
                        {performancePeriod === "7d"
                          ? avgBookingsInRange.toFixed(1)
                          : (stats.totalBookingsLast30Days / 30).toFixed(1)}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {performancePeriod === "7d" ? "Media/día 7d" : "Media/día 30d"}
                      </div>
                    </div>
                    <div className="text-center min-w-0">
                      <div className="text-sm font-bold text-purple-400 tabular-nums">{formatCurrency(ticketCalculations.avgTicket7d)}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">Ticket 7d</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Acciones - solo desktop (móvil: simplificar UI) */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.25 }}
              className="hidden lg:block lg:col-span-4"
              whileHover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
            >
              <div className="glass rounded-xl border border-white/10 hover:border-white/15 transition-all overflow-hidden h-full">
                <div className="px-3 sm:px-4 py-2.5 border-b border-white/10">
                  <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">Acciones</h2>
                </div>
                <div className="px-3 py-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => openCreate()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-purple-600/90 to-emerald-500/90 text-sm font-semibold text-white transition-all duration-200 mb-2"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Nueva cita
                  </motion.button>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => router.push("/panel/clientes")}
                      className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white hover:bg-white/[0.08] transition-all"
                    >
                      <User className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                      Clientes
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/panel/agenda")}
                      className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white hover:bg-white/[0.08] transition-all"
                    >
                      <Calendar className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                      Agenda
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/[0.08]">
                    <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-2">Acceso rápido</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push("/panel/clientes")}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/panel/servicios")}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <Scissors className="h-3.5 w-3.5 shrink-0" />
                        Servicio
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function PanelHome(props: PanelHomeClientProps) {
  // Nota: este componente está envuelto por Suspense en `app/panel/dashboard/page.tsx`.
  // Evitamos Suspense anidado aquí para reducir riesgo de hydration/race issues.
  return <PanelHomeContent {...props} />;
}
