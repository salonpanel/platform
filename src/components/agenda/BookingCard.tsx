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

  // Status color mapping with consistent tokens
  const getStatusColors = () => {
    switch (booking.status) {
      case "paid":
        return {
          bg: "bg-[rgba(79,227,193,0.14)]",
          border: "border border-[rgba(79,227,193,0.32)]",
          text: "text-[#C7F7EA]",
          accent: "bg-[#4FE3C1]"
        };
      case "completed":
        return {
          bg: "bg-[rgba(58,109,255,0.14)]",
          border: "border border-[rgba(58,109,255,0.32)]",
          text: "text-[#C2D4FF]",
          accent: "bg-[#3A6DFF]"
        };
      case "pending":
      case "hold":
        return {
          bg: "bg-[rgba(250,204,21,0.16)]",
          border: "border border-[rgba(250,204,21,0.28)]",
          text: "text-[#FACC15]",
          accent: "bg-[#FACC15]"
        };
      case "cancelled":
      case "no_show":
        return {
          bg: "bg-[rgba(255,109,163,0.16)]",
          border: "border border-[rgba(255,109,163,0.32)]",
          text: "text-[#FFB4D1]",
          accent: "bg-[#FF6DA3]"
        };
      default:
        return {
          bg: "bg-white/5",
          border: "border border-white/10",
          text: "text-white",
          accent: "bg-white/60"
        };
    }
  };

  const statusColors = getStatusColors();

  // Base card styles with consistent design tokens
  const baseClasses = cn(
    "relative group cursor-pointer transition-all duration-200",
    "bg-white/6 backdrop-blur-xl",
    "border border-white/10",
    "rounded-2xl shadow-[0_14px_32px_rgba(0,0,0,0.35)]",
    "focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/50 focus:ring-offset-0",
    "hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] hover:-translate-y-0.5",
    "overflow-hidden",
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
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          whileHover: canDrag ? { y: -1, boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)" } : { y: -1, boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)" },
          whileTap: { scale: 0.98 },
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "absolute left-2 right-2")}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${booking.service?.name || "Sin servicio"}. Estado: ${statusConfig.label}. ${isDragging ? 'Arrastrando' : canDrag ? 'Arrastrable' : ''}`}
        aria-describedby={isDragging ? "drag-instructions" : undefined}
        style={{
          background: isDragging ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: isDragging ? "0 8px 25px -4px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.08)",
          cursor: isDragging ? "grabbing" : canDrag ? "grab" : "pointer"
        }}
      >
        {/* Left colored border (3px wide) */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", statusColors.accent)} />

        {/* Resize handles */}
        {canResize && (
          <>
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/20 rounded-t cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.();
              }}
            />
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/20 rounded-b cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart?.();
              }}
            />
          </>
        )}

        <div className="pl-4 pr-3 py-2 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-semibold text-white/90">
                {(booking.customer?.name || "").charAt(0) || "C"}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-white leading-tight truncate">
                  {booking.customer?.name || "Sin cliente"}
                </p>
                <p className="text-[11px] text-white/60 leading-tight truncate">
                  {booking.service?.name || "Sin servicio"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="px-2 py-1 rounded-full bg-white/10 text-[11px] font-mono text-white/90 border border-white/15">
                {startTime} - {endTime}
              </div>
              <div className={cn(
                "px-2 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1", statusColors.bg, statusColors.border, statusColors.text
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusColors.accent)} />
                {statusConfig.label}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-white/70 leading-tight">
            <div className="flex items-center gap-2 min-w-0">
              <Scissors className="w-3.5 h-3.5 text-white/50" />
              <span className="truncate">{booking.service?.name || "Servicio"}</span>
            </div>
            {booking.service?.duration_min && (
              <span className="text-white/60">{booking.service.duration_min}min</span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-white/70">
            {booking.staff ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white/80">
                  {booking.staff.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{booking.staff.name}</span>
              </div>
            ) : (
              <span className="text-white/50">Sin asignar</span>
            )}

            {booking.service?.price_cents && (
              <div className="flex items-center gap-1 font-semibold text-white/90">
                <Euro className="w-3 h-3" />
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
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          whileHover: { y: -1, boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)" },
          whileTap: { scale: 0.98 },
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "w-full")}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${endTime}`}
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
        }}
      >
        {/* Left colored border */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", statusColors.accent)} />

        <div className="pl-5 pr-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header: Customer + Time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <User className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {booking.customer?.name || "Sin cliente"}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-sm font-mono font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {startTime} - {endTime}
                </div>
              </div>

              {/* Service details */}
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  {booking.service?.name || "Sin servicio"}
                  {booking.service?.duration_min && (
                    <span className="text-slate-500 dark:text-slate-400 ml-2">
                      • {booking.service.duration_min}min
                    </span>
                  )}
                </div>
              </div>

              {/* Staff */}
              {booking.staff && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      {booking.staff.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {booking.staff.name}
                  </span>
                </div>
              )}

              {/* Contact info */}
              {booking.customer?.phone && (
                <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                  <span className="text-slate-600 dark:text-slate-400">📞</span>
                  {booking.customer.phone}
                </div>
              )}
            </div>

            {/* Price + Status */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {booking.service?.price_cents && (
                <div className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <Euro className="w-3 h-3" />
                  {(booking.service.price_cents / 100).toFixed(0)}€
                </div>
              )}
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
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
          whileHover: { y: -1, boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)" },
          whileTap: { scale: 0.98 },
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
