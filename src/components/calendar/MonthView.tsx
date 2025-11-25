"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfToday } from "date-fns";
import { parseISO } from "date-fns";
import { BookingCard } from "@/components/agenda/BookingCard";
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
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0B0C10] relative p-4" role="region" aria-label="Vista mensual de reservas">
      {/* Radial Gradient Overlay for Neo-Glass effect */}
      <div 
        className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none z-0"
        style={{ transform: 'translate(-20%, -20%)' }}
      />
      
      <div className="relative z-10 flex flex-col h-full space-y-4">
        {/* Month navigation - Unified */}
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

        {/* Calendar grid - Unified */}
        <div className="grid grid-cols-7 gap-2 flex-1 overflow-y-auto scrollbar-hide" role="grid" aria-label="Calendario mensual">
          {/* Days of the week - Unified */}
          {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => (
            <div
              key={day}
              className={cn(
                "text-center text-xs font-semibold uppercase tracking-wider py-2",
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

            return (
              <motion.div
                key={idx}
                {...getMotionSafeProps({
                  initial: { opacity: 0, scale: 0.98 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { delay: idx * 0.005, duration: 0.15, ease: "easeOut" },
                })}
                className={cn(
                  "rounded-xl min-h-[80px] sm:min-h-[100px] cursor-pointer transition-all duration-200",
                  "bg-[var(--glass-bg-default)] backdrop-blur-md",
                  "border border-[var(--glass-border)]",
                  "shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)]",
                  !isCurrentMonth && "opacity-30",
                  isSelected
                    ? "ring-2 ring-[var(--accent-blue)]/50 bg-[var(--accent-blue)]/10"
                    : "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-subtle)]",
                  isTodayDate && !isSelected && "ring-1 ring-[var(--accent-aqua)]/30 bg-[var(--accent-aqua)]/5"
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
                  {dayBookings.slice(0, 2).map((booking, index) => (
                    <div key={booking.id} onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onBookingClick(booking);
                    }}>
                      <BookingCard
                        booking={booking}
                        timezone={timezone}
                        variant="grid"
                        onClick={() => onBookingClick(booking)}
                      />
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className={cn(
                        "text-xs text-center py-1 px-2 rounded-md cursor-pointer transition-all duration-200",
                        "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                        "bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg-hover)]",
                        "border border-[var(--glass-border-subtle)] hover:border-[var(--glass-border)]"
                      )}
                    >
                      +{dayBookings.length - 2} más
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

