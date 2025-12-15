"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Calendar,
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
import { getSupabaseBrowser } from "@/lib/supabase/browser";
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
  const [prefetchedData, setPrefetchedData] = useState<DashboardDataset | null>(null);

  const currentImpersonation = useMemo(() => {
    return searchParams?.get("impersonate") || impersonateOrgId || null;
  }, [searchParams?.toString(), impersonateOrgId]);

  // Preferir tenantId del contexto (ya cargado por el layout) para evitar volver a resolver tenant
  const { tenantId: ctxTenantId } = usePermissions();

  // Prefetch logic removed (Phase 15.1)

  // Hook optimizado: obtiene tenant + datos en UNA llamada con caché
  const dashboardData = useDashboardData(currentImpersonation, {
    tenantId: ctxTenantId,
    initialData: prefetchedData || initialData, // 🔥 Usar datos prefetched si disponibles
    timezone: (prefetchedData?.tenant?.timezone) || initialData?.tenant?.timezone,
    enabled: !!ctxTenantId, // Solo ejecutar cuando tenemos tenantId válido
  });

  // Extraer datos del hook o usar initialData si está disponible
  const { tenant: hookTenant, kpis, upcomingBookings: rawBookings, staffMembers: rawStaffMembers, isLoading: isLoadingStats } = dashboardData;

  // Si tenemos initialData, usarlo inmediatamente; sino usar datos del hook
  const hasInitialData = !!initialData;
  const tenant = hasInitialData ? initialData.tenant : hookTenant;
  const currentKpis = hasInitialData ? initialData.kpis : kpis;
  const currentUpcomingBookings = hasInitialData ? initialData.upcomingBookings : rawBookings;
  const currentStaffMembers = hasInitialData ? (initialData as any).staffMembers || [] : rawStaffMembers || [];
  const isLoading = hasInitialData ? false : isLoadingStats;

  // Validate KPIs in development mode
  useEffect(() => {
    if (currentKpis) {
      validateDashboardKpis(currentKpis);
    }
  }, [currentKpis]);

  const tenantId = tenant?.id || null;
  const tenantTimezone = tenant?.timezone || "Europe/Madrid";
  const shouldShowTimezone = tenantTimezone && tenantTimezone !== "Europe/Madrid";

  // Helper para formatear moneda
  const formatCurrency = (valueInCents: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(valueInCents / 100);
  const tenantName = tenant?.name || "Tu barbería";

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

  // Filtrar reservas según el tab seleccionado
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrowStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    return allBookings.filter((booking) => {
      const bookingDate = new Date(booking.starts_at);
      switch (bookingsTab) {
        case "today":
          return bookingDate >= todayStart && bookingDate < tomorrowStart;
        case "tomorrow":
          return bookingDate >= tomorrowStart && bookingDate < dayAfterTomorrow;
        case "week":
        default:
          return true; // Mostrar todas las próximas
      }
    });
  }, [allBookings, bookingsTab]);

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

  const dayStatus = useMemo((): { label: string; color: string } => {
    const todayOcc = currentOccupancy;
    if (todayOcc < 40) return { label: "Día tranquilo", color: "bg-emerald-500/20 text-emerald-400" };
    if (todayOcc < 70) return { label: "Día equilibrado", color: "bg-blue-500/20 text-blue-400" };
    return { label: "Día lleno", color: "bg-amber-500/20 text-amber-400" };
  }, [currentOccupancy]);

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

  // Estados del componente
  const [user, setUser] = useState<any>(null);

  // Efecto para obtener información del usuario - usando getSupabaseBrowser como TopBar
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error("Error obteniendo usuario:", error);
      }
    };
    loadUser();
  }, []);

  // Obtener nombre del usuario de múltiples fuentes
  const userName = useMemo(() => {
    // 1. Intentar desde user_metadata
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    if (fullName) {
      // Devolver solo el primer nombre
      return fullName.split(' ')[0];
    }

    // 2. Intentar desde el email (parte antes del @)
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      // Capitalizar primera letra
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }

    // 3. Fallback
    return 'Profesional';
  }, [user]);

  // Loading state - mostrar skeleton mientras carga
  if (isLoading && !hasInitialData) {
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
        {/* Container principal - OPTIMIZADO para viewport */}
        <div className="w-full px-3 sm:px-4 lg:px-6 py-2 sm:py-3">

          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: HERO HEADER (flotante, sin card)
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4"
          >
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-white tracking-tight leading-[1.2] mb-0.5">
                Hola, {userName} 👋
              </h1>
              <p className="text-[11px] sm:text-[12px] text-[var(--text-secondary)]">
                {todayLabel} {shouldShowTimezone && `· ${tenantTimezone}`}
              </p>
            </div>

            {/* Estado del día + Selector de periodo */}
            <div className="flex items-center gap-2.5">
              <div className={cn("px-2 py-1 rounded-full text-[10px] font-medium", dayStatus.color)}>
                {dayStatus.label}
              </div>

              {/* Selector de periodo */}
              <div className="inline-flex items-center rounded-full bg-[var(--bg-card)]/60 backdrop-blur-xl p-0.5 text-[11px] sm:text-[12px] border border-white/10">
                {periodOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPeriod(option.id as "today" | "week" | "month")}
                    className={cn(
                      "px-2.5 sm:px-3 py-1 rounded-full transition-all duration-150",
                      period === option.id
                        ? "bg-white text-slate-900 font-semibold shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-white"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5"
          >
            {/* KPI: Reservas - Label dinámico según periodo */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(79,227,193,0.12)" }}
              onClick={() => router.push("/panel/agenda")}
              className="cursor-pointer glass rounded-xl p-2.5 sm:p-3 border border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className={cn(
                  "text-[11px] sm:text-[12px] ml-auto",
                  bookingsKPI.trend === 'up' ? "text-emerald-400" :
                    bookingsKPI.trend === 'down' ? "text-red-400" : "text-[var(--text-secondary)]"
                )}>
                  {bookingsKPI.trend === 'up' ? '↑' : bookingsKPI.trend === 'down' ? '↓' : '~'}
                </span>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">{bookingsKPI.value}</div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                {period === 'today' ? 'Reservas hoy' : period === 'week' ? 'Reservas 7d' : 'Reservas 30d'}
              </div>
            </motion.div>

            {/* KPI: Ingresos - Label dinámico según periodo */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(52,211,153,0.12)" }}
              onClick={() => router.push("/panel/monedero")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15">
                  <Euro className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className={cn(
                  "text-[11px] sm:text-[12px] ml-auto",
                  revenueKPI.trend === 'up' ? "text-emerald-400" :
                    revenueKPI.trend === 'down' ? "text-red-400" : "text-[var(--text-secondary)]"
                )}>
                  {revenueKPI.trend === 'up' ? '↑' : revenueKPI.trend === 'down' ? '↓' : '~'}
                </span>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">{revenueKPI.value}</div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                {period === 'today' ? 'Ingresos hoy' : period === 'week' ? 'Ingresos 7d' : 'Ingresos 30d'}
              </div>
            </motion.div>

            {/* KPI: Ocupación - Siempre es de hoy */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(59,130,246,0.12)" }}
              onClick={() => router.push("/panel/agenda")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-blue-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <span className="text-[11px] sm:text-[12px] ml-auto text-[var(--text-secondary)]">
                  {staffMembers.length} prof.
                </span>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">
                {currentOccupancy}%
              </div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">{getOccupancyLabel(period)}</div>
            </motion.div>

            {/* KPI: Ticket medio - Siempre 7 días (referencia estable) */}
            <motion.div
              whileHover={{ y: -1, boxShadow: "0 12px 40px rgba(168,85,247,0.12)" }}
              onClick={() => router.push("/panel/monedero")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-purple-500/30 hover:bg-white/[0.03] transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-purple-500/15">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                </div>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">{formatCurrency(currentAvgTicket)}</div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">{getTicketLabel(period)}</div>
            </motion.div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              GRID PRINCIPAL - Responsive: stack en móvil, 12 cols en desktop
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 mb-4">

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
              className="lg:col-span-8"
              whileHover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
            >
              <div className="glass rounded-xl border border-white/10 hover:border-white/15 transition-all overflow-hidden">
                {/* Header compacto */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[14px] sm:text-[15px] font-semibold text-white">Próximas reservas</h2>
                    <div className="flex items-center rounded-full bg-white/10 p-0.5 text-[9px] sm:text-[10px]">
                      {[
                        { id: "today", label: "Hoy" },
                        { id: "tomorrow", label: "Mañana" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setBookingsTab(tab.id as "today" | "tomorrow" | "week")}
                          className={cn(
                            "px-1.5 sm:px-2 py-0.5 rounded-full transition-all duration-150",
                            bookingsTab === tab.id ? "bg-white text-slate-900 font-medium" : "text-[var(--text-secondary)] hover:text-white"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/panel/agenda")}
                    className="text-[10px] sm:text-[11px] text-emerald-400 hover:text-white transition-colors font-medium"
                  >
                    Ver agenda →
                  </button>
                </div>

                {/* Lista de reservas - padding reducido */}
                <div className="px-2.5 py-2">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-4">
                      <Calendar className="h-6 w-6 text-[var(--text-secondary)] mx-auto mb-1" />
                      <p className="text-[11px] text-[var(--text-secondary)]">Sin reservas próximas</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {upcomingBookings.slice(0, 4).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                          onClick={() => openDetail(booking.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] sm:text-[12px] font-bold text-white w-9 font-mono">
                              {format(new Date(booking.starts_at), "HH:mm")}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] sm:text-[12px] font-medium text-white truncate">
                                {booking.customer?.name || "Cliente"}
                              </div>
                              <div className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] truncate">
                                {booking.service?.name || "Servicio"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="hidden sm:block text-[9px] text-[var(--text-secondary)]">
                              {booking.staff?.name || "—"}
                            </span>
                            <div className={cn(
                              "px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold",
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
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <h2 className="text-[14px] sm:text-[15px] font-semibold text-white">Staff hoy</h2>
                  <span className="text-[9px] sm:text-[10px] text-[var(--text-secondary)]">{staffMembers.length} activo{staffMembers.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="px-2.5 py-2 flex-1">
                  {staffMembers.length > 0 ? (
                    <div className="divide-y divide-white/[0.06]">
                      {staffMembers.slice(0, 4).map((staff: any, i: number) => {
                        const colors = ["from-blue-500 to-purple-500", "from-emerald-500 to-blue-500", "from-pink-500 to-purple-500", "from-amber-500 to-pink-500"];
                        const occ = staff.occupancyPercent || 0;
                        const initial = staff.name?.charAt(0)?.toUpperCase() || "?";
                        return (
                          <div key={staff.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2">
                              {staff.avatar_url ? (
                                <img src={staff.avatar_url} alt={staff.name} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className={cn("w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-bold text-white", colors[i % colors.length])}>
                                  {initial}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[12px] sm:text-[13px] text-white font-medium truncate">{staff.name}</div>
                                <div className="text-[9px] text-[var(--text-secondary)]">{staff.bookingsToday} cita{staff.bookingsToday !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                            <div className={cn("text-[12px] sm:text-[13px] font-semibold", occ >= 70 ? "text-emerald-400" : occ >= 40 ? "text-blue-400" : "text-[var(--text-secondary)]")}>
                              {occ}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <User className="h-6 w-6 text-[var(--text-secondary)] mx-auto mb-1" />
                      <p className="text-[11px] text-[var(--text-secondary)] mb-2">Sin staff activo</p>
                      <button
                        onClick={() => router.push("/panel/staff")}
                        className="text-[9px] text-emerald-400 hover:text-white transition-colors font-medium"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
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
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <h2 className="text-[14px] sm:text-[15px] font-semibold text-white">Performance</h2>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setPerformancePeriod("7d")}
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded-lg transition-colors",
                        performancePeriod === "7d" ? "bg-white/10 text-white font-medium" : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
                      )}
                    >7d</button>
                    <button
                      onClick={() => setPerformancePeriod("30d")}
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded-lg transition-colors",
                        performancePeriod === "30d" ? "bg-white/10 text-white font-medium" : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
                      )}
                    >30d</button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  {/* Header del gráfico con divisor */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06] mb-2">
                    <div>
                      <h3 className="text-[11px] sm:text-[12px] font-medium text-white">Reservas diarias</h3>
                      <p className="text-[9px] sm:text-[10px] text-[var(--text-secondary)]">
                        {performancePeriod === "7d" ? "Últimos 7 días" : "Últimos 30 días"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] sm:text-[16px] font-bold text-white">
                        {performancePeriod === "7d" ? totalBookingsInRange : stats.totalBookingsLast30Days}
                      </div>
                      <div className="text-[8px] text-[var(--text-secondary)]">total</div>
                    </div>
                  </div>

                  {/* Gráfico de barras - max-w-[85%] centrado */}
                  <div className="max-w-[85%] mx-auto">
                    {showChartBars ? (
                      <div className="flex items-end gap-1 h-9 sm:h-10 mb-2">
                        {bookingValues.map((count: number, index: number) => {
                          const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-blue-500"
                                style={{ minHeight: count > 0 ? "2px" : "0" }}
                              />
                              <span className="text-[7px] sm:text-[8px] text-[var(--text-secondary)] mt-0.5">
                                {performancePeriod === "7d"
                                  ? format(subDays(new Date(), 6 - index), "dd")
                                  : chartCalculations.chartLabels?.[index] || ""}
                              </span>
                              <span className="text-[9px] sm:text-[10px] font-semibold text-white">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-9 flex items-center justify-center text-[11px] text-[var(--text-secondary)]">Sin datos</div>
                    )}
                  </div>

                  {/* Métricas compactas centradas - cambian según periodo */}
                  <div className="flex justify-center gap-3 sm:gap-4 pt-1.5 border-t border-white/[0.06]">
                    <div className="text-center">
                      <div className="text-[11px] sm:text-[12px] font-bold text-emerald-400">
                        {formatCurrency(performancePeriod === "7d" ? stats.revenueLast7Days : stats.revenueLast30Days)}
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-[var(--text-secondary)]">
                        {performancePeriod === "7d" ? "Ingresos 7d" : "Ingresos 30d"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] sm:text-[12px] font-bold text-blue-400">
                        {performancePeriod === "7d"
                          ? avgBookingsInRange.toFixed(1)
                          : (stats.totalBookingsLast30Days / 30).toFixed(1)}
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-[var(--text-secondary)]">
                        {performancePeriod === "7d" ? "Media/día 7d" : "Media/día 30d"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] sm:text-[12px] font-bold text-purple-400">{formatCurrency(ticketCalculations.avgTicket7d)}</div>
                      <div className="text-[8px] sm:text-[9px] text-[var(--text-secondary)]">Ticket 7d</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Acciones - COMPACTADO */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.25 }}
              className="lg:col-span-4"
              whileHover={{ boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
            >
              <div className="glass rounded-xl border border-white/10 hover:border-white/15 transition-all overflow-hidden h-full">
                <div className="px-3 py-2 border-b border-white/10">
                  <h2 className="text-[14px] sm:text-[15px] font-semibold text-white">Acciones</h2>
                </div>
                <div className="px-2.5 py-2">
                  {/* Botón principal CTA - saturación reducida, altura reducida */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => openCreate()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-purple-600/90 to-emerald-500/90 text-white font-semibold transition-all duration-200 mb-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-[12px] sm:text-[13px]">Nueva cita</span>
                  </motion.button>

                  {/* Botones secundarios - mismo height */}
                  <div className="space-y-1">
                    <button
                      onClick={() => router.push("/panel/clientes")}
                      className="w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] transition-all"
                    >
                      <User className="h-3 w-3 text-[var(--text-secondary)]" />
                      <span className="text-[11px] sm:text-[12px]">Clientes</span>
                    </button>
                    <button
                      onClick={() => router.push("/panel/agenda")}
                      className="w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] transition-all"
                    >
                      <Calendar className="h-3 w-3 text-[var(--text-secondary)]" />
                      <span className="text-[11px] sm:text-[12px]">Agenda</span>
                    </button>
                  </div>

                  {/* Separador + Acciones rápidas */}
                  <div className="mt-2 pt-1.5 border-t border-white/[0.08]">
                    <p className="text-[8px] text-[var(--text-secondary)]/80 uppercase tracking-wider mb-1">Acceso rápido</p>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => router.push("/panel/clientes")}
                        className="flex items-center justify-center gap-1 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                      >
                        <Plus className="h-2.5 w-2.5 text-[var(--text-secondary)]" />
                        <span className="text-[8px] text-[var(--text-secondary)]">Cliente</span>
                      </button>
                      <button
                        onClick={() => router.push("/panel/servicios")}
                        className="flex items-center justify-center gap-1 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                      >
                        <Scissors className="h-2.5 w-2.5 text-[var(--text-secondary)]" />
                        <span className="text-[8px] text-[var(--text-secondary)]">Servicio</span>
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
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PanelHomeContent {...props} />
    </Suspense>
  );
}
