"use client";

import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
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

// Status color mapping
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: "#FFC107",
    confirmed: "#4FE3C1",
    paid: "#3A6DFF",
    completed: "#3A6DFF",
    cancelled: "#EF4444",
    "no-show": "#FF6DA3",
    "no_show": "#FF6DA3",
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
  const isSmallSlot = height < 55;

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
        "border border-white/10 rounded-2xl",
        "backdrop-blur-md",
        isGhost ? "opacity-30 border-dashed border-white/20" : "bg-[#1a1d24]/90 shadow-lg",
        isPast && !isDragging ? "opacity-60" : "",
        isDragging && !isGhost ? "cursor-grabbing z-50 shadow-2xl scale-[1.02] ring-1 ring-white/20" : "cursor-grab z-20",
        "group focus:outline-none focus:ring-2 focus:ring-[#4FE3C1]/50 focus:ring-offset-0"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, isSmallSlot ? 40 : 52)}px`,
        minHeight: isSmallSlot ? "40px" : "52px",
        background: "linear-gradient(135deg, rgba(26,29,36,0.95), rgba(18,21,28,0.98))",
        backdropFilter: "blur(12px)",
        borderRadius: "16px",
      }}
      title={`${booking.customer?.name || "Sin cliente"} - ${booking.service?.name || "Sin servicio"} (${format(localStartsAt, "HH:mm")} - ${format(localEndsAt, "HH:mm")})`}
    >
      {/* Left colored accent bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" 
        style={{ 
          backgroundColor: statusColor,
          borderRadius: "16px 0 0 16px" 
        }}
      />

      {/* Card content - fully contained with proper overflow handling */}
      <div className={cn(
        "flex flex-col h-full w-full overflow-hidden",
        isSmallSlot ? "justify-center pl-3 pr-2 py-2" : "pl-3 pr-3 py-2.5"
      )}>
        
        {/* Time header - only show if space permits */}
        {!isSmallSlot && (
          <div className="flex items-center justify-between mb-1 min-w-0">
            <span className="text-[10px] font-mono font-medium text-white/50 truncate">
              {format(localStartsAt, "HH:mm")} - {format(localEndsAt, "HH:mm")}
            </span>
          </div>
        )}

        {/* Main Content - Customer name */}
        <div className="flex items-center gap-2 min-w-0 mb-1">
          <div className={cn(
            "font-semibold truncate text-white flex-1 min-w-0",
            isSmallSlot ? "text-xs" : "text-sm"
          )}>
            {booking.customer?.name || "Sin cliente"}
          </div>
          
          {/* Time for small slots (inline) */}
          {isSmallSlot && (
            <span className="text-[10px] text-white/40 font-mono flex-shrink-0">
              {format(localStartsAt, "HH:mm")}
            </span>
          )}
        </div>

        {/* Service - hide on small slots */}
        {!isSmallSlot && (
          <div className="text-xs text-white/60 truncate min-w-0">
            {booking.service?.name || "Sin servicio"}
          </div>
        )}

        {/* Status badge for larger slots */}
        {!isSmallSlot && height >= 70 && (
          <div 
            className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium self-start"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
              border: `1px solid ${statusColor}40`
            }}
          >
            {booking.status === "pending" && "Pendiente"}
            {booking.status === "confirmed" && "Confirmado"}
            {booking.status === "paid" && "Pagado"}
            {booking.status === "completed" && "Completado"}
            {booking.status === "cancelled" && "Cancelado"}
            {booking.status === "no-show" && "No asistió"}
            {booking.status === "no_show" && "No asistió"}
          </div>
        )}
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
