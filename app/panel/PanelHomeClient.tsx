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
    <div className="h-full flex flex-col overflow-hidden bg-[#0E0F11]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {/* Container principal - BOOKFAST DESIGN SYSTEM */}
        <div className="max-w-[1920px] mx-auto px-6 lg:px-8 xl:px-10 py-6 lg:py-8">
          
          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: HERO HEADER (flotante, sin card)
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center justify-between mb-4"
          >
            <div>
              <h1 className="text-[28px] font-semibold text-white tracking-tight leading-[1.2]">
                Hola, {user?.user_metadata?.full_name?.split(' ')[0] || 'Profesional'} 👋
              </h1>
              <p className="text-[13px] text-white/55 mt-1">
                {todayLabel} {shouldShowTimezone && `· ${tenantTimezone}`}
              </p>
            </div>

            {/* Selector de periodo - DS compliant */}
            <div className="inline-flex items-center rounded-[9999px] bg-white/8 backdrop-blur-[12px] p-1 text-[13px] border border-white/6">
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
                    "px-4 py-1.5 rounded-[9999px] transition-all duration-150",
                    period === option.id
                      ? "bg-white text-[#0E0F11] font-semibold"
                      : "text-white/55 hover:text-white"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 2: KPIs - 4 Tarjetas (grid fijo, hover glow)
              Espaciado: mb-10 (40px) para crear jerarquía visual
              ═══════════════════════════════════════════════════════════════ */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
          >
            {/* KPI: Reservas */}
            <motion.div 
              whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(79,227,193,0.15)" }}
              onClick={() => (window.location.href = "/panel/agenda")}
              className="cursor-pointer bg-[#15171A] rounded-[14px] p-4 border border-white/6 hover:border-[#4FE3C1]/30 transition-all duration-150 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[8px] bg-[#4FE3C1]/10">
                  <TrendingUp className="h-[14px] w-[14px] text-[#4FE3C1]" />
                </div>
                <span className={cn(
                  "text-[12px] ml-auto",
                  bookingsKPI.trend === 'up' ? "text-[#4FE3C1]" :
                  bookingsKPI.trend === 'down' ? "text-[#EF4444]" : "text-white/40"
                )}>
                  {bookingsKPI.trend === 'up' ? '↑' : bookingsKPI.trend === 'down' ? '↓' : '~'} hoy
                </span>
              </div>
              <div className="text-[26px] font-bold text-white leading-[1.2] mb-0.5">{bookingsKPI.value}</div>
              <div className="text-[12px] text-white/50 uppercase tracking-wider">Reservas</div>
            </motion.div>

            {/* KPI: Ingresos */}
            <motion.div 
              whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(79,227,193,0.15)" }}
              onClick={() => (window.location.href = "/panel/monedero")}
              className="cursor-pointer bg-[#15171A] rounded-[14px] p-4 border border-white/6 hover:border-[#4FE3C1]/30 transition-all duration-150 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[8px] bg-[#4FE3C1]/10">
                  <Euro className="h-[14px] w-[14px] text-[#4FE3C1]" />
                </div>
                <span className={cn(
                  "text-[12px] ml-auto",
                  revenueKPI.trend === 'up' ? "text-[#4FE3C1]" :
                  revenueKPI.trend === 'down' ? "text-[#EF4444]" : "text-white/40"
                )}>
                  {revenueKPI.trend === 'up' ? '↑' : revenueKPI.trend === 'down' ? '↓' : '~'} hoy
                </span>
              </div>
              <div className="text-[26px] font-bold text-white leading-[1.2] mb-0.5">{revenueKPI.value}</div>
              <div className="text-[12px] text-white/50 uppercase tracking-wider">Ingresos hoy</div>
            </motion.div>

            {/* KPI: Ocupación */}
            <motion.div 
              whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(58,109,255,0.15)" }}
              onClick={() => (window.location.href = "/panel/agenda")}
              className="cursor-pointer bg-[#15171A] rounded-[14px] p-4 border border-white/6 hover:border-[#3A6DFF]/30 transition-all duration-150 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[8px] bg-[#3A6DFF]/10">
                  <BarChart3 className="h-[14px] w-[14px] text-[#3A6DFF]" />
                </div>
              </div>
              <div className="text-[26px] font-bold text-white leading-[1.2] mb-0.5">
                {Math.round((stats.activeStaff / Math.max(stats.activeStaff + 2, 1)) * 100)}%
              </div>
              <div className="text-[12px] text-white/50 uppercase tracking-wider">Ocupación</div>
            </motion.div>

            {/* KPI: Ticket medio */}
            <motion.div 
              whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(160,107,255,0.15)" }}
              onClick={() => (window.location.href = "/panel/monedero")}
              className="cursor-pointer bg-[#15171A] rounded-[14px] p-4 border border-white/6 hover:border-[#A06BFF]/30 transition-all duration-150 shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[8px] bg-[#A06BFF]/10">
                  <Sparkles className="h-[14px] w-[14px] text-[#A06BFF]" />
                </div>
              </div>
              <div className="text-[26px] font-bold text-white leading-[1.2] mb-0.5">{formatCurrency(avgTicketLast7Days)}</div>
              <div className="text-[12px] text-white/50 uppercase tracking-wider">Ticket medio</div>
            </motion.div>
          </motion.div>

          {/* ═══════════════════════════════════════════════════════════════
              GRID PRINCIPAL: 12 columnas estrictas
              Fila Reservas+Staff: mb-8 (32px)
              Fila Performance+Acciones: mb-6 (24px)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-6 mb-8">
            
            {/* ═══════════════════════════════════════════════════════════════
                FILA 3: PRÓXIMAS RESERVAS (8/12) + STAFF (4/12)
                ═══════════════════════════════════════════════════════════════ */}
            
            {/* Próximas reservas - 8 columnas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="col-span-12 lg:col-span-8"
            >
              <div className="bg-[#15171A] rounded-[14px] border border-white/6 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-shadow duration-200">
                {/* Header con "Ver agenda" integrado */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[18px] font-semibold text-white leading-[1.2]">Próximas reservas</h2>
                    <div className="hidden sm:flex items-center rounded-[9999px] bg-white/8 p-0.5 text-[12px] border border-white/6">
                      {[
                        { id: "today", label: "Hoy" },
                        { id: "tomorrow", label: "Mañana" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setBookingsTab(tab.id as "today" | "tomorrow" | "week")}
                          className={cn(
                            "px-3 py-1 rounded-[9999px] transition-all duration-150",
                            bookingsTab === tab.id ? "bg-white text-[#0E0F11] font-medium" : "text-white/55 hover:text-white"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => (window.location.href = "/panel/agenda")}
                    className="text-[13px] text-[#3A6DFF] hover:text-[#4FE3C1] transition-colors duration-150 font-medium"
                  >
                    Ver agenda →
                  </button>
                </div>

                {/* Lista de reservas - padding reducido */}
                <div className="px-5 py-4">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-9 w-9 text-white/25 mx-auto mb-2" />
                      <p className="text-[14px] text-white/50">Sin reservas próximas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingBookings.slice(0, 4).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-white/3 hover:bg-white/6 border border-white/6 hover:border-white/10 transition-all duration-150 cursor-pointer"
                          onClick={() => (window.location.href = "/panel/agenda")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-[14px] font-bold text-white w-11 font-mono">
                              {format(new Date(booking.starts_at), "HH:mm")}
                            </div>
                            <div>
                              <div className="text-[14px] font-medium text-white">
                                {booking.customer?.name || "Cliente"}
                              </div>
                              <div className="text-[12px] text-white/50">
                                {booking.service?.name || "Servicio"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="hidden sm:block text-[12px] text-white/50">
                              {booking.staff?.name || "—"}
                            </span>
                            <div className={cn(
                              "px-2 py-0.5 rounded-[6px] text-[11px] font-semibold",
                              booking.status === 'paid' ? "bg-[#4FE3C1]/20 text-[#4FE3C1]" :
                              booking.status === 'confirmed' ? "bg-[#3A6DFF]/20 text-[#3A6DFF]" :
                              "bg-[#FFC107]/20 text-[#FFC107]"
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

            {/* Staff - 4 columnas con divisores */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="col-span-12 lg:col-span-4"
            >
              <div className="bg-[#15171A] rounded-[14px] border border-white/6 overflow-hidden h-full flex flex-col shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-shadow duration-200">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
                  <h2 className="text-[18px] font-semibold text-white leading-[1.2]">Staff hoy</h2>
                  <span className="text-[12px] text-white/50">{stats.activeStaff} activo</span>
                </div>
                <div className="px-4 pt-4 pb-3 flex-1">
                  {stats.activeStaff > 0 ? (
                    <div className="divide-y divide-white/5">
                      {Array.from({ length: Math.min(stats.activeStaff, 3) }).map((_, i) => {
                        const colors = ["from-[#3A6DFF] to-[#A06BFF]", "from-[#4FE3C1] to-[#3A6DFF]", "from-[#FF6DA3] to-[#A06BFF]"];
                        const occ = [85, 64, 48][i] || 50;
                        return (
                          <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white", colors[i])}>
                                {String.fromCharCode(65 + i)}
                              </div>
                              <div className="text-[14px] text-white font-medium">Prof. {i + 1}</div>
                            </div>
                            <div className={cn("text-[14px] font-semibold", occ >= 70 ? "text-[#4FE3C1]" : occ >= 40 ? "text-[#3A6DFF]" : "text-white/40")}>
                              {occ}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <User className="h-7 w-7 text-white/25 mx-auto mb-1.5" />
                      <p className="text-[13px] text-white/50">Sin staff activo</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 4: PERFORMANCE (8/12) + ACCIONES (4/12)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-6">
            {/* Performance - 8 columnas */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.2 }}
              className="col-span-12 lg:col-span-8"
            >
              <div className="bg-[#15171A] rounded-[14px] border border-white/6 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-shadow duration-200">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
                  <h2 className="text-[18px] font-semibold text-white leading-[1.2]">Performance</h2>
                  <div className="flex gap-1.5">
                    <button className="px-2.5 py-1 text-[12px] rounded-[8px] bg-white/10 text-white font-medium">7d</button>
                    <button className="px-2.5 py-1 text-[12px] rounded-[8px] bg-white/5 text-white/50 hover:bg-white/8 transition-colors duration-150">30d</button>
                  </div>
                </div>
                <div className="p-5">
                  {/* Header del gráfico con divisor */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                    <div>
                      <h3 className="text-[14px] font-medium text-white">Reservas diarias</h3>
                      <p className="text-[12px] text-white/50">Últimos 7 días</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[20px] font-bold text-white leading-[1.2]">{totalLast7Days}</div>
                      <div className="text-[12px] text-white/50">total</div>
                    </div>
                  </div>

                  {/* Gráfico de barras - centrado al 85% */}
                  <div className="max-w-[85%] mx-auto">
                    {showChartBars ? (
                      <div className="flex items-end gap-3 h-14 mb-5">
                        {bookingValues.map((count: number, index: number) => {
                          const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="w-full rounded-t-[3px] bg-gradient-to-t from-[#4FE3C1] to-[#3A6DFF]"
                                style={{ minHeight: count > 0 ? "4px" : "0" }}
                              />
                              <span className="text-[10px] text-white/40 mt-1.5">{format(subDays(new Date(), 6 - index), "dd")}</span>
                              <span className="text-[12px] font-semibold text-white">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-14 flex items-center justify-center text-[14px] text-white/50">Sin datos suficientes</div>
                    )}
                  </div>

                  {/* Métricas centradas */}
                  <div className="flex justify-center gap-10 pt-4 border-t border-white/5">
                    <div className="text-center">
                      <div className="text-[16px] font-bold text-[#4FE3C1]">{formatCurrency(stats.revenueLast7Days || 0)}</div>
                      <div className="text-[11px] text-white/50">Ingresos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[16px] font-bold text-[#3A6DFF]">{avgLast7Days.toFixed(1)}</div>
                      <div className="text-[11px] text-white/50">Media/día</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[16px] font-bold text-[#A06BFF]">{formatCurrency(avgTicketLast7Days)}</div>
                      <div className="text-[11px] text-white/50">Ticket</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Acciones - 4 columnas con glass blur */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
              transition={{ duration: 0.2, delay: 0.25 }}
              className="col-span-12 lg:col-span-4"
            >
              <div className="bg-[#15171A]/95 backdrop-blur-[12px] rounded-[14px] border border-white/6 overflow-hidden h-full shadow-[0_6px_20px_rgba(0,0,0,0.45)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-shadow duration-200">
                <div className="px-5 py-3.5 border-b border-white/6">
                  <h2 className="text-[18px] font-semibold text-white leading-[1.2]">Acciones</h2>
                </div>
                <div className="p-4">
                  {/* Botón principal CTA - Gradient más sutil */}
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(79,227,193,0.2)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => (window.location.href = "/panel/agenda")}
                    className="w-full flex items-center justify-center gap-2 p-3.5 rounded-[14px] bg-gradient-to-r from-[#8B5CF6] to-[#4FE3C1] text-white font-semibold transition-all duration-200 mb-3"
                  >
                    <Plus className="h-[18px] w-[18px]" />
                    <span className="text-[15px]">Nueva cita</span>
                  </motion.button>

                  {/* Botones secundarios - Glass */}
                  <div className="space-y-1.5 mb-4">
                    <button
                      onClick={() => (window.location.href = "/panel/clientes")}
                      className="w-full flex items-center gap-2.5 p-3 rounded-[10px] bg-white/5 border border-white/10 text-white hover:bg-white/8 hover:border-white/15 transition-all duration-150"
                    >
                      <User className="h-[16px] w-[16px] text-white/50" />
                      <span className="text-[14px]">Clientes</span>
                    </button>
                    <button
                      onClick={() => (window.location.href = "/panel/agenda")}
                      className="w-full flex items-center gap-2.5 p-3 rounded-[10px] bg-white/5 border border-white/10 text-white hover:bg-white/8 hover:border-white/15 transition-all duration-150"
                    >
                      <Calendar className="h-[16px] w-[16px] text-white/50" />
                      <span className="text-[14px]">Agenda</span>
                    </button>
                  </div>

                  {/* Acciones rápidas integradas */}
                  <div className="pt-3 border-t border-white/6">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Acciones rápidas</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => (window.location.href = "/panel/clientes")}
                        className="flex-1 flex flex-col items-center p-2.5 rounded-[10px] bg-white/5 border border-white/6 hover:bg-white/8 transition-all"
                      >
                        <Plus className="h-[14px] w-[14px] text-white/50 mb-1" />
                        <span className="text-[10px] text-white/50">Cliente</span>
                      </button>
                      <button
                        onClick={() => (window.location.href = "/panel/agenda")}
                        className="flex-1 flex flex-col items-center p-2.5 rounded-[10px] bg-white/5 border border-white/6 hover:bg-white/8 transition-all"
                      >
                        <Calendar className="h-[14px] w-[14px] text-white/50 mb-1" />
                        <span className="text-[10px] text-white/50">Agenda</span>
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
