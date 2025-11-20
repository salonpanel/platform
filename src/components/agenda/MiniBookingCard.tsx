"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { format } from "date-fns";

interface MiniBookingCardProps {
  booking: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
    customer?: { name: string; email?: string };
    service?: { name: string; duration_min: number };
    staff?: { name: string };
  };
  density?: "default" | "compact" | "ultra-compact";
  onClick?: () => void;
  className?: string;
}

/**
 * Componente compacto para mostrar una reserva en el timeline
 * Diseño tipo "mini capsule" para máxima densidad
 */
export function MiniBookingCard({ booking, density = "default", onClick, className }: MiniBookingCardProps) {
  const startTime = format(new Date(booking.starts_at), "HH:mm");
  const endTime = format(new Date(booking.ends_at), "HH:mm");
  
  const paddingClass = density === "ultra-compact" ? "p-1.5" : density === "compact" ? "p-2" : "p-2.5";
  const textSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";
  const nameSize = density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={onClick ? { scale: 1.02, y: -1 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)] glass backdrop-blur-sm",
        "transition-all duration-200",
        paddingClass,
        onClick && "cursor-pointer hover:border-[var(--accent-aqua-border)] hover:bg-[var(--accent-aqua-glass)]",
        className
      )}
      style={{
        boxShadow: "var(--shadow-card-subtle)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-semibold truncate",
              nameSize
            )}
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-primary)",
            }}
          >
            {booking.customer?.name || "Sin cliente"}
          </div>
          {booking.service && (
            <div
              className={cn(
                "mt-0.5 truncate",
                textSize
              )}
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--text-secondary)",
              }}
            >
              {booking.service.name}
            </div>
          )}
          <div
            className={cn(
              "mt-1 font-mono",
              textSize
            )}
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)",
            }}
          >
            {startTime} - {endTime}
          </div>
        </div>
        <StatusBadge status={booking.status} density={density} size="xs" />
      </div>
    </motion.div>
  );
}
