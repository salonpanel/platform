"use client";

import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Clock, User, Scissors } from "lucide-react";
import { Booking } from "@/types/agenda";
import { cn } from "@/lib/utils";
import { getMotionSafeProps } from "../motion/presets";

interface AppointmentCardProps {
  booking: Booking;
  position: { top: number; height: number };
  isDragging?: boolean;
  isGhost?: boolean;
  onClick?: (booking: Booking) => void;
  onMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
}

// Status color mapping with gradient backgrounds
const getStatusStyles = (status: string) => {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    pending: { color: "#FFC107", bg: "rgba(255, 193, 7, 0.08)", border: "rgba(255, 193, 7, 0.3)" },
    confirmed: { color: "#4FE3C1", bg: "rgba(79, 227, 193, 0.08)", border: "rgba(79, 227, 193, 0.3)" },
    hold: { color: "#FFC107", bg: "rgba(255, 193, 7, 0.08)", border: "rgba(255, 193, 7, 0.3)" },
    paid: { color: "#3A6DFF", bg: "rgba(58, 109, 255, 0.08)", border: "rgba(58, 109, 255, 0.3)" },
    completed: { color: "#3A6DFF", bg: "rgba(58, 109, 255, 0.08)", border: "rgba(58, 109, 255, 0.3)" },
    cancelled: { color: "#EF4444", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.3)" },
    "no-show": { color: "#FF6DA3", bg: "rgba(255, 109, 163, 0.08)", border: "rgba(255, 109, 163, 0.3)" },
    "no_show": { color: "#FF6DA3", bg: "rgba(255, 109, 163, 0.08)", border: "rgba(255, 109, 163, 0.3)" },
  };
  return styles[status] || styles.pending;
};

// Determine card density based on height
const getCardDensity = (height: number): "ultra-compact" | "compact" | "normal" | "expanded" => {
  if (height < 45) return "ultra-compact";
  if (height < 65) return "compact";
  if (height < 90) return "normal";
  return "expanded";
};

