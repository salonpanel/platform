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
        "group relative rounded-2xl border backdrop-blur-sm transition-all duration-200",
        "hover:shadow-lg hover:shadow-[var(--accent-aqua)]/10",
        "overflow-hidden",
        paddingClass,
        getStatusBorder(),
        onClick && "cursor-pointer",
        className
      )}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
        borderWidth: "1px",
        borderRadius: "16px",
      }}
    >
      {/* Indicador de estado sutil */}
      <div className={cn(
        "absolute top-0 left-0 w-1 h-full rounded-l-2xl",
        booking.status === "paid" && "bg-[var(--status-paid)]",
        booking.status === "pending" && "bg-[var(--status-pending)]",
        booking.status === "completed" && "bg-[var(--status-completed)]",
        booking.status === "cancelled" && "bg-[var(--status-cancelled)]",
        booking.status === "no_show" && "bg-[var(--status-noshow)]"
      )} />
      
      <div className="flex items-start justify-between gap-3 min-w-0 overflow-hidden">
        {/* Información principal */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Nombre del cliente */}
          <div className="flex items-center gap-2 mb-1">
            <User className={cn(iconSize, "text-[var(--text-secondary)] flex-shrink-0")} />
            <div
              className={cn(
                "font-semibold truncate",
                nameSize
              )}
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              {booking.customer?.name || "Sin cliente"}
            </div>
          </div>
          
          {/* Servicio */}
          {booking.service && (
            <div className="flex items-center gap-2 mb-2">
              <Scissors className={cn(iconSize, "text-[var(--text-tertiary)] flex-shrink-0")} />
              <div
                className={cn(
                  "truncate font-medium",
                  textSize
                )}
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--text-secondary)",
                }}
              >
                {booking.service.name}
              </div>
              {duration > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md font-mono text-xs",
                  "bg-[var(--glass-bg)] border border-[var(--glass-border-subtle)]"
                )}>
                  {duration}min
                </span>
              )}
            </div>
          )}
          
          {/* Hora y precio */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className={cn(iconSize, "text-[var(--text-tertiary)] flex-shrink-0")} />
              <div
                className={cn(
                  "font-mono font-medium",
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
            
            {price && (
              <div className={cn(
                "px-2 py-0.5 rounded-md font-semibold text-xs",
                "bg-gradient-to-r from-[var(--accent-blue)]/10 to-[var(--accent-aqua)]/10",
                "border border-[var(--accent-aqua)]/20 text-[var(--accent-aqua)]"
              )}>
                {price}€
              </div>
            )}
          </div>
          
          {/* Staff */}
          {booking.staff && density !== "ultra-compact" && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-4 h-4 rounded-full bg-[var(--accent-purple)]/20 border border-[var(--accent-purple)]/30 flex items-center justify-center">
                <span className="text-[8px] font-bold" style={{ color: "var(--accent-purple)" }}>
                  {booking.staff.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span
                className={cn(
                  "truncate font-medium",
                  textSize
                )}
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--text-tertiary)",
                }}
              >
                {booking.staff.name}
              </span>
            </div>
          )}
        </div>
        
        {/* Badge de estado y acciones */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={booking.status} density={density} size="xs" />
          
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
                "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)]",
                "hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua-border)]",
                "opacity-0 group-hover:opacity-100"
              )}
            >
              <div className="w-3 h-3 rounded-full bg-[var(--accent-aqua)]" />
            </motion.button>
          )}
        </div>
      </div>
      
      {/* Efecto de brillo sutil en hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </motion.div>
  );
}
