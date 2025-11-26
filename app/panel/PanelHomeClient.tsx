"use client";

import { useState, useEffect, useMemo, Suspense, ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MiniKPI } from "@/components/panel/MiniKPI";
import { UpcomingAppointments } from "@/components/panel/UpcomingAppointments";
import { MessagesWidget } from "@/components/panel/MessagesWidget";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Calendar,
  Euro,
  BarChart3,
  User,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Phone,
  CheckCircle2,
  MessageSquare,
  Plus,
  Scissors
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardDataset } from "@/lib/dashboard-data";
import { useDashboardData } from "@/hooks/useOptimizedData";
import { usePermissions } from "@/contexts/PermissionsContext";
import { DashboardSkeleton } from "@/components/ui/Skeletons";

const QUICK_LINKS: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  { href: "/panel/agenda", label: "Agenda", icon: Calendar, desc: "Ver reservas" },
  { href: "/panel/clientes", label: "Clientes", icon: User, desc: "Gestionar clientes" },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors, desc: "Gestionar servicios" },
  { href: "/panel/staff", label: "Staff", icon: User, desc: "Gestionar staff" },
];

// Clase base común para todas las cards del dashboard
const cardBaseClass = cn(
  "relative rounded-2xl border border-white/5",
  "bg-[rgba(15,23,42,0.85)] backdrop-blur-xl",
  "shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
  "px-4 py-3 sm:px-5 sm:py-4",
  "transition-transform transition-shadow duration-150 ease-out",
  "hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]"
);

// Variantes de animación para secciones
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

type TopService = {
  serviceId: string;
  name: string;
  count: number;
};

type OperationalAlert = {
  type: "info" | "warning" | "danger";
  title: string;
  description: string;
};

type KPITrend = "up" | "down" | "neutral";

type PanelHomeClientProps = {
  impersonateOrgId: string | null;
  initialData: DashboardDataset | null;
};

