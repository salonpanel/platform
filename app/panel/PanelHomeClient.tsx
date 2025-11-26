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
        transition={{ duration: 0.25 }}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {/* Container principal - COMPACTO sin scroll en 1080p+ */}
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-5 xl:px-6 py-3">
          
          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: HERO HEADER + KPIs (12/12)
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass rounded-xl border border-white/10 p-3 lg:p-4 mb-4"
          >
            {/* Header integrado en contenedor */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-lg lg:text-xl font-semibold text-white font-satoshi">
                    Hola, {user?.user_metadata?.full_name?.split(' ')[0] || 'Profesional'} 👋
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {todayLabel} · {tenantName}
                  </p>
                </div>
                {shouldShowTimezone && (
                  <span className="hidden sm:inline text-[10px] text-[var(--text-secondary)] px-2 py-0.5 rounded-full bg-white/5">
                    {tenantTimezone}
                  </span>
                )}
              </div>

              {/* Selector de periodo */}
              <div className="inline-flex items-center rounded-full bg-white/5 p-0.5 text-[10px] font-satoshi border border-white/5">
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
                      "px-2.5 py-1 rounded-full transition-all duration-150",
                      period === option.id
                        ? "bg-white text-slate-900 font-semibold"
                        : "text-[var(--text-secondary)] hover:text-white"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Strip de KPIs - 6 tarjetas UNIFORMES */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* KPI: Reservas */}
              <div 
                onClick={() => (window.location.href = "/panel/agenda")}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <Calendar className="h-3.5 w-3.5 text-[var(--accent-aqua)]" />
                  <span className={cn(
                    "text-[10px]",
                    bookingsKPI.trend === 'up' ? "text-emerald-400" :
                    bookingsKPI.trend === 'down' ? "text-red-400" : "text-slate-500"
                  )}>
                    {bookingsKPI.trend === 'up' ? '↗' : bookingsKPI.trend === 'down' ? '↘' : '→'}
                  </span>
                </div>
                <div className="text-lg font-bold text-white font-satoshi leading-none">{bookingsKPI.value}</div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">Reservas</div>
              </div>

              {/* KPI: Ingresos */}
              <div 
                onClick={() => (window.location.href = "/panel/monedero")}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <Euro className="h-3.5 w-3.5 text-emerald-400" />
                  <span className={cn(
                    "text-[10px]",
                    revenueKPI.trend === 'up' ? "text-emerald-400" :
                    revenueKPI.trend === 'down' ? "text-red-400" : "text-slate-500"
                  )}>
                    {revenueKPI.trend === 'up' ? '↗' : revenueKPI.trend === 'down' ? '↘' : '→'}
                  </span>
                </div>
                <div className="text-lg font-bold text-white font-satoshi leading-none">{revenueKPI.value}</div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">Ingresos</div>
              </div>

              {/* KPI: Ocupación */}
              <div 
                onClick={() => (window.location.href = "/panel/agenda")}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="text-lg font-bold text-white font-satoshi leading-none">
                  {Math.round((stats.activeStaff / Math.max(stats.activeStaff + 2, 1)) * 100)}%
                </div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">Ocupación</div>
              </div>

              {/* KPI: Clientes nuevos */}
              <div 
                onClick={() => (window.location.href = "/panel/clientes")}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <User className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <div className="text-lg font-bold text-white font-satoshi leading-none">{stats.newClientsToday || 0}</div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">Nuevos</div>
              </div>

              {/* KPI: No-shows */}
              <div 
                onClick={() => (window.location.href = "/panel/agenda")}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="text-lg font-bold text-amber-400 font-satoshi leading-none">{stats.noShowsLast7Days}</div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">No-shows</div>
              </div>

              {/* KPI: Ticket medio */}
              <div 
                onClick={() => (window.location.href = "/panel/monedero")}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <div className="text-lg font-bold text-white font-satoshi leading-none">{formatCurrency(avgTicketLast7Days)}</div>
                <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">Ticket</div>
              </div>
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              GRID PRINCIPAL: FILAS 2 Y 3 (gap reducido 24px)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-4">
            {/* ═══════════════════════════════════════════════════════════════
                FILA 2: PRÓXIMAS RESERVAS (8/12) + STAFF (4/12)
                ═══════════════════════════════════════════════════════════════ */}
            
            {/* Próximas reservas - 8 columnas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="col-span-12 lg:col-span-8"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden h-full">
                {/* Header compacto con acción alineada a la derecha */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-white font-satoshi">Próximas reservas</h2>
                    <div className="hidden sm:flex items-center rounded-full bg-white/5 p-0.5 text-[9px] font-satoshi">
                      {[
                        { id: "today", label: "Hoy" },
                        { id: "tomorrow", label: "Mañana" },
                        { id: "week", label: "Semana" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setBookingsTab(tab.id as "today" | "tomorrow" | "week")}
                          className={cn(
                            "px-2 py-0.5 rounded-full transition-all",
                            bookingsTab === tab.id ? "bg-white text-slate-900 font-semibold" : "text-[var(--text-secondary)]"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => (window.location.href = "/panel/agenda")}
                    className="text-[10px] text-[var(--accent-aqua)] hover:text-white transition-colors"
                  >
                    Ver agenda →
                  </button>
                </div>

                {/* Lista de reservas - compacta */}
                <div className="p-2">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-6">
                      <Calendar className="h-8 w-8 text-[var(--text-secondary)] mx-auto mb-2" />
                      <p className="text-xs text-[var(--text-secondary)]">Sin reservas próximas</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {upcomingBookings.slice(0, 4).map((booking, index) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                          onClick={() => (window.location.href = "/panel/agenda")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-semibold text-white w-10">
                              {format(new Date(booking.starts_at), "HH:mm")}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">
                                {booking.customer?.name || "Cliente"}
                              </div>
                              <div className="text-[10px] text-[var(--text-secondary)] truncate">
                                {booking.service?.name || "Servicio"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="hidden sm:block text-[10px] text-[var(--text-secondary)]">
                              {booking.staff?.name?.split(' ')[0] || "—"}
                            </span>
                            <div className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-medium",
                              booking.status === 'paid' ? "bg-emerald-500/20 text-emerald-400" :
                              booking.status === 'confirmed' ? "bg-blue-500/20 text-blue-400" :
                              "bg-amber-500/20 text-amber-400"
                            )}>
                              {booking.status === 'paid' ? "✓" : booking.status === 'confirmed' ? "●" : "○"}
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); }} className="p-1 hover:bg-white/10 rounded">
                                <Phone className="h-3 w-3 text-[var(--accent-aqua)]" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); }} className="p-1 hover:bg-white/10 rounded">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {upcomingBookings.length > 4 && (
                        <button
                          onClick={() => (window.location.href = "/panel/agenda")}
                          className="w-full text-center text-[10px] text-[var(--accent-aqua)] py-1"
                        >
                          +{upcomingBookings.length - 4} más
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Staff hoy - 4 columnas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="col-span-12 lg:col-span-4"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden h-full flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <h2 className="text-sm font-semibold text-white font-satoshi">Staff</h2>
                  <span className="text-[10px] text-[var(--text-secondary)]">{stats.activeStaff} activos</span>
                </div>
                <div className="p-2 flex-1">
                  {stats.activeStaff > 0 ? (
                    <div className="space-y-1">
                      {Array.from({ length: Math.min(stats.activeStaff, 3) }).map((_, i) => {
                        const colors = ["from-blue-500 to-purple-500", "from-green-500 to-teal-500", "from-amber-500 to-orange-500"];
                        const occ = [85, 60, 40][i] || 50;
                        return (
                          <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-bold text-white", colors[i])}>
                                {String.fromCharCode(65 + i)}
                              </div>
                              <div className="text-[10px] text-white">Prof. {i + 1}</div>
                            </div>
                            <div className={cn("text-[10px] font-semibold", occ >= 70 ? "text-emerald-400" : occ >= 40 ? "text-blue-400" : "text-slate-400")}>
                              {occ}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <User className="h-6 w-6 text-[var(--text-secondary)] mx-auto mb-1" />
                      <p className="text-[10px] text-[var(--text-secondary)]">Sin staff</p>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 border-t border-white/10">
                  <button onClick={() => (window.location.href = "/panel/staff")} className="w-full text-[10px] text-[var(--accent-aqua)]">
                    Gestionar →
                  </button>
                </div>
              </div>
            </motion.div>

            {/* ═══════════════════════════════════════════════════════════════
                FILA 3: PERFORMANCE (8/12) + ACCIONES (4/12)
                ═══════════════════════════════════════════════════════════════ */}
            
            {/* Performance - 8 columnas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="col-span-12 lg:col-span-8"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                  <h2 className="text-sm font-semibold text-white font-satoshi">Performance</h2>
                  <div className="flex gap-1">
                    <button className="px-2 py-0.5 text-[9px] rounded-full bg-white/10 text-white">7d</button>
                    <button className="px-2 py-0.5 text-[9px] rounded-full bg-white/5 text-[var(--text-secondary)]">30d</button>
                  </div>
                </div>
                <div className="p-3">
                  {/* Gráfico compacto */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[var(--text-secondary)]">Reservas últimos 7 días</span>
                    <span className="text-sm font-bold text-white">{totalLast7Days}</span>
                  </div>
                  {showChartBars ? (
                    <div className="flex items-end gap-1 h-14 mb-3">
                      {bookingValues.map((count: number, index: number) => {
                        const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full rounded-t gradient-aurora-1"
                              style={{ height: `${height}%`, minHeight: count > 0 ? "4px" : "0" }}
                            />
                            <span className="text-[8px] text-[var(--text-secondary)] mt-0.5">{format(subDays(new Date(), 6 - index), "dd")}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-14 flex items-center justify-center text-[10px] text-[var(--text-secondary)]">Sin datos</div>
                  )}
                  {/* Métricas inline */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <div className="text-center">
                      <div className="text-xs font-bold text-emerald-400">{formatCurrency(stats.revenueLast7Days || 0)}</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">Ingresos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-blue-400">{avgLast7Days.toFixed(1)}</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">Media/día</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-purple-400">{formatCurrency(avgTicketLast7Days)}</div>
                      <div className="text-[9px] text-[var(--text-secondary)]">Ticket</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Acciones - 4 columnas, COMPACTO */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.2 }}
              className="col-span-12 lg:col-span-4"
            >
              <div className="glass rounded-xl border border-white/10 overflow-hidden h-full flex flex-col">
                <div className="px-3 py-2 border-b border-white/10">
                  <h2 className="text-sm font-semibold text-white font-satoshi">Acciones rápidas</h2>
                </div>
                <div className="p-2 flex-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => (window.location.href = "/panel/agenda")}
                      className="flex flex-col items-center justify-center p-2 rounded-lg bg-gradient-to-r from-[var(--accent-aqua)] to-[var(--accent-purple)] text-white hover:shadow-lg transition-all"
                    >
                      <Plus className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px] font-medium">Nueva cita</span>
                    </button>
                    <button
                      onClick={() => (window.location.href = "/panel/clientes")}
                      className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all"
                    >
                      <User className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px] font-medium">Cliente</span>
                    </button>
                    <button
                      onClick={() => (window.location.href = "/panel/agenda")}
                      className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all"
                    >
                      <Calendar className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px] font-medium">Agenda</span>
                    </button>
                    <button
                      onClick={() => (window.location.href = "/panel/chat")}
                      className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all"
                    >
                      <MessageSquare className="h-4 w-4 mb-0.5" />
                      <span className="text-[10px] font-medium">Chat</span>
                    </button>
                  </div>
                </div>
                {/* Alertas opcionales */}
                {operationalAlerts.length > 0 && (
                  <div className="px-2 py-2 border-t border-white/10">
                    <div className="space-y-1">
                      {operationalAlerts.slice(0, 2).map((alert, idx) => (
                        <div key={idx} className={cn(
                          "px-2 py-1 rounded text-[9px]",
                          alert.type === "danger" ? "bg-red-500/10 text-red-300" :
                          alert.type === "warning" ? "bg-amber-500/10 text-amber-300" : "bg-sky-500/10 text-sky-300"
                        )}>
                          {alert.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
