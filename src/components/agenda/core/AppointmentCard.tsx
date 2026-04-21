"use client";

import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Booking, getBookingPresentation } from "@/types/agenda";
import { cn } from "@/lib/utils";
import { getMotionSafeProps } from "../motion/presets";

interface AppointmentCardProps {
  booking: Booking;
  position: { top: number; height: number };
  timezone?: string;
  isDragging?: boolean;
  isGhost?: boolean;
  onClick?: (booking: Booking) => void;
  onMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
}

const STATE_COLORS: Record<string, string> = {
  pending: "#FFC107",
  confirmed: "#38BDF8",
  in_progress: "#A78BFA",
  completed: "#4FE3C1",
  cancelled: "#9CA3AF",
  no_show: "#FF6DA3",
};

const getStateColor = (state: string) => STATE_COLORS[state] || STATE_COLORS.pending;

const getInitials = (name: string | null | undefined): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const AppointmentCard = React.memo(function AppointmentCard({
  booking,
  position,
  timezone = "Europe/Madrid",
  isDragging = false,
  isGhost = false,
  onClick,
  onMouseDown,
}: AppointmentCardProps) {
  const { top, height } = position;

  const startsAt = new Date(booking.starts_at);
  const endsAt = new Date(booking.ends_at);
  const localStartsAt = new Date(startsAt.toLocaleString("en-US", { timeZone: timezone }));
  const localEndsAt = new Date(endsAt.toLocaleString("en-US", { timeZone: timezone }));

  const isPast = localEndsAt < new Date();
  const presentation = getBookingPresentation(booking);
  const statusColor = getStateColor(presentation.bookingState);
  const isUltraSmall = height < 40;
  const isSmall = height < 55;
  const isLarge = height >= 90;

  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0, y: 4, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.98 },
        transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
        whileHover: !isDragging ? { y: -1, scale: 1.005 } : {},
        whileTap: !isDragging ? { scale: 0.99 } : {},
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
        "absolute left-2 right-2 transition-all duration-200",
        "backdrop-blur-md",
        isGhost ? "opacity-30 border-dashed border-white/20 border" : "",
        isPast && !isDragging ? "opacity-45" : "",
        isDragging && !isGhost
          ? "cursor-grabbing z-50 shadow-2xl scale-[1.02] ring-1 ring-white/20"
          : "cursor-grab z-20",
        "group focus:outline-none focus:ring-2 focus:ring-[#4FE3C1]/50 focus:ring-offset-0"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, isSmall ? 40 : 52)}px`,
        minHeight: isSmall ? "40px" : "52px",
        background: isGhost
          ? "transparent"
          : `${statusColor}12`,
        border: isGhost ? undefined : `1px solid ${statusColor}30`,
        borderRadius: "12px",
        boxShadow: isDragging ? undefined : `0 2px 8px ${statusColor}10`,
      }}
      title={`${booking.customer?.name || "Sin cliente"} — ${booking.service?.name || "Sin servicio"} (${format(localStartsAt, "HH:mm")} - ${format(localEndsAt, "HH:mm")})`}
    >
      {/* Left status bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          backgroundColor: statusColor,
          borderRadius: "12px 0 0 12px",
        }}
      />

      {isUltraSmall ? (
        /* Micro-card: iniciales + status dot */
        <div className="flex items-center h-full pl-3 pr-1.5 gap-1.5 overflow-hidden">
          <span className="text-[10px] font-bold leading-none text-white/90 truncate flex-1 min-w-0">
            {getInitials(booking.customer?.name)}
          </span>
          <span
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col h-full w-full overflow-hidden",
            isSmall ? "justify-center pl-3 pr-2 py-1.5" : "pl-3 pr-3 py-2"
          )}
        >
          {/* Time header */}
          {!isSmall && (
            <div className="flex items-center justify-between mb-1 min-w-0">
              <span className="text-[11px] font-mono text-white/45 truncate">
                {format(localStartsAt, "HH:mm")} – {format(localEndsAt, "HH:mm")}
              </span>
            </div>
          )}

          {/* Customer name */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "font-medium truncate text-white flex-1 min-w-0",
                isSmall ? "text-xs" : "text-sm"
              )}
            >
              {booking.customer?.name || "Sin cliente"}
            </div>

            {isSmall && (
              <span className="text-[11px] text-white/40 font-mono flex-shrink-0">
                {format(localStartsAt, "HH:mm")}
              </span>
            )}
          </div>

          {/* Payment microbadge (only when enough space) */}
          {!isSmall && (
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: presentation.paymentStatusConfig.legendBg,
                  color: presentation.paymentStatusConfig.legendColor,
                  border: `1px solid ${presentation.paymentStatusConfig.legendBorder}`,
                }}
              >
                {presentation.paymentStatusConfig.shortLabel}
              </span>
            </div>
          )}

          {/* Service */}
          {!isSmall && (
            <div className="text-[11px] text-white/55 truncate min-w-0 mt-0.5">
              {booking.service?.name || "Sin servicio"}
            </div>
          )}

          {/* Staff dot — large cards only */}
          {isLarge && booking.staff?.name && (
            <div className="mt-auto flex items-center gap-1.5 pt-1">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusColor, opacity: 0.7 }}
              />
              <span className="text-[10px] text-white/35 truncate">
                {booking.staff.name}
              </span>
            </div>
          )}
        </div>
      )}
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
