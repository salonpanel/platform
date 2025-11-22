"use client";

import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Booking, BookingStatus } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { interactionPresets, getMotionSafeProps } from "../motion/presets";

interface AppointmentCardProps {
  booking: Booking;
  position: { top: number; height: number };
  isDragging?: boolean;
  isGhost?: boolean;
  onClick?: (booking: Booking) => void;
  onMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
}

const getStatusTokens = (status: string) => {
  const statusMap: Record<string, any> = {
    pending: theme.statusTokens?.pending || { bg: "rgba(255,193,7,0.12)", border: "rgba(255,193,7,0.25)", text: "#FFC107" },
    confirmed: theme.statusTokens?.confirmed || { bg: "rgba(79,227,193,0.12)", border: "rgba(79,227,193,0.25)", text: "#4FE3C1" },
    cancelled: theme.statusTokens?.cancelled || { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", text: "#EF4444" },
    completed: theme.statusTokens?.completed || { bg: "rgba(58,109,255,0.12)", border: "rgba(58,109,255,0.25)", text: "#3A6DFF" },
    "no-show": theme.statusTokens?.["no-show"] || { bg: "rgba(255,109,163,0.12)", border: "rgba(255,109,163,0.25)", text: "#FF6DA3" },
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
        "absolute left-3 right-3 rounded-xl border relative transition-all duration-150",
        "hover:z-20 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:ring-offset-2 focus:ring-offset-primary focus:z-30",
        isGhost ? "opacity-30 border-dashed" : "",
        isPast && !isDragging ? "opacity-50 grayscale-[0.2]" : "",
        isDragging && !isGhost ? "cursor-grabbing opacity-85 z-50" : isDragging ? "" : "cursor-grab z-10",
        "backdrop-blur-md group",
        height >= 80 ? "p-3" : height >= 64 ? "p-2.5" : "p-2"
      )}
      style={{
        borderRadius: "14px",
        top: `${top}px`,
        height: `${Math.max(height, 48)}px`,
        minHeight: "48px",
        background: getStatusTokens(booking.status).bg,
        borderColor: getStatusTokens(booking.status).border,
        boxShadow: isDragging && !isGhost
          ? theme.shadows.neon
          : theme.shadows.sm,
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
            "text-xs font-mono font-semibold leading-tight whitespace-nowrap",
            "text-secondary font-mono"
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
              "font-semibold truncate tracking-tight",
              height >= 80 ? "text-sm leading-snug" : height >= 64 ? "text-xs leading-snug" : "text-xs leading-snug",
              "text-primary font-sans"
            )}
            title={booking.customer?.name || "Sin cliente"}
          >
            {booking.customer?.name || "Sin cliente"}
          </div>

          {height >= 64 && (
            <div
              className={cn(
                "truncate leading-tight mt-0.5",
                "text-xs text-secondary font-sans"
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
            "border-t border-border-default"
          )}>
            {paidAmount > 0 && (
              <span className={cn(
                "font-semibold text-xs leading-tight whitespace-nowrap",
                "text-accent-aqua font-sans"
              )}>
                {(paidAmount / 100).toFixed(2)}€
              </span>
            )}
            {totalPrice > 0 && (
              <span className={cn(
                "font-medium text-xs leading-tight whitespace-nowrap",
                paidAmount > 0 ? "text-secondary" : "text-secondary",
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