export const AppointmentCard = React.memo(function AppointmentCard({
  booking,
  position,
  isDragging = false,
  isGhost = false,
  onClick,
  onMouseDown
}: AppointmentCardProps) {
  const { top, height } = position;

  // Convert dates to local timezone
  const startsAt = new Date(booking.starts_at);
  const endsAt = new Date(booking.ends_at);
  const localStartsAt = new Date(
    startsAt.toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );
  const localEndsAt = new Date(
    endsAt.toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );

  const isPast = localEndsAt < new Date();
  const statusStyles = getStatusStyles(booking.status);
  const density = getCardDensity(height);

  // Responsive padding based on density
  const paddingClass = {
    "ultra-compact": "px-2.5 py-1",
    "compact": "px-3 py-1.5",
    "normal": "px-3 py-2",
    "expanded": "px-3.5 py-2.5"
  }[density];

  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0, y: 4, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.98 },
        transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
        whileHover: !isDragging ? { y: -2, scale: 1.01, boxShadow: "0 8px 24px -4px rgba(0,0,0,0.3)" } : {},
        whileTap: !isDragging ? { scale: 0.98 } : {},
      })}
      data-booking
      tabIndex={0}
      role="button"
      aria-label={`Cita de ${booking.customer?.name || "cliente"} con ${booking.staff?.name || "sin asignar"} de ${format(localStartsAt, "HH:mm")} a ${format(localEndsAt, "HH:mm")}, estado ${booking.status}`}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(booking);
        }
      }}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (onMouseDown) {
          e.stopPropagation();
          onMouseDown(e, booking, top);
        }
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onClick?.(booking);
      }}
      className={cn(
        // Position and sizing - use more margin to prevent overlap with hour lines
        "absolute left-2 right-2",
        // Rounded design consistent with other views
        "rounded-2xl",
        // Border and glass effect
        "border backdrop-blur-md",
        // Overflow handling - ensure content stays within bounds
        "overflow-hidden",
        // Transitions and shadows
        "transition-all duration-200 shadow-lg",
        // Ghost state for drag preview
        isGhost ? "opacity-30 border-dashed" : "",
        // Past appointment styling
        isPast && !isDragging ? "opacity-70" : "",
        // Dragging state
        isDragging && !isGhost 
          ? "cursor-grabbing z-50 shadow-2xl scale-[1.02] ring-2 ring-white/20" 
          : "cursor-grab z-20",
        // Group for hover effects
        "group",
        // Focus ring for accessibility
        "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-transparent"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, density === "ultra-compact" ? 36 : 48)}px`,
        minHeight: density === "ultra-compact" ? "36px" : "48px",
        // Status-based left border
        borderLeftWidth: "4px",
        borderLeftColor: statusStyles.color,
        // Rounded corners
        borderRadius: "16px",
        // Glass background with status tint
        background: `linear-gradient(135deg, ${statusStyles.bg}, rgba(26, 29, 36, 0.95))`,
        borderColor: isGhost ? "rgba(255,255,255,0.2)" : statusStyles.border,
      }}
      title={`${booking.customer?.name || "Sin cliente"} - ${booking.service?.name || "Sin servicio"} (${format(localStartsAt, "HH:mm")} - ${format(localEndsAt, "HH:mm")})`}
    >
      {/* Content wrapper with proper overflow handling */}
      <div className={cn(
        "flex flex-col h-full w-full min-w-0",
        paddingClass,
        // Ensure content fits
        "overflow-hidden"
      )}>
        
        {/* Ultra-compact layout: Single line with customer + time */}
        {density === "ultra-compact" && (
          <div className="flex items-center justify-between gap-2 h-full min-w-0">
            <span className="text-xs font-medium text-white truncate flex-1 min-w-0">
              {booking.customer?.name || "Sin cliente"}
            </span>
            <span className="text-[10px] font-mono text-white/50 flex-shrink-0">
              {format(localStartsAt, "HH:mm")}
            </span>
          </div>
        )}

        {/* Compact layout: Customer on top, time below or inline */}
        {density === "compact" && (
          <div className="flex flex-col justify-center h-full gap-0.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-white truncate flex-1 min-w-0">
                {booking.customer?.name || "Sin cliente"}
              </span>
              <span className="text-[10px] font-mono text-white/50 flex-shrink-0">
                {format(localStartsAt, "HH:mm")}
              </span>
            </div>
            {booking.service?.name && (
              <span className="text-[10px] text-white/40 truncate">
                {booking.service.name}
              </span>
            )}
          </div>
        )}

        {/* Normal layout: Full info with icons */}
        {density === "normal" && (
          <div className="flex flex-col justify-center h-full gap-1 min-w-0">
            {/* Header row: Customer + Time */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <User className="w-3 h-3 text-white/40 flex-shrink-0" />
                <span className="text-sm font-medium text-white truncate">
                  {booking.customer?.name || "Sin cliente"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/50 flex-shrink-0">
                <Clock className="w-2.5 h-2.5" />
                <span className="font-mono">{format(localStartsAt, "HH:mm")}</span>
              </div>
            </div>
            {/* Service row */}
            {booking.service?.name && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Scissors className="w-2.5 h-2.5 text-white/30 flex-shrink-0" />
                <span className="text-xs text-white/50 truncate">
                  {booking.service.name}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Expanded layout: All info with more details */}
        {density === "expanded" && (
          <div className="flex flex-col justify-between h-full gap-1.5 min-w-0">
            {/* Header with time range */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1 text-[11px] text-white/60 flex-shrink-0">
                <Clock className="w-3 h-3" />
                <span className="font-mono font-medium">
                  {format(localStartsAt, "HH:mm")} - {format(localEndsAt, "HH:mm")}
                </span>
              </div>
              {booking.service?.price_cents && (
                <span className="text-[10px] font-medium text-white/50 flex-shrink-0">
                  {(booking.service.price_cents / 100).toFixed(0)}€
                </span>
              )}
            </div>
            
            {/* Customer name */}
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              <span className="text-sm font-semibold text-white truncate">
                {booking.customer?.name || "Sin cliente"}
              </span>
            </div>
            
            {/* Service and staff */}
            <div className="flex items-center gap-2 min-w-0">
              {booking.service?.name && (
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <Scissors className="w-3 h-3 text-white/30 flex-shrink-0" />
                  <span className="text-xs text-white/50 truncate">
                    {booking.service.name}
                  </span>
                </div>
              )}
              {booking.staff?.name && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white/70">
                      {booking.staff.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subtle shine effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.booking.id === nextProps.booking.id &&
    prevProps.booking.status === nextProps.booking.status &&
    prevProps.booking.starts_at === nextProps.booking.starts_at &&
    prevProps.booking.ends_at === nextProps.booking.ends_at &&
    prevProps.position.top === nextProps.position.top &&
    prevProps.position.height === nextProps.position.height &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isGhost === nextProps.isGhost
  );
});
