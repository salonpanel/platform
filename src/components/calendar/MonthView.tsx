"use client";

import { useMemo } from "react";
import React from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfToday } from "date-fns";
import { parseISO } from "date-fns";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking } from "@/types/agenda";
import { cn } from "@/lib/utils";
import { interactionPresets, getMotionSafeProps } from "@/components/agenda/motion/presets";

interface MonthViewProps {
  bookings: Booking[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onDayViewClick?: (date: string) => void;  // navega a DayView en esa fecha
  onBookingClick: (booking: Booking) => void;
  onBookingContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
  timezone?: string;
}

export const MonthView = React.memo(function MonthView({
  bookings,
  selectedDate,
  onDateSelect,
  onDayViewClick,
  onBookingClick,
  onBookingContextMenu,
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
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bf-bg)]" role="region" aria-label="Vista mensual de reservas">
      <div className="flex flex-col h-full">
        {/* Month navigation */}
        <div className="bg-[var(--bf-bg-elev)] border-b border-[var(--bf-border)] px-4 py-3 flex items-center justify-between">
            <motion.button
              whileHover={{ opacity: 0.8 }}
              whileTap={{ opacity: 0.9 }}
              onClick={() => navigateMonth("prev")}
              className={cn(
                "p-2 rounded-[var(--r-lg)] transition-all duration-200",
                "text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)]"
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
            <h3 className={cn(
              "text-lg font-semibold tracking-tight",
              "text-[var(--bf-ink-50)] font-[var(--font-sans)]"
            )}>
              {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(currentDate)}
            </h3>
            <motion.button
              whileHover={{ opacity: 0.8 }}
              whileTap={{ opacity: 0.9 }}
              onClick={() => navigateMonth("next")}
              className={cn(
                "p-2 rounded-[var(--r-lg)] transition-all duration-200",
                "text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)]"
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-[var(--bf-border)] flex-1 overflow-y-auto scrollbar-hide" role="grid" aria-label="Calendario mensual">
          {/* Days of the week - Unified */}
          {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => (
            <div
              key={day}
              className={cn(
                "text-center text-xs font-semibold uppercase tracking-wider py-2",
                "text-[var(--bf-ink-400)] font-[var(--font-sans)]"
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

            return (
              <motion.div
                key={idx}
                {...getMotionSafeProps({
                  initial: { opacity: 0, scale: 0.98 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { delay: idx * 0.005, duration: 0.15, ease: "easeOut" },
                })}
                className={cn(
                  "min-h-[80px] sm:min-h-[100px] cursor-pointer transition-all duration-200",
                  "bg-[var(--bf-bg)]",
                  "shadow-[var(--bf-shadow-card)] hover:shadow-[var(--shadow-premium-hover)]",
                  !isCurrentMonth && "opacity-30",
                  isSelected
                    ? "bg-[rgba(79,161,216,0.08)] ring-1 ring-inset ring-[var(--bf-primary)]/40"
                    : "hover:bg-[var(--bf-bg-elev)]",
                  isTodayDate && !isSelected && "ring-1 ring-[var(--bf-primary)]/30 bg-[var(--bf-primary)]/5"
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
                        ? "text-[var(--bf-primary)]"
                        : isSelected
                        ? "text-[var(--bf-primary)]"
                        : "text-[var(--bf-ink-50)]",
                      "font-[var(--font-sans)]"
                    )}
                  >
                    {day ? format(day, "d") : ""}
                  </div>
                  {isTodayDate && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--bf-primary)]" />
                  )}
                </div>
                <div className="px-2 pb-2 space-y-1">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onBookingClick(booking);
                    }}>
                      <AppointmentCard
                        booking={booking}
                        timezone={timezone}
                        variant="grid"
                        staffColor={booking.staff?.color}
                        onClick={() => onBookingClick(booking)}
                        onContextMenu={(e) => {
                          e.stopPropagation();
                          onBookingContextMenu?.(e, booking);
                        }}
                      />
                    </div>
                  ))}
                  {dayBookings.length > 3 && day && (
                    <motion.button
                      whileHover={{ scale: 1.02, opacity: 0.9 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const dateStr = format(day, "yyyy-MM-dd");
                        if (onDayViewClick) {
                          onDayViewClick(dateStr);
                        } else {
                          onDateSelect(dateStr);
                        }
                      }}
                      className={cn(
                        "w-full text-xs text-center py-1 px-2 rounded-lg cursor-pointer transition-all duration-200",
                        "text-[var(--bf-primary)] hover:text-white font-medium",
                        "bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-primary)]/10",
                        "border border-[var(--bf-border)]/50 hover:border-[var(--bf-primary)]/30",
                        "backdrop-blur-sm"
                      )}
                      title={`Ver los ${dayBookings.length} citas de este día`}
                    >
                      +{dayBookings.length - 3} más
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.bookings.length === nextProps.bookings.length &&
    prevProps.selectedDate === nextProps.selectedDate &&
    prevProps.timezone === nextProps.timezone &&
    prevProps.onBookingClick === nextProps.onBookingClick &&
    prevProps.onBookingContextMenu === nextProps.onBookingContextMenu &&
    prevProps.onDateSelect === nextProps.onDateSelect &&
    prevProps.onDayViewClick === nextProps.onDayViewClick
  );
});

