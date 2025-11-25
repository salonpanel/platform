"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { format } from "date-fns";
import { Clock, User, Scissors, Phone, Mail } from "lucide-react";

interface MiniBookingCardProps {
  booking: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
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
        boxShadow: "0 8px 25px -8px rgba(79, 227, 193, 0.25), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl border backdrop-blur-md transition-all duration-200",
        "hover:shadow-lg hover:shadow-[var(--accent-aqua)]/12",
        paddingClass,
        getStatusBorder(),
        onClick && "cursor-pointer",
        className
      )}
      style={{
        background: "linear-gradient(145deg, rgba(21,23,26,0.9) 0%, rgba(21,23,26,0.75) 100%)",
        borderWidth: "1px",
      }}
    >
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl bg-white/10" />

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/8 border border-white/15 text-[11px] font-semibold text-white/90">
            {(booking.customer?.name || "").charAt(0) || "C"}
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn("font-semibold leading-tight truncate", nameSize)} style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
              {booking.customer?.name || "Sin cliente"}
            </div>
            <div className={cn("text-white/60 truncate", textSize)}>{booking.service?.name || "Sin servicio"}</div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="px-2 py-1 rounded-full bg-white/10 text-[11px] font-mono text-white/80 border border-white/10 leading-none">
              {startTime} - {endTime}
            </div>
            <StatusBadge status={booking.status} density={density} size="xs" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
          <div className="flex items-center gap-1.5 min-w-0">
            <Scissors className={cn(iconSize, "text-white/50 flex-shrink-0")} />
            <span className="truncate">{booking.service?.name || "Servicio"}</span>
          </div>
          {duration > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 font-mono text-[10px]">
              {duration}min
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
          {booking.staff ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[9px] font-semibold text-white/80">
                {booking.staff.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{booking.staff.name}</span>
            </div>
          ) : (
            <span className="text-white/50">Sin asignar</span>
          )}

          {price && (
            <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[var(--accent-blue)]/10 to-[var(--accent-aqua)]/10 border border-[var(--accent-aqua)]/30 text-[var(--accent-aqua)] font-semibold text-xs">
              {price}€
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
