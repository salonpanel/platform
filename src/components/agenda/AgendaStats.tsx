"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Calendar, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";

interface QuickStats {
  totalBookings: number;
  totalHours: number;
  totalAmount: number;
  rangeLabel?: string;
}

interface StaffUtilization {
  staffId: string;
  staffName: string;
  utilization: number;
}

interface AgendaStatsProps {
  stats: QuickStats;
  staffUtilization: StaffUtilization[];
  density?: "default" | "compact" | "ultra-compact";
}

/**
 * AgendaStats - Estadísticas premium con insights inteligentes
 * Muestra métricas clave y utilización de staff con visualizaciones elegantes
 */
export function AgendaStats({
  stats,
  staffUtilization,
  density = "default"
}: AgendaStatsProps) {
  const iconSize = density === "ultra-compact" ? "h-3 w-3" : density === "compact" ? "h-4 w-4" : "h-5 w-5";
  const paddingClass = density === "ultra-compact" ? "p-2" : density === "compact" ? "p-3" : "p-4";

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 40) return "text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/20";
    if (utilization < 80) return "text-[var(--accent-aqua)] bg-[var(--accent-aqua)]/10 border-[var(--accent-aqua)]/20";
    return "text-[var(--accent-purple)] bg-[var(--accent-purple)]/10 border-[var(--accent-purple)]/20";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Estadísticas principales */}
        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="col-span-1"
        >
          <GlassCard variant="elevated" padding={density === "ultra-compact" ? "sm" : "md"}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-[var(--radius-lg)] bg-[var(--accent-blue-glass)] border border-[var(--accent-blue-border)]",
                density === "ultra-compact" ? "p-1.5" : "p-2"
              )}>
                <Calendar className={cn(iconSize, "text-[var(--accent-blue)]")} />
              </div>
              <div>
                <div className={cn(
                  "font-bold text-[var(--text-primary)]",
                  density === "ultra-compact" ? "text-sm" : "text-lg"
                )}>
                  {stats.totalBookings}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {stats.rangeLabel || "Total citas"}
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="col-span-1"
        >
          <GlassCard variant="elevated" padding={density === "ultra-compact" ? "sm" : "md"}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-[var(--radius-lg)] bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)]",
                density === "ultra-compact" ? "p-1.5" : "p-2"
              )}>
                <Clock className={cn(iconSize, "text-[var(--accent-aqua)]")} />
              </div>
              <div>
                <div className={cn(
                  "font-bold text-[var(--text-primary)]",
                  density === "ultra-compact" ? "text-sm" : "text-lg"
                )}>
                  {stats.totalHours}h
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  Tiempo total
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="col-span-1"
        >
          <GlassCard variant="elevated" padding={density === "ultra-compact" ? "sm" : "md"}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-[var(--radius-lg)] bg-[var(--accent-purple-glass)] border border-[var(--accent-purple-border)]",
                density === "ultra-compact" ? "p-1.5" : "p-2"
              )}>
                <DollarSign className={cn(iconSize, "text-[var(--accent-purple)]")} />
              </div>
              <div>
                <div className={cn(
                  "font-bold text-[var(--text-primary)]",
                  density === "ultra-compact" ? "text-sm" : "text-lg"
                )}>
                  {(stats.totalAmount / 100).toFixed(2)}€
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  Ingresos totales
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -2 }}
          className="col-span-1"
        >
          <GlassCard variant="elevated" padding={density === "ultra-compact" ? "sm" : "md"}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--accent-blue)]/10 to-[var(--accent-aqua)]/10 border border-[var(--accent-aqua)]/20",
                density === "ultra-compact" ? "p-1.5" : "p-2"
              )}>
                <TrendingUp className={cn(iconSize, "text-[var(--accent-aqua)]")} />
              </div>
              <div>
                <div className={cn(
                  "font-bold text-[var(--text-primary)]",
                  density === "ultra-compact" ? "text-sm" : "text-lg"
                )}>
                  {Math.round((stats.totalAmount / stats.totalBookings) / 100)}€
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  Promedio por cita
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Utilización de Staff */}
      {staffUtilization.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard variant="elevated" padding="md" className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-[var(--text-secondary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Utilización de Staff
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {staffUtilization.map((staff, index) => (
                <motion.div
                  key={staff.staffId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  <div className={cn(
                    "rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200 p-3",
                    getUtilizationColor(staff.utilization)
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium truncate max-w-[80px]">
                        {staff.staffName}
                      </span>
                      <span className="text-xs font-bold">
                        {staff.utilization}%
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-[var(--bg-primary)]/30 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${staff.utilization}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className="h-full rounded-full bg-current"
                      />
                    </div>

                    {/* Indicador de estado */}
                    <div className="flex justify-center mt-2">
                      <span className="text-[10px] font-medium">
                        {staff.utilization < 40 && "Disponible"}
                        {staff.utilization >= 40 && staff.utilization < 80 && "Ocupado"}
                        {staff.utilization >= 80 && "Muy ocupado"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}
