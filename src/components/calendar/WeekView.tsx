"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay, startOfToday } from "date-fns";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { interactionPresets, getMotionSafeProps } from "@/components/agenda/motion/presets";

interface WeekViewProps {
  bookings: Booking[];
  staffList: Array<{ id: string; name: string }>;
  selectedDate: string;
  timezone: string;
  onBookingClick: (booking: Booking) => void;
}

export function WeekView({
  bookings,
  staffList,
  selectedDate,
  timezone,
  onBookingClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }); // Lunes
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00
  const today = startOfToday();

  // Agrupar bookings por día usando useMemo para mejor performance
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    weekDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      map.set(dayKey, []);
    });

    bookings.forEach((booking) => {
      const bookingDate = new Date(booking.starts_at);
      const localBookingDate = toTenantLocalDate(bookingDate, timezone);
      const dayKey = format(localBookingDate, "yyyy-MM-dd");
      if (map.has(dayKey)) {
        map.get(dayKey)!.push(booking);
      }
    });

    return map;
  }, [bookings, weekDays, timezone]);

  const getBookingsForDay = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    return bookingsByDay.get(dayKey) || [];
  };

  const getBookingPosition = (booking: Booking) => {
    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    
    // Convertir a timezone local
    const localStart = toTenantLocalDate(start, timezone);
    const localEnd = toTenantLocalDate(end, timezone);
    
    const startHour = localStart.getHours() + localStart.getMinutes() / 60;
    const endHour = localEnd.getHours() + localEnd.getMinutes() / 60;
    const duration = endHour - startHour;

    const top = ((startHour - 8) / 13) * 100; // 8:00 es 0%, 21:00 es 100%
    const height = (duration / 13) * 100;

    return { top: `${top}%`, height: `${height}%` };
  };

  // Use theme-based status colors
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

  return (
    <div className="w-full h-full overflow-x-auto scrollbar-hide bg-primary">
      <div className="min-w-[800px] h-full">
        {/* Header with days of the week - Premium */}
        <GlassCard variant="elevated" padding="md" className="grid grid-cols-8 border-b border-border-default sticky top-0 z-10">
          <div className={cn(
            "text-sm font-semibold border-r border-border-default",
            "text-primary font-sans"
          )}>
            Hora
          </div>
          {weekDays.map((day, idx) => {
            const isSelected = isSameDay(day, parseISO(selectedDate));
            const isTodayDate = isSameDay(day, today);
            return (
              <div
                key={idx}
                className={cn(
                  "text-center border-r border-border-default transition-colors relative",
                  isSelected
                    ? "bg-accent-blue/10 border-b-2 border-accent-blue"
                    : isTodayDate
                    ? "bg-accent-aqua/8 border-b-2 border-accent-aqua/40"
                    : "hover:bg-glass"
                )}
              >
                <div className={cn(
                  "text-xs font-semibold uppercase tracking-wider mb-1",
                  "text-tertiary font-sans"
                )}>
                  {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day)}
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  isSelected
                    ? "text-accent-blue"
                    : isTodayDate
                    ? "text-accent-aqua"
                    : "text-primary",
                  "font-sans"
                )}>
                  {format(day, "d")}
                </div>
                {isTodayDate && !isSelected && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent-aqua" />
                )}
              </div>
            );
          })}
        </GlassCard>

        {/* Timeline */}
        <div className="relative flex-1 overflow-y-auto scrollbar-hide bg-primary">
          <div className="grid grid-cols-8">
            {/* Time Column */}
            <div className="border-r border-border-default">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "text-xs font-semibold border-b border-border-default min-h-[60px]",
                    "text-secondary font-mono font-sans"
                  )}
                >
                  {hour}:00
                </div>
              ))}
            </div>
            {/* Day columns with bookings */}
            {weekDays.map((day, dayIdx) => {
              const dayBookings = getBookingsForDay(day);
              return (
                <div
                  key={dayIdx}
                  className="relative border-r border-border-default"
                  style={{
                    minHeight: `${hours.length * 60}px`,
                  }}
                >
                  {/* Hour rows (visual only) */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border-default min-h-[60px]"
                    />
                  ))}
                  {/* Bookings for this day */}
                  {dayBookings.map((booking) => {
                    const position = getBookingPosition(booking);
                    const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
                    const statusTokens = getStatusTokens(booking.status);

                    return (
                      <motion.div
                        key={booking.id}
                        {...getMotionSafeProps({
                          initial: { opacity: 0, scale: 0.95 },
                          animate: { opacity: 1, scale: 1 },
                          whileHover: interactionPresets.appointmentCard.hover,
                          whileTap: interactionPresets.appointmentCard.tap,
                        })}
                        onClick={() => onBookingClick(booking)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onBookingClick(booking);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
                        className={cn(
                          "absolute left-2 right-2 rounded-xl border-l-4 cursor-pointer",
                          "focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:ring-offset-2 focus:ring-offset-primary",
                          "transition-all backdrop-blur-md group"
                        )}
                        style={{
                          top: position.top,
                          height: position.height,
                          minHeight: "50px",
                          background: statusTokens.bg,
                          borderLeftColor: statusTokens.border,
                          boxShadow: statusTokens.shadow,
                        }}
                      >
                        {/* Time - Priority 1 */}
                        <div className={cn(
                          "text-xs font-semibold mb-1 font-mono",
                          "text-secondary font-sans"
                        )}>
                          {startTime}
                        </div>
                        {/* Customer - Priority 2 */}
                        <div className={cn(
                          "text-sm font-semibold truncate mb-1",
                          "text-primary font-sans"
                        )}>
                          {booking.customer?.name || "Sin cliente"}
                        </div>
                        {/* Service - Priority 3 (if space) */}
                        {parseFloat(position.height.replace("%", "")) > 15 && (
                          <div className={cn(
                            "text-xs truncate mb-1.5",
                            "text-secondary font-sans"
                          )}>
                            {booking.service?.name || "Sin servicio"}
                          </div>
                        )}
                        {/* Status badge if space */}
                        {parseFloat(position.height.replace("%", "")) > 20 && (
                          <div>
                            <StatusBadge status={booking.status} size="xs" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

