"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Spinner } from "@/components/ui/Spinner";
import { MiniKPI } from "@/components/panel/MiniKPI";
import { UpcomingAppointments } from "@/components/panel/UpcomingAppointments";
import { MessagesWidget } from "@/components/panel/MessagesWidget";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { ComponentType } from "react";
import { Calendar, Users, Scissors, User, ArrowRight, Euro, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { PageHeader } from "@/components/ui/PageHeader";

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

function PanelHomeContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [tenantName, setTenantName] = useState<string>("");
  const [stats, setStats] = useState({
    bookingsToday: 0,
    bookingsLast7Days: [] as number[],
    activeServices: 0,
    activeStaff: 0,
    revenueToday: 0,
    totalBookingsLast7Days: 0,
    revenueLast7Days: 0,
    totalBookingsLast30Days: 0,
    revenueLast30Days: 0,
    noShowsLast7Days: 0,
  });
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([]);

  const impersonateOrgId = useMemo(() => {
    return searchParams?.get("impersonate") || null;
  }, [searchParams?.toString()]);

  const todayLabel = useMemo(() => {
    const formatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const { tenant: tenantData } = await getCurrentTenant(impersonateOrgId);

        if (tenantData && mounted) {
          setTenantId(tenantData.id);
          setTenantTimezone(tenantData.timezone || "Europe/Madrid");
          setTenantName(tenantData.name || "Tu barbería");

          const today = new Date();
          const todayStart = startOfDay(today).toISOString();
          const todayEnd = endOfDay(today).toISOString();

          const last7Days = Array.from({ length: 7 }, (_, i) =>
            format(subDays(today, 6 - i), "yyyy-MM-dd")
          );

          const bookingsTodayPromise = supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .gte("starts_at", todayStart)
            .lt("starts_at", todayEnd);

          const bookingsLast7DaysPromise = Promise.all(
            last7Days.map(async (date) => {
              const dayStart = startOfDay(new Date(date)).toISOString();
              const dayEnd = endOfDay(new Date(date)).toISOString();
              const { count } = await supabase
                .from("bookings")
                .select("*", { count: "exact", head: true })
                .eq("tenant_id", tenantData.id)
                .gte("starts_at", dayStart)
                .lt("starts_at", dayEnd);
              return count || 0;
            })
          );

          const revenuePromise = supabase
            .from("bookings")
            .select("service:services(price_cents)")
            .eq("tenant_id", tenantData.id)
            .in("status", ["paid", "completed"])
            .gte("starts_at", todayStart)
            .lt("starts_at", todayEnd);

          const servicesCountPromise = supabase
            .from("services")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("active", true);

          const staffCountPromise = supabase
            .from("staff")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("active", true);

          const upcomingPromise = supabase
            .from("bookings")
            .select(
              `
              *,
              customer:customers(id, name, email),
              service:services(id, name),
              staff:staff(id, name)
            `
            )
            .eq("tenant_id", tenantData.id)
            .gte("starts_at", todayStart)
            .order("starts_at", { ascending: true })
            .limit(3);

          // Consulta para últimos 30 días
          const thirtyDaysAgo = subDays(today, 29);
          const bookingsLast30DaysPromise = supabase
            .from("bookings")
            .select(`
              id,
              starts_at,
              status,
              service:services(price_cents)
            `)
            .eq("tenant_id", tenantData.id)
            .gte("starts_at", thirtyDaysAgo.toISOString())
            .lte("starts_at", todayEnd);

          // Consulta para ingresos últimos 7 días
          const weekStart = subDays(today, 6);
          const revenueLast7DaysPromise = supabase
            .from("bookings")
            .select("service:services(price_cents)")
            .eq("tenant_id", tenantData.id)
            .in("status", ["paid", "completed"])
            .gte("starts_at", startOfDay(weekStart).toISOString())
            .lte("starts_at", todayEnd);

          // Consulta para top servicios últimos 7 días
          const topServicesPromise = supabase
            .from("bookings")
            .select(`
              id,
              starts_at,
              service:services(id, name)
            `)
            .eq("tenant_id", tenantData.id)
            .gte("starts_at", startOfDay(weekStart).toISOString())
            .lte("starts_at", todayEnd);

          // Consulta para no-shows últimos 7 días
          const noShowsLast7DaysPromise = supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("status", "no_show")
            .gte("starts_at", startOfDay(weekStart).toISOString())
            .lte("starts_at", todayEnd);

          const [
            { count: bookingsToday },
            bookingsLast7Days,
            { data: revenueData },
            { count: servicesCount },
            { count: staffCount },
            { data: upcomingData },
            { data: bookingsLast30DaysData },
            { data: revenueLast7DaysData },
            { data: topServicesData },
            { count: noShowsLast7Days },
          ] = await Promise.all([
            bookingsTodayPromise,
            bookingsLast7DaysPromise,
            revenuePromise,
            servicesCountPromise,
            staffCountPromise,
            upcomingPromise,
            bookingsLast30DaysPromise,
            revenueLast7DaysPromise,
            topServicesPromise,
            noShowsLast7DaysPromise,
          ]);

          // Fallbacks defensivos para arrays
          const safeUpcoming = Array.isArray(upcomingData) ? upcomingData : [];
          const safeRevenueData = Array.isArray(revenueData) ? revenueData : [];
          const safeBookingsLast7Days = Array.isArray(bookingsLast7Days) ? bookingsLast7Days : [];
          const safeBookingsLast30Days = Array.isArray(bookingsLast30DaysData) ? bookingsLast30DaysData : [];
          const safeRevenueLast7Days = Array.isArray(revenueLast7DaysData) ? revenueLast7DaysData : [];
          const safeTopServicesData = Array.isArray(topServicesData) ? topServicesData : [];

          const revenueToday = safeRevenueData.reduce((sum, b: any) => {
            return sum + (b.service?.price_cents || 0);
          }, 0);

          const totalBookingsLast7Days = safeBookingsLast7Days.reduce((sum, v) => sum + v, 0);
          const revenueLast7Days = safeRevenueLast7Days.reduce((sum, b: any) => {
            return sum + (b.service?.price_cents || 0);
          }, 0);

          const totalBookingsLast30Days = safeBookingsLast30Days.length;
          const revenueLast30Days = safeBookingsLast30Days.reduce((sum, b: any) => {
            return sum + (b.service?.price_cents || 0);
          }, 0);

          // Calcular top servicios
          const serviceCounts = new Map<string, TopService>();
          safeTopServicesData.forEach((b: any) => {
            const serviceId = b.service?.id;
            const name = b.service?.name || "Servicio sin nombre";

            if (!serviceId) return;

            const existing = serviceCounts.get(serviceId);
            if (existing) {
              existing.count += 1;
            } else {
              serviceCounts.set(serviceId, { serviceId, name, count: 1 });
            }
          });

          const topServicesList = Array.from(serviceCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

          // Calcular métricas para alertas
          const noShowsCount = noShowsLast7Days || 0;
          const avgTicketLast7Days =
            totalBookingsLast7Days > 0 ? revenueLast7Days / totalBookingsLast7Days : 0;
          const noShowRateLast7Days =
            totalBookingsLast7Days > 0 ? noShowsCount / totalBookingsLast7Days : 0;

          // Calcular alertas operativas
          const alerts: OperationalAlert[] = [];

          if ((servicesCount || 0) === 0) {
            alerts.push({
              type: "danger",
              title: "Sin servicios activos",
              description: "Activa al menos un servicio para empezar a recibir reservas.",
            });
          }

          if ((bookingsToday || 0) === 0 && totalBookingsLast7Days > 0) {
            alerts.push({
              type: "warning",
              title: "Sin reservas hoy",
              description: "Revisa la agenda y considera reforzar recordatorios o campañas.",
            });
          }

          if (totalBookingsLast7Days > 0 && noShowRateLast7Days > 0.3) {
            alerts.push({
              type: "danger",
              title: "Tasa de no-show alta",
              description: "Valora solicitar señal, ajustar recordatorios o revisar políticas de cita.",
            });
          }

          if (avgTicketLast7Days > 0 && avgTicketLast7Days / 100 < 15) {
            alerts.push({
              type: "info",
              title: "Ticket medio bajo",
              description: "Promociona servicios combinados o upgrades para aumentar el ticket.",
            });
          }

          if (mounted) {
            setStats({
              bookingsToday: bookingsToday || 0,
              bookingsLast7Days: safeBookingsLast7Days,
              activeServices: servicesCount || 0,
              activeStaff: staffCount || 0,
              revenueToday,
              totalBookingsLast7Days,
              revenueLast7Days,
              totalBookingsLast30Days,
              revenueLast30Days,
              noShowsLast7Days: noShowsCount,
            });
            setUpcomingBookings(safeUpcoming);
            setTopServices(topServicesList);
            setOperationalAlerts(alerts);
            setIsLoadingStats(false);
          }
        } else if (mounted) {
          setIsLoadingStats(false);
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
        if (mounted) setIsLoadingStats(false);
      }
    };

    loadData();
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonateOrgId]);

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
    const hasPositiveValues = values.some((value) => value > 0);
    const showBars = hasValues && hasPositiveValues;
    const total = values.reduce((sum, value) => sum + value, 0);
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

    const avgTicket =
      totalBookingsLast7Days > 0 ? revenueLast7Days / totalBookingsLast7Days : 0;

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

  if (isLoadingStats) {
    return (
      <div className="space-y-10">
        <div className="space-y-3">
          <div className="h-4 w-40 rounded-full bg-white/5 animate-pulse" />
          <div className="h-10 w-2/3 rounded-full bg-white/5 animate-pulse" />
          <div className="h-4 w-full max-w-md rounded-full bg-white/5 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-28 rounded-[var(--radius-lg)] border border-white/5 bg-white/5 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-64 rounded-[var(--radius-xl)] border border-white/5 bg-white/5 animate-pulse" />
          <div className="h-64 rounded-[var(--radius-xl)] border border-white/5 bg-white/5 animate-pulse lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="h-56 rounded-[var(--radius-xl)] border border-white/5 bg-white/5 animate-pulse" />
          <div className="h-56 rounded-[var(--radius-xl)] border border-white/5 bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="space-y-6 md:space-y-8"
      >
        {/* Cabecera ejecutiva */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0 }}
        >
          <PageHeader
            title="Visión general de hoy"
            subtitle={`${(tenantName || "Tu barbería")} · ${todayLabel}`}
            description="Revisa de un vistazo reservas, ingresos y actividad de tu barbería."
            size="md"
            className="mb-6"
          />
          {shouldShowTimezone && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 mb-4">
              Zona horaria del negocio: <span className="font-semibold text-[var(--color-text-primary)]">{tenantTimezone}</span>
            </p>
          )}
        </motion.div>

        {/* Alertas operativas */}
        {operationalAlerts.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.22, ease: "easeOut", delay: 0.05 }}
            className="grid gap-4 md:gap-6 md:grid-cols-2"
          >
            {operationalAlerts.slice(0, 2).map((alert, idx) => (
              <div
                key={idx}
                className={cn(
                  cardBaseClass,
                  alert.type === "info" && "border-sky-500/40",
                  alert.type === "warning" && "border-amber-500/40",
                  alert.type === "danger" && "border-red-500/40"
                )}
              >
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  {alert.title}
                </p>
                <p className="text-xs sm:text-[13px] text-[var(--text-secondary)]">
                  {alert.description}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Selector de periodo */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        >
          <p className="text-xs text-[var(--text-secondary)]">
            Ajusta la vista para analizar tu negocio por periodo.
          </p>
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
      </motion.div>

        {/* KPIs principales */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.15 }}
          className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3"
        >
          <MiniKPI
            title={bookingsKPI.label}
            value={bookingsKPI.value}
            trend={bookingsKPI.trend}
            trendValue={bookingsKPI.trendLabel}
            icon={<Calendar className="h-4 w-4" />}
            onClick={() => window.location.href = "/panel/agenda"}
          />
          <MiniKPI
            title={revenueKPI.label}
            value={revenueKPI.value}
            trend={revenueKPI.trend}
            trendValue={revenueKPI.trendLabel}
            icon={<Euro className="h-4 w-4" />}
            onClick={() => window.location.href = "/panel/agenda"}
          />
          <MiniKPI
            title="Servicios activos"
            value={stats.activeServices}
            icon={<Scissors className="h-4 w-4" />}
            onClick={() => window.location.href = "/panel/servicios"}
          />
        </motion.div>

        {showOnboardingHint && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            transition={{ duration: 0.22, ease: "easeOut", delay: 0.2 }}
            className={cn(cardBaseClass, "text-center")}
          >
            <p className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-2">
              Todavía no hay actividad registrada hoy.
            </p>
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mb-4 max-w-2xl mx-auto">
              Configura tus servicios, horarios y equipo para empezar a recibir reservas. Usa los
              accesos rápidos para ir directo a cada sección.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {QUICK_LINKS.map((link) => {
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
          </motion.div>
        )}

        {/* Widget de mensajes, gráfico y alertas en grid */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.25 }}
          className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3"
        >
          {/* Widget de mensajes */}
          {tenantId && (
            <div className="lg:col-span-1">
              <MessagesWidget tenantId={tenantId} />
            </div>
          )}

          {/* Gráfico de reservas */}
          <div
            className={cn(
              cardBaseClass,
              tenantId ? "lg:col-span-2" : "lg:col-span-3"
            )}
          >
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-1">
                Reservas últimos 7 días
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Tendencia de reservas diarias
              </p>
            </div>
            {showChartBars ? (
              <div className="h-40 flex items-end gap-1.5 sm:gap-2 relative">
                {bookingValues.map((count, index) => {
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
                        whileHover={{ scale: 1.05, y: -4 }}
                        className="w-full rounded-t-[var(--radius-md)] gradient-aurora-1 relative overflow-hidden cursor-pointer mb-6"
                        style={{
                          minHeight: count > 0 ? "8px" : "0",
                          borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                          boxShadow: count > 0 ? "0px 4px 16px rgba(123,92,255,0.3), inset 0px 1px 0px rgba(255,255,255,0.2)" : "none",
                        }}
                        title={`${format(subDays(new Date(), 6 - index), "dd/MM")}: ${count} reservas`}
                      >
                        {count > 0 && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 + index * 0.03 }}
                          />
                        )}
                        {/* Tooltip al hover */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          whileHover={{ opacity: 1, y: 0 }}
                          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-md text-xs font-semibold text-[var(--text-primary)] font-satoshi whitespace-nowrap shadow-lg"
                          style={{
                            background: "rgba(21, 23, 26, 0.9)",
                          }}
                        >
                          {count} {count === 1 ? "reserva" : "reservas"}
                        </motion.div>
                      </motion.div>
                      {/* Etiqueta del día */}
                      <motion.span
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + index * 0.03 }}
                        className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-primary)] font-satoshi absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md"
                        style={{
                          background: "rgba(21, 23, 26, 0.8)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.3)",
                        }}
                      >
                        {format(subDays(new Date(), 6 - index), "dd")}
                      </motion.span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center gap-2 text-[var(--text-secondary)]">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Todavía no hay reservas en los últimos 7 días.
                </p>
                <p className="text-xs text-[var(--text-secondary)] max-w-md">
                  Cuando empieces a recibir reservas, verás aquí la evolución diaria, el total semanal, la media diaria, el ticket medio y la tasa de no-show.
                </p>
              </div>
            )}
            {showChartBars && (
              <>
                <p className="mt-4 text-xs sm:text-[13px] text-[var(--text-secondary)]">
                  Últimos 7 días:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {totalLast7Days}
                  </span>{" "}
                  reservas · Media diaria:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {avgLast7Days.toFixed(1)}
                  </span>
                </p>
                <p className="mt-1 text-xs sm:text-[13px] text-[var(--text-secondary)]">
                  Ticket medio semana:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatCurrency(avgTicketLast7Days)}
                  </span>{" "}
                  · No-shows:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {stats.noShowsLast7Days}
                  </span>{" "}
                  (
                  <span className="font-semibold text-[var(--text-primary)]">
                    {(noShowRateLast7Days * 100).toFixed(1)}%
                  </span>
                  )
                </p>
              </>
            )}
            {/* Top 3 servicios */}
            {topServices.length > 0 && (
              <div className="mt-6 rounded-xl bg-white/5 border border-white/5 p-4">
                <h3 className="text-xs font-semibold text-[var(--text-primary)] font-satoshi mb-3 uppercase tracking-[0.14em]">
                  Top servicios últimos 7 días
                </h3>
                <ul className="space-y-2">
                  {topServices.map((service, index) => (
                    <li key={service.serviceId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-[var(--text-primary)]">
                          {index + 1}
                        </span>
                        <span className="text-[var(--text-primary)]">{service.name}</span>
                      </div>
                      <span className="text-[var(--text-secondary)]">
                        {service.count} reserva{service.count !== 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Card de alertas operativas */}
          <div className={cn(cardBaseClass, "lg:col-span-1 flex flex-col gap-3 h-full")}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-primary)] font-satoshi">
                Alertas operativas
              </h3>
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                HOY
              </span>
            </div>

            {operationalAlerts.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Todo en orden por ahora. Sigue así
              </p>
            ) : (
              <ul className="space-y-2">
                {operationalAlerts.map((alert: OperationalAlert, idx: number) => (
                  <li
                    key={idx}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs flex flex-col gap-0.5",
                      alert.type === "danger" && "bg-red-500/5 border border-red-500/20",
                      alert.type === "warning" && "bg-amber-500/5 border border-amber-500/20",
                      alert.type === "info" && "bg-sky-500/5 border border-sky-500/20"
                    )}
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {alert.title}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      {alert.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>

        {/* Próximas reservas + Accesos rápidos */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionVariants}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.3 }}
          className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2"
        >
          {/* Próximas reservas */}
          <div>
            <UpcomingAppointments
              bookings={upcomingBookings}
              limit={3}
              timezone={tenantTimezone}
            />
          </div>

          {/* Accesos rápidos */}
          <div className={cn(cardBaseClass, "space-y-4")}>
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-1">
                Accesos rápidos
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Navegación rápida a secciones principales</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_LINKS.map((link, index) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col items-center justify-center rounded-xl p-4 text-center transition-all duration-150 ease-out group relative overflow-hidden hover:-translate-y-[1px]"
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 gradient-aurora-1 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
                    />
                    <motion.span
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                      className="mb-2 relative z-10"
                    >
                      <Icon className="h-5 w-5 text-[var(--text-primary)]" />
                    </motion.span>
                    <span className="font-medium text-[var(--text-primary)] font-satoshi text-xs mb-0.5 relative z-10">
                      {link.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] relative z-10">
                      {link.desc}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function PanelHome() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <PanelHomeContent />
    </Suspense>
  );
}
