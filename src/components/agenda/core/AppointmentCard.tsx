"use client";

import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Booking, BookingStatus } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { interactionPresets, getMotionSafeProps } from "../motion/presets";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

interface AppointmentCardProps {
  booking: Booking;
  position: { top: number; height: number };
  isDragging?: boolean;
  isGhost?: boolean;
  onClick?: (booking: Booking) => void;
  onMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
}

// Type para tokens de status
interface StatusTokens {
  bg: string;
  border: string;
  text: string;
  borderLeft: string;
}

const getStatusTokens = (status: string): StatusTokens => {
  const statusMap: Record<string, StatusTokens> = {
    pending: { bg: "rgba(21,23,28,0.6)", border: "rgba(255,255,255,0.1)", text: "#FFC107", borderLeft: "#FFC107" },
    confirmed: { bg: "rgba(21,23,28,0.6)", border: "rgba(255,255,255,0.1)", text: "#4FE3C1", borderLeft: "#4FE3C1" },
    paid: { bg: "rgba(21,23,28,0.6)", border: "rgba(255,255,255,0.1)", text: "#3A6DFF", borderLeft: "#3A6DFF" },
    cancelled: { bg: "rgba(21,23,28,0.6)", border: "rgba(255,255,255,0.1)", text: "#EF4444", borderLeft: "#EF4444" },
    completed: { bg: "rgba(21,23,28,0.6)", border: "rgba(255,255,255,0.1)", text: "#4FE3C1", borderLeft: "#4FE3C1" },
    "no_show": { bg: "rgba(21,23,28,0.6)", border: "rgba(255,255,255,0.1)", text: "#FF6DA3", borderLeft: "#FF6DA3" },
  };
  return statusMap[status] || statusMap.pending;
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
  const totalPrice = booking.service?.price_cents || 0;
  const paidAmount = (booking.status === "paid" || booking.status === "completed") ? totalPrice : 0;

  return (
    <motion.div
      {...getMotionSafeProps({
        initial: { opacity: 0, y: 8, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -8, scale: 0.98 },
        transition: {
          duration: 0.15,
          ease: [0.4, 0, 0.2, 1]
        },
        whileHover: !isDragging ? interactionPresets.appointmentCard.hover : {},
        whileTap: !isDragging ? interactionPresets.appointmentCard.tap : {},
      })}
      data-booking
      tabIndex={0}
      role="button"
      aria-label={`Cita de ${booking.customer?.name || "cliente"} con ${booking.staff?.name || "sin asignar"} de ${format(localStartsAt, "HH:mm")} a ${format(localEndsAt, "HH:mm")}, estado ${booking.status}`}
      ref={(el) => {
        if (el) {
          // Store booking refs for keyboard navigation
        }
      }}
      onFocus={() => {
        // Handle focus
      }}
      onBlur={() => {
        // Handle blur
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        // Handle keyboard navigation
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
        "absolute left-3 right-3 rounded-xl border relative transition-all duration-200",
        "hover:z-30 focus:outline-none focus:ring-2 focus:ring-accent-blue/40 focus:ring-offset-1 focus:ring-offset-transparent focus:z-30",
        "min-h-[48px] touch-manipulation",
        "backdrop-blur-md shadow-lg hover:shadow-xl border-l-[3px]",
        "hover:bg-[#15171C]/80 hover:scale-[1.02]",
        isGhost ? "opacity-30 border-dashed" : "",
        isPast && !isDragging ? "opacity-70 saturate-50" : "",
        isDragging && !isGhost ? "cursor-grabbing z-50 shadow-2xl scale-[1.03]" : isDragging ? "" : "cursor-grab z-20",
        height >= 80 ? "p-3" : height >= 64 ? "p-2.5" : "p-2"
      )}
      style={{
        borderRadius: height >= 80 ? "16px" : "12px",
        top: `${top}px`,
        height: `${Math.max(height, 48)}px`,
        minHeight: "48px",
        background: getStatusTokens(booking.status).bg,
        borderLeftColor: getStatusTokens(booking.status).borderLeft,
        borderRightColor: getStatusTokens(booking.status).border,
        borderTopColor: getStatusTokens(booking.status).border,
        borderBottomColor: getStatusTokens(booking.status).border,
        boxShadow: isDragging && !isGhost
          ? `0 20px 48px -12px rgba(0,0,0,0.5), 0 0 0 1px ${getStatusTokens(booking.status).borderLeft}40, inset 0 1px 0 rgba(255,255,255,0.05)`
          : `0 8px 24px -8px rgba(0,0,0,0.3), 0 0 0 1px ${getStatusTokens(booking.status).borderLeft}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
        // Hardware acceleration
        transform: "translateZ(0)",
        willChange: "transform, opacity",
      }}
      title={`${booking.customer?.name || "Sin cliente"} - ${booking.service?.name || "Sin servicio"} (${format(localStartsAt, "HH:mm")} - ${format(localEndsAt, "HH:mm")})`}
    >
      {/* Contenedor principal con layout flexible y responsive */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Header: Horario y Estado */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0 mb-0.5">
          <span className={cn(
            "text-[10px] font-mono leading-tight whitespace-nowrap",
            "text-gray-400"
          )}>
            {format(localStartsAt, "HH:mm")} – {format(localEndsAt, "HH:mm")}
          </span>
          {height >= 64 && (
            <StatusBadge status={booking.status} size="xs" />
          )}
        </div>

        {/* Contenido principal: Cliente y Servicio */}
        <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
          <div
            className={cn(
              "font-medium truncate",
              height >= 80 ? "text-sm leading-snug" : height >= 64 ? "text-xs leading-snug" : "text-xs leading-snug",
              "text-white font-sans"
            )}
            title={booking.customer?.name || "Sin cliente"}
          >
            {booking.customer?.name || "Sin cliente"}
          </div>

          {height >= 60 && (
            <div
              className={cn(
                "truncate leading-tight mt-0.5",
                "text-xs text-gray-500 font-sans"
              )}
              title={booking.service?.name || "Sin servicio"}
            >
              {booking.service?.name || "Sin servicio"}
            </div>
          )}
        </div>

        {/* Footer: Precios */}
        {height >= 80 && (paidAmount > 0 || totalPrice > 0) && (
          <div className={cn(
            "flex items-center justify-end gap-1.5 flex-shrink-0 mt-auto pt-1.5",
            "border-t border-white/5"
          )}>
            {paidAmount > 0 && (
              <span className={cn(
                "font-semibold text-xs leading-tight whitespace-nowrap",
                "text-[#4FE3C1] font-sans"
              )}>
                {(paidAmount / 100).toFixed(2)}€
              </span>
            )}
            {totalPrice > 0 && (
              <span className={cn(
                "font-medium text-xs leading-tight whitespace-nowrap",
                paidAmount > 0 ? "text-gray-400" : "text-gray-400",
                "font-sans"
              )}>
                {(totalPrice / 100).toFixed(2)}€
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
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
