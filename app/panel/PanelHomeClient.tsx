"use client";

import { useState, Suspense, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MiniKPI } from "@/components/panel/MiniKPI";
import { UpcomingAppointments } from "@/components/panel/UpcomingAppointments";
import { MessagesWidget } from "@/components/panel/MessagesWidget";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { ComponentType } from "react";
import { Calendar, Users, Scissors, User, ArrowRight, Euro, Sparkles } from "lucide-react";
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
  { href: "/panel/clientes", label: "Clientes", icon: Users, desc: "Gestionar clientes" },
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

type PanelHomeClientProps = {
  impersonateOrgId: string | null;
  initialData: DashboardDataset | null;
};

function PanelHomeContent({ impersonateOrgId, initialData }: PanelHomeClientProps) {
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
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
          trend: bookingsTrend as "up" | "down" | "neutral",
        };
      case "week":
        return {
          label: "Reservas últimos 7 días",
          value: stats.totalBookingsLast7Days,
          trendLabel: "vs semana anterior",
          trend: "neutral" as const,
        };
      case "month":
        return {
          label: "Reservas últimos 30 días",
          value: stats.totalBookingsLast30Days,
          trendLabel: "vs mes anterior",
          trend: "neutral" as const,
        };
    }
  };

  const getRevenueKPI = () => {
    switch (period) {
      case "today":
        return {
          label: "Ingresos hoy",
          value: formatCurrency(stats.revenueToday || 0),
          trendLabel: "vs ayer",
          trend: "neutral" as const,
        };
      case "week":
        return {
          label: "Ingresos últimos 7 días",
          value: formatCurrency(stats.revenueLast7Days || 0),
          trendLabel: "vs semana anterior",
          trend: "neutral" as const,
        };
      case "month":
        return {
          label: "Ingresos últimos 30 días",
          value: formatCurrency(stats.revenueLast30Days || 0),
          trendLabel: "vs mes anterior",
          trend: "neutral" as const,
        };
    }
  };

  const bookingsKPI = getBookingsKPI();
  const revenueKPI = getRevenueKPI();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex-1 p-4 sm:p-6 lg:p-8"
      >
        {/* Header minimalista - solo selector de periodo */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0 }}
          className="flex items-center justify-end mb-6"
        >
          <div className="flex items-center gap-2">
            {shouldShowTimezone && (
              <span className="text-xs text-[var(--color-text-secondary)] px-2 py-1 rounded-full bg-white/5 border border-white/5 mr-4">
                {tenantTimezone}
              </span>
            )}
            <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">Periodo:</span>
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
                    "px-3 py-1 rounded-full transition-all duration-200",
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
        </motion.div>

        {/* Layout Masonry - Grid responsive con altura uniforme por fila */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-fr"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {/* KPIs principales - tamaño compacto */}
          <div className="col-span-1">
            <MiniKPI
              title={bookingsKPI.label}
              value={bookingsKPI.value}
              trend={bookingsKPI.trend}
              trendValue={bookingsKPI.trendLabel}
              icon={<Calendar className="h-4 w-4" />}
              onClick={() => (window.location.href = "/panel/agenda")}
            />
          </div>
          <div className="col-span-1">
            <MiniKPI
              title={revenueKPI.label}
              value={revenueKPI.value}
              trend={revenueKPI.trend}
              trendValue={revenueKPI.trendLabel}
              icon={<Euro className="h-4 w-4" />}
              onClick={() => (window.location.href = "/panel/monedero")}
            />
          </div>
          <div className="col-span-1">
            <MiniKPI
              title="Servicios activos"
              value={stats.activeServices}
              icon={<Scissors className="h-4 w-4" />}
              onClick={() => (window.location.href = "/panel/servicios")}
            />
          </div>
          <div className="col-span-1">
            <MiniKPI
              title="Staff activo"
              value={stats.activeStaff}
              icon={<Users className="h-4 w-4" />}
              onClick={() => (window.location.href = "/panel/staff")}
            />
          </div>

          {/* Gráfico de reservas - tamaño mediano, más compacto */}
          <div
            className={cn(
              cardBaseClass,
              "flex flex-col gap-3 col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-3"
            )}
          >
            <div className="mb-1">
              <h3 className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-1">
                Reservas últimos 7 días
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Total: {totalLast7Days} • Media: {avgLast7Days.toFixed(1)} • Ticket: {formatCurrency(avgTicketLast7Days)}
              </p>
            </div>
            {showChartBars ? (
              <div className="flex items-end gap-1.5 sm:gap-2 relative min-h-[100px] flex-1">
                {bookingValues.map((count: number, index: number) => {
                  const height = chartMax > 0 ? (count / chartMax) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center justify-end h-full relative group"
                    >
                      {/* Columna del gráfico */}
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: `${height}%`, opacity: 1 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        className="w-full rounded-t-[var(--radius-md)] gradient-aurora-1 relative overflow-hidden cursor-pointer mb-4"
                        style={{
                          minHeight: count > 0 ? "6px" : "0",
                          borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                          boxShadow: count > 0 ? "0px 4px 16px rgba(123,92,255,0.2)" : "none",
                        }}
                        title={`${format(subDays(new Date(), 6 - index), "dd/MM")}: ${count} reservas`}
                      >
                        {count > 0 && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 + index * 0.03 }}
                          />
                        )}
                      </motion.div>
                      {/* Etiqueta del día */}
                      <motion.span
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + index * 0.03 }}
                        className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-primary)] font-satoshi absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded text-center"
                        style={{
                          background: "rgba(21, 23, 26, 0.8)",
                          backdropFilter: "blur(4px)",
                          WebkitBackdropFilter: "blur(4px)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          fontSize: "9px",
                          lineHeight: "1",
                        }}
                      >
                        {format(subDays(new Date(), 6 - index), "dd")}
                      </motion.span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 min-h-[100px]">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  No hay reservas recientes
                </p>
                <p className="text-xs text-[var(--text-secondary)] max-w-xs">
                  Las reservas aparecerán aquí
                </p>
              </div>
            )}

            {/* Métricas en línea más compactas */}
            {showChartBars && stats.noShowsLast7Days > 0 && (
              <div className="text-center">
                <span className="text-xs text-[var(--text-secondary)]">
                  No-shows: <span className="font-medium text-amber-400">{stats.noShowsLast7Days}</span> ({(noShowRateLast7Days * 100).toFixed(0)}%)
                </span>
              </div>
            )}
          </div>

          {/* Widget de mensajes - tamaño mediano */}
          {tenantId && (
            <div className="col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-2">
              <MessagesWidget tenantId={tenantId} />
            </div>
          )}

          {/* Próximas reservas - ocupa espacio flexible */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-3">
            <UpcomingAppointments
              bookings={upcomingBookings}
              limit={4}
              timezone={tenantTimezone}
            />
          </div>

          {/* Alertas operativas - tamaño compacto */}
          <div className={cn(cardBaseClass, "col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-2 flex flex-col gap-2")}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] font-satoshi uppercase tracking-[0.14em]">
                Alertas
              </h3>
              <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                HOY
              </span>
            </div>

            {operationalAlerts.length === 0 ? (
              <div className="flex items-center justify-center py-2">
                <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Todo en orden
                </span>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {operationalAlerts.slice(0, 2).map((alert: OperationalAlert, idx: number) => (
                  <li
                    key={idx}
                    className={cn(
                      "rounded px-2 py-1.5 text-xs flex flex-col gap-0.5",
                      alert.type === "danger" && "bg-red-500/5 border border-red-500/20",
                      alert.type === "warning" && "bg-amber-500/5 border border-amber-500/20",
                      alert.type === "info" && "bg-sky-500/5 border border-sky-500/20"
                    )}
                  >
                    <span className="font-medium text-[var(--text-primary)] text-xs leading-tight">
                      {alert.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Accesos rápidos - diseño más compacto */}
          <div className={cn(cardBaseClass, "col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-2 space-y-3")}>
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)] font-satoshi uppercase tracking-[0.14em] mb-1">
                Accesos rápidos
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)]">Ir a secciones principales</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.slice(0, 4).map((link, index) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center justify-center rounded-lg p-2 text-center transition-all duration-150 ease-out group relative overflow-hidden hover:-translate-y-[1px]"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 gradient-aurora-1 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
                    />
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.2 }}
                      className="mb-1 relative z-10"
                    >
                      <Icon className="h-3.5 w-3.5 text-[var(--text-primary)]" />
                    </motion.span>
                    <span className="font-medium text-[var(--text-primary)] font-satoshi text-[10px] leading-tight relative z-10">
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Onboarding hint - solo si no hay actividad */}
          {showOnboardingHint && (
            <div className={cn(cardBaseClass, "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center p-4")}>
              <p className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-2">
                ¡Bienvenido! Configura tu barbería
              </p>
              <p className="text-xs text-[var(--text-secondary)] mb-3 max-w-lg mx-auto">
                Usa los accesos rápidos para configurar servicios, horarios y equipo
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {QUICK_LINKS.slice(0, 4).map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={`hint-${link.href}`}
                      href={link.href}
                      className="inline-flex items-center gap-2 rounded-full border border-white/5 px-3 py-1.5 text-xs text-[var(--text-primary)] bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top servicios - si hay datos */}
          {topServices.length > 0 && (
            <div className={cn(cardBaseClass, "col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-2 p-3")}>
              <h3 className="text-xs font-semibold text-[var(--text-primary)] font-satoshi mb-2 uppercase tracking-[0.14em]">
                Top servicios
              </h3>
              <ul className="space-y-1.5">
                {topServices.slice(0, 3).map((service: TopService, index: number) => (
                  <li key={service.serviceId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/10 text-[8px] font-semibold text-[var(--text-primary)]">
                        {index + 1}
                      </span>
                      <span className="text-[var(--text-primary)] truncate max-w-[70px] text-xs">{service.name}</span>
                    </div>
                    <span className="text-[var(--text-secondary)] font-medium text-xs">
                      {service.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
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
