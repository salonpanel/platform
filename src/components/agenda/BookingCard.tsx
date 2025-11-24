"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { formatInTenantTz } from "@/lib/timezone";
import { getMotionSafeProps, interactionPresets } from "./motion/presets";

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

  // Status color mapping with consistent tokens
  const getStatusColors = () => {
    switch (booking.status) {
      case "paid":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/30",
          border: "border-emerald-200 dark:border-emerald-800/50",
          text: "text-emerald-700 dark:text-emerald-300",
          accent: "bg-emerald-500"
        };
      case "completed":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/30",
          border: "border-emerald-200 dark:border-emerald-800/50",
          text: "text-emerald-700 dark:text-emerald-300",
          accent: "bg-emerald-500"
        };
      case "pending":
      case "hold":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800/50",
          text: "text-amber-700 dark:text-amber-300",
          accent: "bg-amber-500"
        };
      case "cancelled":
      case "no_show":
        return {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800/50",
          text: "text-red-700 dark:text-red-300",
          accent: "bg-red-500"
        };
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-950/30",
          border: "border-slate-200 dark:border-slate-800/50",
          text: "text-slate-700 dark:text-slate-300",
          accent: "bg-slate-500"
        };
    }
  };

  const statusColors = getStatusColors();

  // Base card styles with consistent design tokens
  const baseClasses = cn(
    "relative group cursor-pointer transition-all duration-200",
    "bg-white dark:bg-slate-900/80 backdrop-blur-sm",
    "border border-slate-200 dark:border-slate-700/50",
    "rounded-lg shadow-sm",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1",
    "hover:shadow-md hover:-translate-y-0.5",
    canDrag && "cursor-grab active:cursor-grabbing",
    isDragging && "opacity-50 shadow-lg scale-105 z-50",
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
  };

  // Timeline variant (for Day view timeline positioning)
  if (variant === "day") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          whileHover: canDrag ? { scale: 1.02 } : interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "absolute left-2 right-2")}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${booking.service?.name || "Sin servicio"}`}
        style={{
          background: isDragging ? "rgba(255,255,255,0.9)" : undefined
        }}
      >
        {/* Left border accent */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", statusColors.accent)} />

        {/* Resize handles (top/bottom) */}
        {canResize && (
          <>
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-slate-400/50 rounded-t cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.();
              }}
            />
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-slate-400/50 rounded-b cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.();
              }}
            />
          </>
        )}

        <div className="p-3 space-y-2">
          {/* Header: Time + Status */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold font-mono text-slate-900 dark:text-slate-100">
              {startTime} - {endTime}
            </div>
            <div className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              statusColors.bg,
              statusColors.text
            )}>
              {statusConfig.label}
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-1">
            {/* Customer name - Primary */}
            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {booking.customer?.name || "Sin cliente"}
            </div>

            {/* Service - Secondary */}
            <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {booking.service?.name || "Sin servicio"}
              {booking.service?.duration_min && ` • ${booking.service.duration_min}min`}
            </div>

            {/* Staff - Tertiary */}
            {booking.staff && (
              <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-slate-700 dark:text-slate-300">
                    {booking.staff.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {booking.staff.name}
              </div>
            )}
          </div>

          {/* Price indicator */}
          {booking.service?.price_cents && (
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {(booking.service.price_cents / 100).toFixed(2)}€
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // List variant (for ListView)
  if (variant === "list") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "w-full p-4")}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${endTime}`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header: Customer + Time */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {booking.customer?.name || "Sin cliente"}
              </h3>
              <div className="text-sm font-mono text-slate-600 dark:text-slate-400 flex-shrink-0 ml-2">
                {startTime} - {endTime}
              </div>
            </div>

            {/* Service details */}
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {booking.service?.name || "Sin servicio"}
              {booking.service?.duration_min && ` • ${booking.service.duration_min} min`}
              {booking.staff && ` • ${booking.staff.name}`}
            </div>

            {/* Contact info */}
            {booking.customer?.phone && (
              <div className="text-xs text-slate-500 dark:text-slate-500">
                📞 {booking.customer.phone}
              </div>
            )}
          </div>

          {/* Status + Actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              statusColors.bg,
              statusColors.text
            )}>
              {statusConfig.label}
            </div>

            {booking.service?.price_cents && (
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {(booking.service.price_cents / 100).toFixed(2)}€
              </div>
            )}
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
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "p-2 text-xs")}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
      >
        <div className="space-y-1">
          {/* Time */}
          <div className="font-mono font-medium text-slate-700 dark:text-slate-300">
            {startTime}
          </div>

          {/* Customer initials */}
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
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
      className={cn(baseClasses, "absolute left-2 right-2")}
      aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${booking.service?.name || "Sin servicio"}`}
    >
      {/* Left border accent */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", statusColors.accent)} />

      <div className="p-2 space-y-1">
        {/* Time - Primary */}
        <div className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
          {startTime}
        </div>

        {/* Customer - Secondary */}
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {booking.customer?.name || "Sin cliente"}
        </div>

        {/* Service - Tertiary */}
        <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
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
