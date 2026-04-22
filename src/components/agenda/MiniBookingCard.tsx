"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { format } from "date-fns";
import { Clock, User, Scissors } from "lucide-react";

interface MiniBookingCardProps {
  booking: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show" | "confirmed";
    customer?: {
      name: string;
      email?: string;
      phone?: string | null;
    };
    service?: { name: string; duration_min: number; price_cents?: number };
    staff?: { name: string };
  };
  density?: "default" | "compact" | "ultra-compact";
  onClick?: () => void;
  className?: string;
  showActions?: boolean;
}

/**
 * Componente premium para mostrar una reserva en el timeline
 * Diseño glassmórfico con micro-interacciones y detalles de alto valor
 */
export function MiniBookingCard({
  booking,
  density = "default",
  onClick,
  className,
  showActions = true
}: MiniBookingCardProps) {
  const startTime = format(new Date(booking.starts_at), "HH:mm");
  const endTime = format(new Date(booking.ends_at), "HH:mm");
  const duration = booking.service?.duration_min || 0;
  const price = booking.service?.price_cents ? (booking.service.price_cents / 100).toFixed(2) : null;

  // Variantes de diseño según densidad
  const paddingClass = density === "ultra-compact" ? "p-2" : density === "compact" ? "p-2.5" : "p-3";
  const textSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";
  const nameSize = density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base";
  const iconSize = density === "ultra-compact" ? "h-3 w-3" : density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4";

  // Transform density to GlassBadge size
  const badgeSize = density === "ultra-compact" ? "xs" : density === "compact" ? "xs" : "sm";

  // Color de borde según estado
  const getStatusBorder = () => {
    switch (booking.status) {
      case "paid": return "border-[var(--status-paid-border)] bg-[var(--status-paid-glass)]";
      case "pending": return "border-[var(--status-pending-border)] bg-[var(--status-pending-glass)]";
      case "completed": return "border-[var(--status-completed-border)] bg-[var(--status-completed-glass)]";
      case "cancelled": return "border-[var(--status-cancelled-border)] bg-[var(--status-cancelled-glass)]";
      case "no_show": return "border-[var(--status-noshow-border)] bg-[var(--status-noshow-glass)]";
      default: return "border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={onClick ? {
        scale: 1.02,
        y: -2,
        boxShadow: "0 8px 25px -8px rgba(79, 161, 216, 0.25), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "group relative rounded-[var(--r-lg)] border transition-all duration-200",
        "hover:border-[var(--bf-border-2)]",
        paddingClass,
        getStatusBorder(),
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Indicador de estado sutil */}
      <div className={cn(
        "absolute top-0 left-0 w-1 h-full rounded-l-[var(--r-lg)]",
        booking.status === "paid" && "bg-[var(--status-paid)]",
        booking.status === "pending" && "bg-[var(--status-pending)]",
        booking.status === "completed" && "bg-[var(--status-completed)]",
        booking.status === "cancelled" && "bg-[var(--status-cancelled)]",
        booking.status === "no_show" && "bg-[var(--status-noshow)]"
      )} />

      <div className="flex items-start justify-between gap-3">
        {/* Información principal */}
        <div className="flex-1 min-w-0">
          {/* Nombre del cliente */}
          <div className="flex items-center gap-2 mb-1">
            <User className={cn(iconSize, "text-[var(--bf-ink-400)] flex-shrink-0")} />
            <div
              className={cn(
                "font-semibold truncate",
                nameSize
              )}
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--bf-ink-50)",
              }}
            >
              {booking.customer?.name || "Sin cliente"}
            </div>
          </div>

          {/* Servicio */}
          {booking.service && (
            <div className="flex items-center gap-2 mb-2">
              <Scissors className={cn(iconSize, "text-[var(--bf-ink-400)] flex-shrink-0")} />
              <div
                className={cn(
                  "truncate font-medium",
                  textSize
                )}
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--bf-ink-300)",
                }}
              >
                {booking.service.name}
              </div>
              {duration > 0 && (
                <span className="px-1.5 py-0.5 rounded-[var(--r-sm)] font-mono text-xs bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]">
                  {duration}min
                </span>
              )}
            </div>
          )}

          {/* Hora y precio */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className={cn(iconSize, "text-[var(--bf-ink-400)] flex-shrink-0")} />
              <div
                className={cn(
                  "font-mono font-medium",
                  textSize
                )}
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--bf-primary)",
                }}
              >
                {startTime} - {endTime}
              </div>
            </div>

            {price && (
              <div className="px-2 py-0.5 rounded-[var(--r-sm)] font-semibold text-xs bg-[rgba(79,161,216,0.12)] border border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-200)]">
                {price}€
              </div>
            )}
          </div>

          {/* Staff */}
          {booking.staff && density !== "ultra-compact" && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-4 h-4 rounded-full bg-[rgba(79,161,216,0.15)] border border-[rgba(79,161,216,0.3)] flex items-center justify-center">
                <span className="text-[8px] font-bold text-[var(--bf-primary)]">
                  {booking.staff.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span
                className={cn(
                  "truncate font-medium",
                  textSize
                )}
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--bf-ink-400)",
                }}
              >
                {booking.staff.name}
              </span>
            </div>
          )}
        </div>

        {/* Badge de estado y acciones */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <GlassBadge
            variant={
              booking.status === "paid" ? "success" :
                booking.status === "confirmed" ? "success" :
                  booking.status === "cancelled" ? "danger" :
                    booking.status === "no_show" ? "danger" :
                      booking.status === "completed" ? "default" :
                        "warning"
            }
            size={badgeSize}
          >
            {booking.status === "no_show" ? "No Show" :
              booking.status === "paid" ? "Pagado" :
                booking.status === "pending" ? "Pendiente" :
                  booking.status === "completed" ? "Completado" :
                    booking.status === "cancelled" ? "Cancelado" :
                      "Confirmado"}
          </GlassBadge>

          {showActions && onClick && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className={cn(
                "p-1.5 rounded-md border transition-all duration-200",
                "bg-[var(--bf-bg-elev)] border-[var(--bf-border)]",
                "hover:bg-[rgba(79,161,216,0.12)] hover:border-[rgba(79,161,216,0.35)]",
                "opacity-0 group-hover:opacity-100"
              )}
            >
              <div className="w-3 h-3 rounded-full bg-[var(--bf-primary)]" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Efecto de brillo sutil en hover */}
      <div className="absolute inset-0 rounded-[var(--r-lg)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="absolute inset-0 bg-[rgba(79,161,216,0.03)]" />
      </div>
    </motion.div>
  );
}
