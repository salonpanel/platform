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
  const { tenant: hookTenant, kpis, upcomingBookings: rawBookings, isLoading: isLoadingStats } = dashboardData;

  // Si tenemos initialData, usarlo inmediatamente; sino usar datos del hook
  const hasInitialData = !!initialData;
  const tenant = hasInitialData ? initialData.tenant : hookTenant;
  const currentKpis = hasInitialData ? initialData.kpis : kpis;
  const currentUpcomingBookings = hasInitialData ? initialData.upcomingBookings : rawBookings;
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
  const upcomingBookings = (currentUpcomingBookings || []).map((booking: any) => ({
    id: booking.id,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    status: booking.status,
    customer: Array.isArray(booking.customer) ? booking.customer[0] : booking.customer,
    service: Array.isArray(booking.service) ? booking.service[0] : booking.service,
    staff: Array.isArray(booking.staff) ? booking.staff[0] : booking.staff,
  }));

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

  // Loading state - mostrar skeleton mientras carga
  if (isLoading && !hasInitialData) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {/* Container principal - optimizado para no-scroll en 1080p+ */}
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-12 py-2 lg:py-3">
          {/* Fila 1 – "Health bar" del negocio (12/12) */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.22, ease: "easeOut", delay: 0 }}
            className="mb-4 lg:mb-5"
          >
            {/* Header con saludo y selector de periodo */}
            <div className="flex items-center justify-between mb-4 lg:mb-5">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] font-satoshi">
                    Hola, {user?.user_metadata?.full_name?.split(' ')[0] || 'Profesional'} 👋
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Resumen de {period === 'today' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'}
                  </p>
                </div>
                {shouldShowTimezone && (
                  <span className="text-xs text-[var(--color-text-secondary)] px-2 py-1 rounded-full bg-white/5 border border-white/5">
                    {tenantTimezone}
                  </span>
                )}
              </div>

              {/* Selector de periodo + switch de barbería */}
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center rounded-full bg-white/5 p-1 text-[11px] font-satoshi border border-white/5">
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
                        "px-3 py-1.5 rounded-full transition-all duration-200",
                        period === option.id
                          ? "bg-white text-slate-900 shadow-sm font-semibold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Strip de KPIs - 6 tarjetas compactas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
              {/* Reservas de hoy */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="group cursor-pointer"
                onClick={() => (window.location.href = "/panel/agenda")}
              >
                <div className="glass p-2.5 lg:p-3 rounded-[var(--radius-lg)] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0px_8px_32px_rgba(123,92,255,0.15)]">
                  <div className="flex items-center justify-between mb-2">
                    <Calendar className="h-4 w-4 text-[var(--accent-aqua)]" />
                    <motion.div
                      animate={{
                        rotate: bookingsKPI.trend === 'up' ? 0 : bookingsKPI.trend === 'down' ? 180 : 0,
                        scale: bookingsKPI.trend ? 1 : 0.8
                      }}
                      className={cn(
                        "text-xs",
                        bookingsKPI.trend === 'up' ? "text-emerald-400" :
                        bookingsKPI.trend === 'down' ? "text-red-400" : "text-slate-400"
                      )}
                    >
                      {bookingsKPI.trend === 'up' ? '↗' : bookingsKPI.trend === 'down' ? '↘' : '→'}
                    </motion.div>
                  </div>
                  <div className="text-lg lg:text-xl font-bold text-white font-satoshi mb-0.5">
                    {bookingsKPI.value}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
                    Reservas {period === 'today' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'}
                  </div>
                  {bookingsKPI.trendLabel && (
                    <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                      {bookingsKPI.trendLabel}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Ingresos */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="group cursor-pointer"
                onClick={() => (window.location.href = "/panel/monedero")}
              >
                <div className="glass p-2.5 lg:p-3 rounded-[var(--radius-lg)] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0px_8px_32px_rgba(123,92,255,0.15)]">
                  <div className="flex items-center justify-between mb-2">
                    <Euro className="h-4 w-4 text-emerald-400" />
                    <motion.div
                      animate={{
                        rotate: revenueKPI.trend === 'up' ? 0 : revenueKPI.trend === 'down' ? 180 : 0,
                        scale: revenueKPI.trend ? 1 : 0.8
                      }}
                      className={cn(
                        "text-xs",
                        revenueKPI.trend === 'up' ? "text-emerald-400" :
                        revenueKPI.trend === 'down' ? "text-red-400" : "text-slate-400"
                      )}
                    >
                      {revenueKPI.trend === 'up' ? '↗' : revenueKPI.trend === 'down' ? '↘' : '→'}
                    </motion.div>
                  </div>
                  <div className="text-lg lg:text-xl font-bold text-white font-satoshi mb-0.5">
                    {revenueKPI.value}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
                    Ingresos {period === 'today' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'}
                  </div>
                  {revenueKPI.trendLabel && (
                    <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                      {revenueKPI.trendLabel}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Ocupación */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="group cursor-pointer"
                onClick={() => (window.location.href = "/panel/agenda")}
              >
                <div className="glass p-2.5 lg:p-3 rounded-[var(--radius-lg)] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0px_8px_32px_rgba(123,92,255,0.15)]">
                  <div className="flex items-center justify-between mb-2">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="text-lg lg:text-xl font-bold text-white font-satoshi mb-0.5">
                    {Math.round((stats.activeStaff / Math.max(stats.activeStaff + 2, 1)) * 100)}%
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
                    Ocupación
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                    {stats.activeStaff} de {stats.activeStaff + 2} sillas
                  </div>
                </div>
              </motion.div>

              {/* Clientes nuevos */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="group cursor-pointer"
                onClick={() => (window.location.href = "/panel/clientes")}
              >
                <div className="glass p-2.5 lg:p-3 rounded-[var(--radius-lg)] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0px_8px_32px_rgba(123,92,255,0.15)]">
                  <div className="flex items-center justify-between mb-2">
                    <User className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-lg lg:text-xl font-bold text-white font-satoshi mb-0.5">
                    {stats.newClientsToday || 0}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
                    Clientes nuevos
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                    {period === 'today' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'}
                  </div>
                </div>
              </motion.div>

              {/* No-shows */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="group cursor-pointer"
                onClick={() => (window.location.href = "/panel/agenda")}
              >
                <div className="glass p-2.5 lg:p-3 rounded-[var(--radius-lg)] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0px_8px_32px_rgba(123,92,255,0.15)]">
                  <div className="flex items-center justify-between mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-lg lg:text-xl font-bold text-amber-400 font-satoshi mb-0.5">
                    {stats.noShowsLast7Days}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
                    No-shows
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                    últimos 7 días
                  </div>
                </div>
              </motion.div>

              {/* Ticket medio */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="group cursor-pointer"
                onClick={() => (window.location.href = "/panel/monedero")}
              >
                <div className="glass p-2.5 lg:p-3 rounded-[var(--radius-lg)] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0px_8px_32px_rgba(123,92,255,0.15)]">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="text-lg lg:text-xl font-bold text-white font-satoshi mb-0.5">
                    {formatCurrency(avgTicketLast7Days)}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
                    Ticket medio
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                    últimos 7 días
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Grid principal de 12 columnas */}
          <div className="grid grid-cols-12 gap-3 lg:gap-4 xl:gap-5">
            {/* Fila 2 – "Qué tengo delante" (8/12 + 4/12) */}
            {/* Columna izquierda (8/12) – Próximas reservas + timeline */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.22, ease: "easeOut", delay: 0.1 }}
              className="col-span-12 lg:col-span-8"
            >
              <div className="glass rounded-[var(--radius-xl)] border border-white/10 overflow-hidden">
                <div className="p-4 lg:p-5 border-b border-white/10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-base lg:text-lg font-semibold text-white font-satoshi">Próximas reservas</h2>
                      {/* Tabs Hoy/Mañana/Semana */}
                      <div className="hidden sm:flex items-center rounded-full bg-white/5 p-0.5 text-[10px] font-satoshi border border-white/5">
                        {[
                          { id: "today", label: "Hoy" },
                          { id: "tomorrow", label: "Mañana" },
                          { id: "week", label: "Semana" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setBookingsTab(tab.id as "today" | "tomorrow" | "week")}
                            className={cn(
                              "px-2.5 py-1 rounded-full transition-all duration-200",
                              bookingsTab === tab.id
                                ? "bg-white text-slate-900 shadow-sm font-semibold"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => (window.location.href = "/panel/agenda")}
                      className="text-xs text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 transition-colors whitespace-nowrap"
                    >
                      Ver agenda →
                    </button>
                  </div>
                </div>

                <div className="p-4 lg:p-5">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-6">
                      <Calendar className="h-12 w-12 text-[var(--text-secondary)] mx-auto mb-4" />
                      <p className="text-[var(--text-secondary)]">No hay reservas próximas</p>
                      <button
                        onClick={() => (window.location.href = "/panel/agenda")}
                        className="mt-4 text-sm text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 transition-colors"
                      >
                        Programar cita →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingBookings.slice(0, 5).map((booking, index) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-200 group cursor-pointer"
                          onClick={() => (window.location.href = "/panel/agenda")}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-sm font-semibold text-white font-satoshi">
                              {format(new Date(booking.starts_at), "HH:mm")}
                            </div>
                            <div>
                              <div className="font-medium text-white">
                                {booking.customer?.name || "Cliente sin nombre"}
                              </div>
                              <div className="text-sm text-[var(--text-secondary)]">
                                {booking.service?.name || "Servicio desconocido"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-sm text-[var(--text-secondary)]">
                              {booking.staff?.name || "Sin asignar"}
                            </div>

                            {/* Estado de pago */}
                            <div className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              booking.status === 'paid' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                              booking.status === 'confirmed' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                              "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            )}>
                              {booking.status === 'paid' ? "Pagado" :
                               booking.status === 'confirmed' ? "Confirmado" : "Pendiente"}
                            </div>

                            {/* Acciones rápidas */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Llamar al cliente
                                }}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                title="Llamar"
                              >
                                <Phone className="h-4 w-4 text-[var(--accent-aqua)]" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Marcar como pagado
                                }}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                title="Marcar como pagado"
                              >
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {upcomingBookings.length > 5 && (
                        <div className="text-center pt-2">
                          <button
                            onClick={() => (window.location.href = "/panel/agenda")}
                            className="text-xs text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 transition-colors"
                          >
                            +{upcomingBookings.length - 5} más
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Columna derecha (4/12) – Staff & sillas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.22, ease: "easeOut", delay: 0.2 }}
              className="col-span-12 lg:col-span-4"
            >
              <div className="glass rounded-[var(--radius-xl)] border border-white/10 overflow-hidden h-full flex flex-col">
                <div className="p-4 lg:p-5 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base lg:text-lg font-semibold text-white font-satoshi">Staff hoy</h2>
                    <span className="text-xs text-[var(--text-secondary)]">{stats.activeStaff} activos</span>
                  </div>
                </div>

                <div className="p-4 lg:p-5 flex-1">
                  <div className="space-y-3">
                    {/* Staff members - dinámico basado en datos reales cuando estén disponibles */}
                    {stats.activeStaff > 0 ? (
                      // Placeholder: mostrar staff activos con datos simulados basados en el número real
                      Array.from({ length: Math.min(stats.activeStaff, 4) }).map((_, index) => {
                        const colors = [
                          "from-blue-500 to-purple-500",
                          "from-green-500 to-teal-500",
                          "from-amber-500 to-orange-500",
                          "from-pink-500 to-rose-500",
                        ];
                        const occupancy = Math.floor(Math.random() * 40) + 50; // 50-90%
                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                            onClick={() => (window.location.href = "/panel/staff")}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-semibold text-white",
                                colors[index % colors.length]
                              )}>
                                {String.fromCharCode(65 + index)}
                              </div>
                              <div>
                                <div className="text-xs font-medium text-white">Profesional {index + 1}</div>
                                <div className="text-[10px] text-[var(--text-secondary)]">En salón</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={cn(
                                "text-xs font-semibold",
                                occupancy >= 70 ? "text-emerald-400" : occupancy >= 40 ? "text-blue-400" : "text-slate-400"
                              )}>
                                {occupancy}%
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4">
                        <User className="h-8 w-8 text-[var(--text-secondary)] mx-auto mb-2" />
                        <p className="text-xs text-[var(--text-secondary)]">Sin staff activo hoy</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10">
                    <button
                      onClick={() => (window.location.href = "/panel/staff")}
                      className="w-full text-center text-xs text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 transition-colors"
                    >
                      Gestionar staff →
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Fila 3 – "Tendencias + tareas" (8/12 + 4/12) */}
            {/* Columna izquierda (8/12) – Performance */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.22, ease: "easeOut", delay: 0.3 }}
              className="col-span-12 lg:col-span-8"
            >
              <div className="glass rounded-[var(--radius-xl)] border border-white/10 overflow-hidden">
                <div className="p-4 lg:p-5 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base lg:text-lg font-semibold text-white font-satoshi">Performance</h2>
                    <div className="flex items-center gap-1">
                      <button className="px-2.5 py-1 text-[10px] rounded-full bg-white/10 text-white">7d</button>
                      <button className="px-2.5 py-1 text-[10px] rounded-full bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 transition-colors">30d</button>
                    </div>
                  </div>
                </div>

                <div className="p-4 lg:p-5">
                  {/* Gráfico de reservas - versión compacta */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xs font-semibold text-white">Reservas diarias</h3>
                        <p className="text-[10px] text-[var(--text-secondary)]">Últimos 7 días</p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-white">{totalLast7Days}</div>
                        <div className="text-[10px] text-[var(--text-secondary)]">total</div>
                      </div>
                    </div>

                    {showChartBars ? (
                      <div className="flex items-end gap-1.5 relative min-h-[80px]">
                        {bookingValues.map((count: number, index: number) => {
                          const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                          return (
                            <div
                              key={index}
                              className="flex-1 flex flex-col items-center justify-end h-full relative group"
                            >
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: `${height}%`, opacity: 1 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                whileHover={{ scale: 1.03, y: -2 }}
                                className="w-full rounded-t gradient-aurora-1 relative overflow-hidden cursor-pointer"
                                style={{
                                  minHeight: count > 0 ? "6px" : "0",
                                  borderRadius: "3px 3px 0 0",
                                  boxShadow: count > 0 ? "0px 2px 8px rgba(123,92,255,0.25)" : "none",
                                }}
                              />
                              <div className="text-[9px] text-[var(--text-secondary)] mt-1">
                                {format(subDays(new Date(), 6 - index), "dd")}
                              </div>
                              <div className="text-[10px] font-semibold text-white">
                                {count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <p className="text-xs text-[var(--text-secondary)]">Sin datos</p>
                      </div>
                    )}
                  </div>

                  {/* Métricas en línea - compactas */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
                    <div className="text-center">
                      <div className="text-sm font-bold text-emerald-400">{formatCurrency(stats.revenueLast7Days || 0)}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">Ingresos 7d</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-blue-400">{avgLast7Days.toFixed(1)}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">Media/día</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-purple-400">{formatCurrency(avgTicketLast7Days)}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">Ticket</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Columna derecha (4/12) – Operación diaria */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.22, ease: "easeOut", delay: 0.4 }}
              className="col-span-12 lg:col-span-4"
            >
              <div className="glass rounded-[var(--radius-xl)] border border-white/10 overflow-hidden h-full flex flex-col">
                <div className="p-4 lg:p-5 border-b border-white/10">
                  <h2 className="text-base lg:text-lg font-semibold text-white font-satoshi">Acciones</h2>
                </div>

                <div className="p-4 lg:p-5 flex-1 flex flex-col gap-4">
                  {/* Acciones rápidas - primero para mayor visibilidad */}
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => (window.location.href = "/panel/agenda")}
                        className="p-2.5 rounded-lg bg-gradient-to-r from-[var(--accent-aqua)] to-[var(--accent-purple)] text-white text-xs font-medium hover:shadow-[0px_4px_16px_rgba(123,92,255,0.35)] transition-all duration-200"
                      >
                        <Plus className="h-3.5 w-3.5 mx-auto mb-0.5" />
                        Nueva cita
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => (window.location.href = "/panel/clientes")}
                        className="p-2.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-medium hover:bg-white/15 transition-all duration-200"
                      >
                        <User className="h-3.5 w-3.5 mx-auto mb-0.5" />
                        Cliente
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => (window.location.href = "/panel/agenda")}
                        className="p-2.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-medium hover:bg-white/15 transition-all duration-200"
                      >
                        <Calendar className="h-3.5 w-3.5 mx-auto mb-0.5" />
                        Agenda
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => (window.location.href = "/panel/chat")}
                        className="p-2.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-medium hover:bg-white/15 transition-all duration-200"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mx-auto mb-0.5" />
                        Chat
                      </motion.button>
                    </div>
                  </div>

                  {/* Alertas - más compactas */}
                  {operationalAlerts.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-2">Alertas</h3>
                      <div className="space-y-1.5">
                        {operationalAlerts.slice(0, 2).map((alert, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "rounded px-2 py-1.5 text-[10px]",
                              alert.type === "danger" && "bg-red-500/10 border border-red-500/20 text-red-300",
                              alert.type === "warning" && "bg-amber-500/10 border border-amber-500/20 text-amber-300",
                              alert.type === "info" && "bg-sky-500/10 border border-sky-500/20 text-sky-300"
                            )}
                          >
                            {alert.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