function PanelHomeContent({ impersonateOrgId, initialData }: PanelHomeClientProps) {
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [bookingsTab, setBookingsTab] = useState<"today" | "tomorrow" | "week">("today");
  const [prefetchedData, setPrefetchedData] = useState<DashboardDataset | null>(null);

  const currentImpersonation = useMemo(() => {
    return searchParams?.get("impersonate") || impersonateOrgId || null;
  }, [searchParams?.toString(), impersonateOrgId]);

  // Preferir tenantId del contexto (ya cargado por el layout) para evitar volver a resolver tenant
  const { tenantId: ctxTenantId } = usePermissions();

  // 🔥 DETECTAR DATOS PREFETCHED POST-AUTENTICACIÓN
  useEffect(() => {
    // Si ya tenemos initialData del servidor, no necesitamos prefetch adicional
    if (initialData) return;

    // Si no tenemos tenantId aún, esperar
    if (!ctxTenantId) return;

    console.log('[PanelHome] 🔄 No hay initialData, intentando prefetch desde API...');

    // Hacer petición al prefetch API para obtener datos frescos
    fetch('/api/prefetch/panel-data', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    })
      .then(response => response.json())
      .then(data => {
        if (data.ok && data.data) {
          console.log('[PanelHome] ✅ Datos prefetched obtenidos del API');
          // Guardar en sessionStorage para uso inmediato
          sessionStorage.setItem('prefetched-panel-data', JSON.stringify({
            data: data.data,
            timestamp: data.timestamp
          }));
          // Forzar re-render con los nuevos datos
          setPrefetchedData(data.data);
        }
      })
      .catch(error => {
        console.warn('[PanelHome] Error en prefetch desde API:', error);
      });
  }, [initialData, ctxTenantId]);

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

  const tenantId = tenant?.id || null;
  const tenantTimezone = tenant?.timezone || "Europe/Madrid";
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

  // 🔥 Filtrar reservas según el tab seleccionado
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

  // 🔥 Calcular ocupación REAL basada en citas del staff
  const totalOccupancy = useMemo(() => {
    if (staffMembers.length === 0) return 0;
    
    // Sumar todas las citas de hoy de todos los staff
    const totalBookingsToday = staffMembers.reduce((sum: number, staff: any) => 
      sum + (staff.bookingsToday || 0), 0);
    
    // Capacidad máxima: 8 citas por staff por día
    const maxCapacity = staffMembers.length * 8;
    
    if (maxCapacity === 0) return 0;
    return Math.min(Math.round((totalBookingsToday / maxCapacity) * 100), 100);
  }, [staffMembers]);

  const topServices: TopService[] = [];
  const operationalAlerts: OperationalAlert[] = [];

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

  // Cálculos derivados optimizados con useMemo
  const chartCalculations = useMemo(() => {
    const values = Array.isArray(stats.bookingsLast7Days) ? stats.bookingsLast7Days : [];
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
      totalLast7Days: total,
      avgLast7Days: avg,
    };
  }, [stats.bookingsLast7Days]);

  const { bookingValues, chartMax, showChartBars, totalLast7Days, avgLast7Days } = chartCalculations;

  // Métricas avanzadas: ticket medio y tasa de no-show
  const { avgTicketLast7Days, noShowRateLast7Days } = useMemo(() => {
    const { totalBookingsLast7Days, revenueLast7Days, noShowsLast7Days } = stats;

    const avgTicket = stats.avgTicketLast7Days
      ? stats.avgTicketLast7Days
      : totalBookingsLast7Days > 0
        ? revenueLast7Days / totalBookingsLast7Days
        : 0;

    const noShowRate =
      totalBookingsLast7Days > 0 ? noShowsLast7Days / totalBookingsLast7Days : 0;

    return {
      avgTicketLast7Days: avgTicket,
      noShowRateLast7Days: noShowRate,
    };
  }, [stats]);

  const showOnboardingHint =
    stats.bookingsToday === 0 && !chartCalculations.showChartBars && upcomingBookings.length === 0;
  const shouldShowTimezone = tenantTimezone && tenantTimezone !== "Europe/Madrid";

  // Helper para formatear moneda
  const formatCurrency = (valueInCents: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(valueInCents / 100);

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

  const bookingsKPI = getBookingsKPI();
  const revenueKPI = getRevenueKPI();

  // Estados del componente
  const [user, setUser] = useState<any>(null);

  // Efecto para obtener información del usuario
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await import("@supabase/auth-helpers-nextjs").then(({ createClientComponentClient }) => {
          const supabase = createClientComponentClient();
          return supabase.auth.getUser();
        });
        setUser(user);
      } catch (error) {
        console.error("Error obteniendo usuario:", error);
      }
    };

    getUser();
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
        {/* Container principal - INTEGRADO en la página */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          
          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: HERO HEADER (flotante, sin card)
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-5"
          >
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-semibold text-white tracking-tight leading-[1.2]">
                Hola, {userName} 👋
              </h1>
              <p className="text-[12px] sm:text-[13px] text-[var(--text-secondary)] mt-0.5">
                {todayLabel} {shouldShowTimezone && `· ${tenantTimezone}`}
              </p>
            </div>

            {/* Selector de periodo */}
            <div className="inline-flex items-center self-start sm:self-auto rounded-full bg-[var(--bg-card)]/60 backdrop-blur-xl p-1 text-[12px] sm:text-[13px] border border-white/10">
              {[
                { id: "today", label: "Hoy" },
                { id: "week", label: "Semana" },
                { id: "month", label: "Mes" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id as "today" | "week" | "month")}
                  className={cn(
                    "px-3 sm:px-4 py-1.5 rounded-full transition-all duration-150",
                    period === option.id
                      ? "bg-white text-slate-900 font-semibold shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-white"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 2: KPIs - 4 Tarjetas GLASS (estilo azulado premium)
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"
          >
            {/* KPI: Reservas */}
            <motion.div 
              whileHover={{ y: -2 }}
              onClick={() => (window.location.href = "/panel/agenda")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-[var(--accent-aqua)]/40 transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-[var(--accent-aqua)]/15">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-aqua)]" />
                </div>
                <span className={cn(
                  "text-[11px] sm:text-[12px] ml-auto",
                  bookingsKPI.trend === 'up' ? "text-emerald-400" :
                  bookingsKPI.trend === 'down' ? "text-red-400" : "text-[var(--text-secondary)]"
                )}>
                  {bookingsKPI.trend === 'up' ? '↑' : bookingsKPI.trend === 'down' ? '↓' : '~'} hoy
                </span>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">{bookingsKPI.value}</div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">Reservas</div>
            </motion.div>

            {/* KPI: Ingresos */}
            <motion.div 
              whileHover={{ y: -2 }}
              onClick={() => (window.location.href = "/panel/monedero")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-emerald-500/40 transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
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
                  {revenueKPI.trend === 'up' ? '↑' : revenueKPI.trend === 'down' ? '↓' : '~'} hoy
                </span>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">{revenueKPI.value}</div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">Ingresos</div>
            </motion.div>

            {/* KPI: Ocupación - CALCULADA DESDE STAFF REAL */}
            <motion.div 
              whileHover={{ y: -2 }}
              onClick={() => (window.location.href = "/panel/agenda")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-blue-500/40 transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
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
                {totalOccupancy}%
              </div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">Ocupación hoy</div>
            </motion.div>

            {/* KPI: Ticket medio */}
            <motion.div 
              whileHover={{ y: -2 }}
              onClick={() => (window.location.href = "/panel/monedero")}
              className="cursor-pointer glass rounded-xl p-3 sm:p-4 border border-white/10 hover:border-purple-500/40 transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-purple-500/15">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                </div>
              </div>
              <div className="text-[22px] sm:text-[26px] font-bold text-white leading-[1.2] mb-0.5">{formatCurrency(avgTicketLast7Days)}</div>
              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">Ticket medio</div>
            </motion.div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              GRID PRINCIPAL - Responsive: stack en móvil, 12 cols en desktop
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mb-6">
            
            {/* ═══════════════════════════════════════════════════════════════
                FILA 3: PRÓXIMAS RESERVAS (8/12) + STAFF (4/12)
                ═══════════════════════════════════════════════════════════════ */}
            
            {/* Próximas reservas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="lg:col-span-8"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-white/10 gap-2 sm:gap-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[16px] sm:text-[18px] font-semibold text-white">Próximas reservas</h2>
                    <div className="flex items-center rounded-full bg-white/10 p-0.5 text-[11px] sm:text-[12px]">
                      {[
                        { id: "today", label: "Hoy" },
                        { id: "tomorrow", label: "Mañana" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setBookingsTab(tab.id as "today" | "tomorrow" | "week")}
                          className={cn(
                            "px-2.5 sm:px-3 py-1 rounded-full transition-all duration-150",
                            bookingsTab === tab.id ? "bg-white text-slate-900 font-medium" : "text-[var(--text-secondary)] hover:text-white"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => (window.location.href = "/panel/agenda")}
                    className="text-[12px] sm:text-[13px] text-[var(--accent-aqua)] hover:text-white transition-colors font-medium self-end sm:self-auto"
                  >
                    Ver agenda →
                  </button>
                </div>

                {/* Lista de reservas */}
                <div className="p-3 sm:p-4">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-8 w-8 text-[var(--text-secondary)] mx-auto mb-2" />
                      <p className="text-[13px] text-[var(--text-secondary)]">Sin reservas próximas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingBookings.slice(0, 4).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all cursor-pointer"
                          onClick={() => (window.location.href = "/panel/agenda")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-[13px] sm:text-[14px] font-bold text-white w-10 sm:w-12 font-mono">
                              {format(new Date(booking.starts_at), "HH:mm")}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] sm:text-[14px] font-medium text-white truncate">
                                {booking.customer?.name || "Cliente"}
                              </div>
                              <div className="text-[11px] sm:text-[12px] text-[var(--text-secondary)] truncate">
                                {booking.service?.name || "Servicio"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="hidden sm:block text-[11px] text-[var(--text-secondary)]">
                              {booking.staff?.name || "—"}
                            </span>
                            <div className={cn(
                              "px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold",
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

            {/* Staff - datos REALES */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="lg:col-span-4"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h2 className="text-[16px] sm:text-[18px] font-semibold text-white">Staff hoy</h2>
                  <span className="text-[11px] sm:text-[12px] text-[var(--text-secondary)]">{staffMembers.length} activo{staffMembers.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="p-3 sm:p-4 flex-1">
                  {staffMembers.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {staffMembers.slice(0, 4).map((staff: any, i: number) => {
                        const colors = ["from-blue-500 to-purple-500", "from-emerald-500 to-blue-500", "from-pink-500 to-purple-500", "from-amber-500 to-pink-500"];
                        const occ = staff.occupancyPercent || 0;
                        const initial = staff.name?.charAt(0)?.toUpperCase() || "?";
                        return (
                          <div key={staff.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2.5">
                              {staff.avatar_url ? (
                                <img src={staff.avatar_url} alt={staff.name} className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className={cn("w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white", colors[i % colors.length])}>
                                  {initial}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[13px] sm:text-[14px] text-white font-medium truncate">{staff.name}</div>
                                <div className="text-[10px] text-[var(--text-secondary)]">{staff.bookingsToday} cita{staff.bookingsToday !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                            <div className={cn("text-[13px] sm:text-[14px] font-semibold", occ >= 70 ? "text-emerald-400" : occ >= 40 ? "text-blue-400" : "text-[var(--text-secondary)]")}>
                              {occ}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <User className="h-7 w-7 text-[var(--text-secondary)] mx-auto mb-1.5" />
                      <p className="text-[12px] text-[var(--text-secondary)]">Sin staff activo</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 4: PERFORMANCE (8/12) + ACCIONES (4/12)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Performance */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.2 }}
              className="lg:col-span-8"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h2 className="text-[16px] sm:text-[18px] font-semibold text-white">Performance</h2>
                  <div className="flex gap-1.5">
                    <button className="px-2.5 py-1 text-[11px] sm:text-[12px] rounded-lg bg-white/10 text-white font-medium">7d</button>
                    <button className="px-2.5 py-1 text-[11px] sm:text-[12px] rounded-lg bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 transition-colors">30d</button>
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  {/* Header del gráfico */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                    <div>
                      <h3 className="text-[13px] sm:text-[14px] font-medium text-white">Reservas diarias</h3>
                      <p className="text-[11px] sm:text-[12px] text-[var(--text-secondary)]">Últimos 7 días</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] sm:text-[20px] font-bold text-white">{totalLast7Days}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">total</div>
                    </div>
                  </div>

                  {/* Gráfico de barras */}
                  <div className="max-w-full sm:max-w-[90%] mx-auto">
                    {showChartBars ? (
                      <div className="flex items-end gap-2 sm:gap-3 h-12 sm:h-14 mb-4">
                        {bookingValues.map((count: number, index: number) => {
                          const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="w-full rounded-t bg-gradient-to-t from-[var(--accent-aqua)] to-[var(--accent-purple)]"
                                style={{ minHeight: count > 0 ? "4px" : "0" }}
                              />
                              <span className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] mt-1">{format(subDays(new Date(), 6 - index), "dd")}</span>
                              <span className="text-[11px] sm:text-[12px] font-semibold text-white">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-12 flex items-center justify-center text-[13px] text-[var(--text-secondary)]">Sin datos</div>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="flex justify-center gap-6 sm:gap-10 pt-3 border-t border-white/5">
                    <div className="text-center">
                      <div className="text-[14px] sm:text-[16px] font-bold text-emerald-400">{formatCurrency(stats.revenueLast7Days || 0)}</div>
                      <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">Ingresos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[14px] sm:text-[16px] font-bold text-blue-400">{avgLast7Days.toFixed(1)}</div>
                      <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">Media/día</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[14px] sm:text-[16px] font-bold text-purple-400">{formatCurrency(avgTicketLast7Days)}</div>
                      <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)]">Ticket</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Acciones */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.25 }}
              className="lg:col-span-4"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden h-full">
                <div className="px-4 py-3 border-b border-white/10">
                  <h2 className="text-[16px] sm:text-[18px] font-semibold text-white">Acciones</h2>
                </div>
                <div className="p-3 sm:p-4">
                  {/* Botón principal CTA */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => (window.location.href = "/panel/agenda")}
                    className="w-full flex items-center justify-center gap-2 p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-aqua)] text-white font-semibold transition-all duration-200 mb-3 shadow-lg shadow-purple-500/20"
                  >
                    <Plus className="h-4 sm:h-[18px] w-4 sm:w-[18px]" />
                    <span className="text-[14px] sm:text-[15px]">Nueva cita</span>
                  </motion.button>

                  {/* Botones secundarios */}
                  <div className="space-y-1.5 mb-3">
                    <button
                      onClick={() => (window.location.href = "/panel/clientes")}
                      className="w-full flex items-center gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                    >
                      <User className="h-4 w-4 text-[var(--text-secondary)]" />
                      <span className="text-[13px] sm:text-[14px]">Clientes</span>
                    </button>
                    <button
                      onClick={() => (window.location.href = "/panel/agenda")}
                      className="w-full flex items-center gap-2.5 p-2.5 sm:p-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                    >
                      <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                      <span className="text-[13px] sm:text-[14px]">Agenda</span>
                    </button>
                  </div>

                  {/* Acciones rápidas */}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">Rápido</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => (window.location.href = "/panel/clientes")}
                        className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 text-[var(--text-secondary)] mb-0.5" />
                        <span className="text-[9px] text-[var(--text-secondary)]">Cliente</span>
                      </button>
                      <button
                        onClick={() => (window.location.href = "/panel/agenda")}
                        className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
                      >
                        <Calendar className="h-3.5 w-3.5 text-[var(--text-secondary)] mb-0.5" />
                        <span className="text-[9px] text-[var(--text-secondary)]">Agenda</span>
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
