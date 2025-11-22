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

// Neo-Glass Status Colors (Neon/Vibrant)
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: "#FFC107",   // Neon Yellow
    confirmed: "#4FE3C1", // Neon Aqua
    paid: "#3A6DFF",      // Electric Blue
    completed: "#3A6DFF", // Electric Blue
    cancelled: "#EF4444", // Neon Red
    "no-show": "#FF6DA3", // Neon Pink
    "no_show": "#FF6DA3", // Neon Pink (alternative)
  };
  return colors[status] || colors.pending;
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
  const statusColor = getStatusColor(booking.status);
  const isSmallSlot = height < 60;

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
        "absolute left-2 right-2 rounded-xl md:rounded-2xl transition-all duration-200",
        "border border-white/10",
        "backdrop-blur-md",
        isGhost ? "opacity-30 border-dashed border-white/20" : "bg-[#15171C]/60 shadow-lg",
        isPast && !isDragging ? "opacity-60 grayscale-[0.3]" : "",
        isDragging && !isGhost ? "cursor-grabbing z-50 shadow-2xl scale-105 ring-1 ring-white/20" : "cursor-grab z-20",
        "group overflow-hidden"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, isSmallSlot ? 36 : 48)}px`,
        minHeight: isSmallSlot ? "36px" : "48px",
        borderLeftWidth: "3px",
        borderLeftColor: statusColor,
        // Inset top highlight for glass effect
        boxShadow: isDragging ? "0 20px 40px -10px rgba(0,0,0,0.5)" : "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.1)",
      }}
      title={`${booking.customer?.name || "Sin cliente"} - ${booking.service?.name || "Sin servicio"} (${format(localStartsAt, "HH:mm")} - ${format(localEndsAt, "HH:mm")})`}
    >
      <div className={cn("flex flex-col h-full w-full", isSmallSlot ? "justify-center px-2" : "p-3")}>
        
        {/* Top Row: Time & Status (Only show if space permits) */}
        {!isSmallSlot && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-medium text-gray-400 tracking-wide">
              {format(localStartsAt, "HH:mm")}
            </span>
          </div>
        )}

        {/* Main Content */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Client Name */}
          <div className={cn(
            "font-medium truncate text-white",
            isSmallSlot ? "text-xs" : "text-sm"
          )}>
            {booking.customer?.name || "Sin cliente"}
          </div>
          
          {/* Time for small slots (inline) */}
          {isSmallSlot && (
            <span className="text-[10px] text-gray-500 font-mono shrink-0">
              {format(localStartsAt, "HH:mm")}
            </span>
          )}
        </div>

        {/* Secondary Info (Service) - Hide on small slots */}
        {!isSmallSlot && (
          <div className="text-xs text-gray-500 truncate mt-0.5 font-medium">
            {booking.service?.name || "Sin servicio"}
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
