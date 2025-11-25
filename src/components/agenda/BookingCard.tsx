"use client";

import { motion } from "framer-motion";
import { Clock, User, Scissors, Euro } from "lucide-react";
import { Booking, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { formatInTenantTz } from "@/lib/timezone";
import { getMotionSafeProps, interactionPresets } from "./motion/presets";
import { cn } from "@/lib/utils";

interface BookingCardProps {
  booking: Booking;
  timezone: string;
  variant?: "timeline" | "list" | "grid" | "day";
  onClick?: () => void;
  onDragStart?: () => void;
  onResizeStart?: () => void;
  isDragging?: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  className?: string;
}

/**
 * Unified BookingCard component with clear visual hierarchy
 * Used across all calendar views for consistent booking display
 */
export function BookingCard({
  booking,
  timezone,
  variant = "timeline",
  onClick,
  onDragStart,
  onResizeStart,
  isDragging = false,
  canDrag = false,
  canResize = false,
  className = "",
}: BookingCardProps) {
  const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
  const endTime = formatInTenantTz(booking.ends_at, timezone, "HH:mm");
  const statusConfig = BOOKING_STATUS_CONFIG[booking.status] || BOOKING_STATUS_CONFIG.pending;

  const durationMinutes = Math.max(
    5,
    Math.round(
      (new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000
    )
  );

  const paddingClass = durationMinutes <= 20
    ? "px-3 py-2"
    : durationMinutes <= 45
      ? "px-3.5 py-2.5"
      : "px-4 py-3";

  // Status color mapping with consistent tokens
  const getStatusColors = () => {
    switch (booking.status) {
      case "completed":
        return {
          bg: "bg-sky-400/10",
          border: "border-sky-400/50",
          text: "text-sky-100",
          accent: "bg-sky-400"
        };
      case "paid":
        return {
          bg: "bg-cyan-400/15",
          border: "border-cyan-400/60",
          text: "text-cyan-50",
          accent: "bg-cyan-300"
        };
      case "pending":
      case "hold":
        return {
          bg: "bg-amber-400/15",
          border: "border-amber-300/60",
          text: "text-amber-50",
          accent: "bg-amber-300"
        };
      case "cancelled":
      case "no_show":
        return {
          bg: booking.status === "no_show" ? "bg-pink-400/15" : "bg-red-500/15",
          border: booking.status === "no_show" ? "border-pink-300/60" : "border-red-400/60",
          text: booking.status === "no_show" ? "text-pink-50" : "text-red-50",
          accent: booking.status === "no_show" ? "bg-pink-300" : "bg-red-400"
        };
      default:
        return {
          bg: "bg-slate-500/15",
          border: "border-slate-400/60",
          text: "text-slate-100",
          accent: "bg-slate-300"
        };
    }
  };

  const statusColors = getStatusColors();

  // Base card styles with rounded design
  const baseClasses = cn(
    "relative group cursor-pointer transition-all duration-200",
    "bg-[#1a1d24]/90 text-white",
    "border border-white/10 shadow-lg backdrop-blur-md",
    "rounded-2xl",
    "focus:outline-none focus:ring-2 focus:ring-[#4FE3C1]/50 focus:ring-offset-0",
    "hover:shadow-xl hover:-translate-y-0.5",
    canDrag && "cursor-grab active:cursor-grabbing",
    isDragging && "opacity-60 shadow-2xl scale-[1.02] z-50",
    className
  );

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
    // Allow tab navigation to move focus to next/previous booking
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const bookings = document.querySelectorAll('[role="button"][aria-label*="Cita"]');
      const currentIndex = Array.from(bookings).findIndex(el => el === e.currentTarget);
      const nextIndex = e.key === "ArrowDown"
        ? Math.min(currentIndex + 1, bookings.length - 1)
        : Math.max(currentIndex - 1, 0);
      (bookings[nextIndex] as HTMLElement)?.focus();
    }
  };

  // Timeline variant (for Day view timeline positioning)
  if (variant === "day") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 4, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          whileHover: { y: -1, scale: 1.005 },
          whileTap: { scale: 0.99 },
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "absolute left-2 right-2 overflow-hidden", paddingClass)}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${booking.service?.name || "Sin servicio"}. Estado: ${statusConfig.label}. ${isDragging ? 'Arrastrando' : canDrag ? 'Arrastrable' : ''}`}
        aria-describedby={isDragging ? "drag-instructions" : undefined}
        style={{
          background: "linear-gradient(135deg, rgba(26,29,36,0.95), rgba(18,21,28,0.98))",
          backdropFilter: "blur(12px)",
          borderRadius: "16px",
          cursor: isDragging ? "grabbing" : canDrag ? "grab" : "pointer"
        }}
      >
        {/* Left colored accent bar */}
        <div 
          className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl", statusColors.accent)} 
          style={{ borderRadius: "16px 0 0 16px" }}
        />

        {/* Resize handles */}
        {canResize && (
          <>
            <div
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-white/50 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.();
              }}
            />
            <div
              className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-white/50 rounded-full cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.();
              }}
            />
          </>
        )}

        {/* Card content - contained with overflow hidden */}
        <div className="flex flex-col gap-1.5 pl-3 min-h-0 overflow-hidden">
          {/* Top row: Customer + Time + Status */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <User className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
              <h3 className="text-sm font-medium text-white truncate" title={booking.customer?.name}>
                {booking.customer?.name || "Sin cliente"}
              </h3>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-white/70 whitespace-nowrap flex-shrink-0">
              <Clock className="w-3 h-3" />
              {startTime} - {endTime}
            </div>
            <div
              className={cn(
                "px-1.5 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap flex-shrink-0",
                statusColors.bg,
                statusColors.text
              )}
            >
              {statusConfig.label}
            </div>
          </div>

          {/* Bottom row: Service + Staff + Price */}
          <div className="flex items-center gap-2 text-xs text-white/60 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 min-w-0 truncate flex-shrink">
              <Scissors className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" title={booking.service?.name || "Sin servicio"}>
                {booking.service?.name || "Sin servicio"}
              </span>
            </div>

            {booking.staff && (
              <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                <div className="w-4 h-4 rounded-full bg-white/10 text-white/80 flex items-center justify-center text-[9px] font-medium">
                  {booking.staff.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            {booking.service?.price_cents && (
              <div className="flex items-center gap-0.5 text-[10px] font-medium text-white/70 whitespace-nowrap flex-shrink-0 ml-auto">
                <Euro className="w-2.5 h-2.5" />
                {(booking.service.price_cents / 100).toFixed(0)}€
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // List variant (for ListView)
  if (variant === "list") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          whileHover: { y: -1, scale: 1.005 },
          whileTap: { scale: 0.99 },
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "w-full overflow-hidden", paddingClass)}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${endTime}`}
        style={{
          background: "linear-gradient(135deg, rgba(26,29,36,0.95), rgba(18,21,28,0.98))",
          backdropFilter: "blur(12px)",
          borderRadius: "16px"
        }}
      >
        {/* Left colored accent */}
        <div 
          className={cn("absolute left-0 top-0 bottom-0 w-1", statusColors.accent)} 
          style={{ borderRadius: "16px 0 0 16px" }}
        />

        <div className="pl-4 pr-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Customer + Time */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <User className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                  <h3 className="text-sm font-medium text-white truncate">
                    {booking.customer?.name || "Sin cliente"}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-white/70 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {startTime} - {endTime}
                </div>
              </div>

              {/* Service */}
              <div className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                <span className="text-xs text-white/70 truncate">
                  {booking.service?.name || "Sin servicio"}
                </span>
              </div>

              {/* Staff */}
              {booking.staff && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-medium text-white/80">
                      {booking.staff.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-white/60 truncate">
                    {booking.staff.name}
                  </span>
                </div>
              )}
            </div>

            {/* Price + Status */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {booking.service?.price_cents && (
                <div className="flex items-center gap-0.5 text-sm font-medium text-white/80">
                  <Euro className="w-3 h-3" />
                  {(booking.service.price_cents / 100).toFixed(0)}€
                </div>
              )}
              <div className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-medium",
                statusColors.bg,
                statusColors.text
              )}>
                {statusConfig.label}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid variant (for MonthView)
  if (variant === "grid") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, x: -4 },
          animate: { opacity: 1, x: 0 },
          whileHover: { y: -1, scale: 1.02 },
          whileTap: { scale: 0.98 },
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "text-xs overflow-hidden", paddingClass)}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
        style={{ borderRadius: "12px" }}
      >
        <div className="space-y-1">
          {/* Time */}
          <div className="font-mono font-medium text-white/80">
            {startTime}
          </div>

          {/* Customer initials */}
          <div className="font-medium text-white truncate">
            {getCustomerInitials(booking.customer?.name)}
          </div>

          {/* Status dot */}
          <div className={cn("w-1.5 h-1.5 rounded-full", statusColors.accent)} />
        </div>
      </motion.div>
    );
  }

  // Timeline variant (for WeekView timeline)
  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        whileHover: interactionPresets.appointmentCard.hover,
        whileTap: interactionPresets.appointmentCard.tap,
      })}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      className={cn(baseClasses, "absolute left-2 right-2", paddingClass)}
      aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${booking.service?.name || "Sin servicio"}`}
    >
      {/* Left border accent */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[4px] rounded-l-[12px]", statusColors.accent)} />

      <div className={cn("space-y-1", paddingClass)}> 
        {/* Time - Primary */}
        <div className="text-xs font-mono font-semibold text-white/90">
          {startTime}
        </div>

        {/* Customer - Secondary */}
        <div className="text-sm font-medium text-white truncate">
          {booking.customer?.name || "Sin cliente"}
        </div>

        {/* Service - Tertiary */}
        <div className="text-xs text-white/70 truncate">
          {booking.service?.name || "Sin servicio"}
        </div>
      </div>
    </motion.div>
  );
}

// Helper function to get customer initials
function getCustomerInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

export default BookingCard;
