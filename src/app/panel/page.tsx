"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card, KPICard, KPIGrid, StatCard, Spinner, BentoCard, TitleBar } from "@/components/ui";
import { HeightAwareContainer, useHeightAware } from "@/components/panel/HeightAwareContainer";
import { PanelSection } from "@/components/panel/PanelSection";
import { motion } from "framer-motion";
import { Calendar, Scissors, Users, User, TrendingUp, Clock, Star, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function PanelHomeContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    bookingsToday: 0,
    activeServices: 0,
    activeStaff: 0,
  });

  const heightAware = useHeightAware();

  // Extraer el valor de impersonate una sola vez para evitar re-renders
  const impersonateOrgId = useMemo(() => {
    return searchParams?.get("impersonate") || null;
  }, [searchParams?.toString()]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const { tenant: tenantData } = await getCurrentTenant(impersonateOrgId);

        if (tenantData && mounted) {
          // Cargar estadísticas básicas
          const today = new Date().toISOString().split("T")[0];
          const startOfDay = new Date(today).toISOString();
          const endOfDay = new Date(today + "T23:59:59").toISOString();

          // Bookings de hoy
          const { count: bookingsCount } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .gte("starts_at", startOfDay)
            .lt("starts_at", endOfDay);

          // Servicios activos
          const { count: servicesCount } = await supabase
            .from("services")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("active", true);

          // Staff activo
          const { count: staffCount } = await supabase
            .from("staff")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantData.id)
            .eq("active", true);

          if (mounted) {
            setStats({
              bookingsToday: bookingsCount || 0,
              activeServices: servicesCount || 0,
              activeStaff: staffCount || 0,
            });
            setLoading(false);
          }
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
        if (mounted) setLoading(false);
      }
    };

    loadData();
    
    return () => {
      mounted = false;
    };
  }, [impersonateOrgId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  // Auto-layout inteligente basado en altura
  const { isLarge, isMedium, density: rawDensity } = heightAware;
  // Mapear Density type a valores aceptados por componentes UI
  const density = rawDensity === "normal" ? "default" : rawDensity;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.15,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Gradientes radiales de fondo */}
      <div
        className="pointer-events-none fixed inset-0 opacity-50 -z-10"
        style={{
          background: "var(--gradient-radial-primary)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-30 -z-10"
        style={{
          background: "var(--gradient-radial-secondary)",
        }}
      />

      {/* ZERO SCROLL: Contenedor principal con flex-col, sin scroll vertical */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {/* Header con TitleBar */}
        <motion.div variants={itemVariants} className="flex-shrink-0 mb-4">
          <TitleBar
            title="Dashboard"
            subtitle="Visión ejecutiva del día"
            density={density}
          />
        </motion.div>

        {/* Bento Grid - Layout adaptativo según altura */}
        <motion.div
          variants={itemVariants}
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
            "grid gap-3",
            // Layout responsive: normal (2 cols), compact (1 col), ultra-compact (1 col más denso)
            isLarge ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
            density === "ultra-compact" ? "gap-2" : density === "compact" ? "gap-3" : "gap-4"
          )}
        >
          {/* Fila superior: KPIs principales */}
          <div className={cn(
            "grid gap-3",
            isLarge ? "lg:grid-cols-3" : isMedium ? "grid-cols-2" : "grid-cols-1",
            density === "ultra-compact" ? "gap-2" : "gap-3"
          )}>
            <BentoCard
              priority="high"
              density={density}
              icon={Calendar}
              title="Reservas hoy"
              onClick={() => window.location.href = "/panel/agenda"}
            >
              <div className="flex items-end justify-between">
                <div>
                  <div
                    className={cn(
                      "font-bold font-satoshi",
                      density === "ultra-compact" ? "text-2xl" : density === "compact" ? "text-3xl" : "text-4xl"
                    )}
                    style={{ color: "white" }}
                  >
                    {stats.bookingsToday}
                  </div>
                  <div
                    className={cn(
                      "mt-1 opacity-90",
                      density === "ultra-compact" ? "text-xs" : "text-sm"
                    )}
                    style={{ color: "white" }}
                  >
                    Reservas confirmadas
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard
              priority="medium"
              density={density}
              icon={Scissors}
              title="Servicios activos"
              onClick={() => window.location.href = "/panel/servicios"}
            >
              <div className="flex items-end justify-between">
                <div>
                  <div
                    className={cn(
                      "font-bold font-satoshi",
                      density === "ultra-compact" ? "text-xl" : density === "compact" ? "text-2xl" : "text-3xl"
                    )}
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {stats.activeServices}
                  </div>
                  <div
                    className={cn(
                      "mt-1",
                      density === "ultra-compact" ? "text-xs" : "text-sm"
                    )}
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Servicios disponibles
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard
              priority="medium"
              density={density}
              icon={User}
              title="Staff activo"
              onClick={() => window.location.href = "/panel/staff"}
            >
              <div className="flex items-end justify-between">
                <div>
                  <div
                    className={cn(
                      "font-bold font-satoshi",
                      density === "ultra-compact" ? "text-xl" : density === "compact" ? "text-2xl" : "text-3xl"
                    )}
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {stats.activeStaff}
                  </div>
                  <div
                    className={cn(
                      "mt-1",
                      density === "ultra-compact" ? "text-xs" : "text-sm"
                    )}
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Miembros del equipo
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>

          {/* Fila inferior: Accesos rápidos y módulos secundarios */}
          <div className={cn(
            "grid gap-3",
            isLarge ? "lg:grid-cols-2" : "grid-cols-1",
            density === "ultra-compact" ? "gap-2" : "gap-3"
          )}>
            {/* Accesos rápidos */}
            <BentoCard
              priority="low"
              density={density}
              title="Accesos rápidos"
            >
              <div className={cn(
                "grid gap-2",
                isLarge ? "grid-cols-2" : "grid-cols-1",
                density === "ultra-compact" ? "gap-1.5" : "gap-2"
              )}>
                {[
                  { href: "/panel/agenda", label: "Agenda", icon: Calendar },
                  { href: "/panel/clientes", label: "Clientes", icon: Users },
                  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
                  { href: "/panel/staff", label: "Staff", icon: User },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] p-2 transition-all hover:border-[var(--accent-aqua-border)] hover:bg-[var(--accent-aqua-glass)]",
                      density === "ultra-compact" ? "p-1.5" : "p-2"
                    )}
                    style={{
                      transitionDuration: "var(--duration-base)",
                    }}
                  >
                    <item.icon className={cn(
                      density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4"
                    )} style={{ color: "var(--accent-aqua)" }} />
                    <span
                      className={cn(
                        "font-medium font-satoshi",
                        density === "ultra-compact" ? "text-xs" : "text-sm"
                      )}
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </BentoCard>

            {/* Módulo de alertas/notificaciones (placeholder) */}
            {isLarge && (
              <BentoCard
                priority="low"
                density={density}
                icon={AlertCircle}
                title="Alertas"
              >
                <div
                  className={cn(
                    "text-center py-4",
                    density === "ultra-compact" ? "py-2" : "py-4"
                  )}
                >
                  <div
                    className={cn(
                      density === "ultra-compact" ? "text-xs" : "text-sm"
                    )}
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    No hay alertas pendientes
                  </div>
                </div>
              </BentoCard>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function PanelHomeWrapper() {
  return (
    <HeightAwareContainer className="h-full">
      <PanelHomeContent />
    </HeightAwareContainer>
  );
}

export default function PanelHome() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" />
        </div>
      }
    >
      <PanelHomeWrapper />
    </Suspense>
  );
}
