"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfToday } from "date-fns";
import { parseISO } from "date-fns";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { interactionPresets, getMotionSafeProps } from "@/components/agenda/motion/presets";

interface MonthViewProps {
  bookings: Booking[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onBookingClick: (booking: Booking) => void;
  timezone?: string;
}

export function MonthView({
  bookings,
  selectedDate,
  onDateSelect,
  onBookingClick,
  timezone = "Europe/Madrid",
}: MonthViewProps) {
  const currentDate = parseISO(selectedDate);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfMonth(currentDate);
  const calendarEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = startOfToday();

  // Añadir días del mes anterior/siguiente para completar la semana
  const firstDayOfWeek = calendarStart.getDay();
  const lastDayOfWeek = calendarEnd.getDay();
  const daysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Lunes = 0
  const daysAfter = 7 - (lastDayOfWeek === 0 ? 7 : lastDayOfWeek);

  const allDays: (Date | null)[] = useMemo(() => [
    ...Array(daysBefore).fill(null),
    ...days,
    ...Array(daysAfter).fill(null),
  ], [daysBefore, days, daysAfter]);

  // Agrupar bookings por día usando useMemo para mejor performance
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    days.forEach((day) => {
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

    // Ordenar bookings por hora de inicio dentro de cada día
    map.forEach((dayBookings) => {
      dayBookings.sort((a, b) => {
        const aTime = new Date(a.starts_at).getTime();
        const bTime = new Date(b.starts_at).getTime();
        return aTime - bTime;
      });
    });

    return map;
  }, [bookings, days, timezone]);

  const getBookingsForDay = (day: Date | null) => {
    if (!day) return [];
    const dayKey = format(day, "yyyy-MM-dd");
    return bookingsByDay.get(dayKey) || [];
  };

  // Obtener iniciales del cliente o nombre corto
  const getCustomerInitial = (name: string | null | undefined): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = direction === "next" 
      ? addMonths(currentDate, 1)
      : subMonths(currentDate, 1);
    onDateSelect(format(newDate, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-5 h-full flex flex-col p-4" role="region" aria-label="Vista mensual de reservas">
      {/* Month navigation - Premium */}
      <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] backdrop-blur-md rounded-[var(--radius-xl)] p-4 shadow-[var(--shadow-premium)]">
        <div className="flex items-center justify-between">
          <motion.button
            {...getMotionSafeProps({
              whileHover: interactionPresets.button.hover,
              whileTap: interactionPresets.button.tap,
              transition: interactionPresets.button.transition,
            })}
            onClick={() => navigateMonth("prev")}
            className={cn(
              "p-2 rounded-[var(--radius-lg)] transition-all duration-200",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)]"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <h3 className={cn(
            "text-lg font-semibold tracking-tight",
            "text-[var(--text-primary)] font-[var(--font-heading)]"
          )}>
            {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(currentDate)}
          </h3>
          <motion.button
            {...getMotionSafeProps({
              whileHover: interactionPresets.button.hover,
              whileTap: interactionPresets.button.tap,
              transition: interactionPresets.button.transition,
            })}
            onClick={() => navigateMonth("next")}
            className={cn(
              "p-2 rounded-[var(--radius-lg)] transition-all duration-200",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)]"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 flex-1" role="grid" aria-label="Calendario mensual">
        {/* Days of the week - Premium */}
        {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => (
          <div
            key={day}
            className={cn(
              "text-center text-xs font-semibold uppercase tracking-wider",
              "text-[var(--text-tertiary)] font-[var(--font-body)]"
            )}
            role="columnheader"
            aria-label={day}
          >
            {day}
          </div>
        ))}

        {/* Días del mes */}
        {allDays.map((day, idx) => {
          const dayBookings = getBookingsForDay(day);
          const isCurrentMonth = day ? isSameMonth(day, currentDate) : false;
          const isSelected = day ? isSameDay(day, currentDate) : false;
          const isTodayDate = day ? isSameDay(day, today) : false;

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
            <motion.div
              key={idx}
              {...getMotionSafeProps({
                initial: { opacity: 0, scale: 0.98 },
                animate: { opacity: 1, scale: 1 },
                transition: { delay: idx * 0.005, duration: 0.15, ease: "easeOut" },
              })}
              className={cn(
                "rounded-[var(--radius-lg)] min-h-[80px] sm:min-h-[100px] cursor-pointer transition-all duration-200",
                "bg-[var(--bg-primary)] border backdrop-blur-md",
                !isCurrentMonth && "opacity-30",
                isSelected
                  ? "ring-2 ring-[var(--accent-blue)] bg-[var(--accent-blue-glass)] border-[var(--accent-blue)]"
                  : "border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-subtle)]",
                isTodayDate && !isSelected && "bg-[var(--accent-aqua-glass)] border-[var(--accent-aqua)]/40"
              )}
              role="gridcell"
              aria-label={day ? `${format(day, "d 'de' MMMM")}${dayBookings.length > 0 ? `, ${dayBookings.length} reserva${dayBookings.length > 1 ? 's' : ''}` : ''}` : 'Día no disponible'}
              aria-selected={isSelected}
              tabIndex={day ? 0 : -1}
              onClick={() => {
                if (day) {
                  onDateSelect(format(day, "yyyy-MM-dd"));
                }
              }}
            >
              <div className="flex items-center justify-between p-2">
                <div
                  className={cn(
                    "text-sm sm:text-base font-semibold",
                    isTodayDate
                      ? "text-[var(--accent-aqua)]"
                      : isSelected
                      ? "text-[var(--accent-blue)]"
                      : "text-[var(--text-primary)]",
                    "font-[var(--font-heading)]"
                  )}
                >
                  {day ? format(day, "d") : ""}
                </div>
                {isTodayDate && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-aqua)]" />
                )}
              </div>
              <div className="px-2 pb-2 space-y-1">
                {dayBookings.slice(0, 3).map((booking) => {
                  const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
                  const customerName = booking.customer?.name || "Sin cliente";
                  const customerInitial = getCustomerInitial(customerName);
                  const statusTokens = getStatusTokens(booking.status);

                  return (
                    <motion.div
                      key={booking.id}
                      {...getMotionSafeProps({
                        initial: { opacity: 0, x: -4 },
                        animate: { opacity: 1, x: 0 },
                        transition: { delay: 0.05, duration: 0.15 },
                        whileHover: interactionPresets.appointmentCard.hover,
                        whileTap: interactionPresets.appointmentCard.tap,
                      })}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && day) {
                          e.preventDefault();
                          e.stopPropagation();
                          onBookingClick(booking);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Cita de ${customerName} a las ${startTime}`}
                      className={cn(
                        "text-xs p-1.5 rounded-[var(--radius-md)] truncate cursor-pointer transition-all duration-200",
                        "backdrop-blur-sm flex items-center gap-1.5 border-l-2",
                        "focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
                      )}
                      style={{
                        background: statusTokens.bg,
                        borderLeftColor: statusTokens.border,
                      }}
                    >
                      {/* Status dot */}
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: statusTokens.text }}
                      />
                      {/* Time */}
                      <span className={cn(
                        "font-semibold font-[var(--font-mono)] flex-shrink-0",
                        "text-[var(--text-secondary)]"
                      )}>
                        {startTime}
                      </span>
                      {/* Customer initials */}
                      <span className={cn(
                        "font-medium truncate",
                        "text-[var(--text-primary)] font-[var(--font-body)]"
                      )}>
                        {customerInitial}
                      </span>
                    </motion.div>
                  );
                })}
                {dayBookings.length > 3 && (
                  <div className={cn(
                    "text-xs font-semibold pt-1",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )}>
                    +{dayBookings.length - 3} más
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

