"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay, startOfToday } from "date-fns";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking } from "@/types/agenda";
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

  return (
    // TODO: PHASE 1 AUDIT FINDING - Mobile viewport issue
    // Current min-w-[800px] forces horizontal scroll on mobile (~375px)
    // BREAKS: "no horizontal scroll" requirement
    // SOLUTION NEEDED: Auto-fallback to Day view on mobile, or responsive grid
    <div className="w-full h-full overflow-x-auto scrollbar-hide bg-[var(--bg-primary)]" role="region" aria-label="Vista semanal de reservas">
      <div className="min-w-[800px] h-full">
        {/* Header with days of the week - Premium */}
        <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] backdrop-blur-md rounded-[var(--radius-xl)] p-4 mb-4 sticky top-0 z-10 shadow-[var(--shadow-premium)]">
          <div className="grid grid-cols-8">
            <div className={cn(
              "text-sm font-semibold border-r border-[var(--glass-border-subtle)] pr-2",
              "text-[var(--text-secondary)] font-[var(--font-heading)]"
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
                    "text-center border-r border-[var(--glass-border-subtle)] transition-all duration-200 relative px-2",
                    isSelected
                      ? "bg-[var(--accent-blue-glass)] border-b-2 border-[var(--accent-blue)] rounded-lg"
                      : isTodayDate
                      ? "bg-[var(--accent-aqua-glass)] border-b-2 border-[var(--accent-aqua)]/40 rounded-lg"
                      : "hover:bg-[var(--glass-bg-subtle)]"
                  )}
                >
                  <div className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-1",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )}>
                    {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day)}
                  </div>
                  <div className={cn(
                    "text-lg font-semibold",
                    isSelected
                      ? "text-[var(--accent-blue)]"
                      : isTodayDate
                      ? "text-[var(--accent-aqua)]"
                      : "text-[var(--text-primary)]",
                    "font-[var(--font-heading)]"
                  )}>
                    {format(day, "d")}
                  </div>
                  {isTodayDate && !isSelected && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent-aqua)]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="relative flex-1 overflow-y-auto scrollbar-hide bg-[var(--bg-primary)]" role="region" aria-label="Timeline semanal">
          <div className="grid grid-cols-8">
            {/* Time Column */}
            <div className="border-r border-[var(--glass-border-subtle)]" role="columnheader">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "text-xs font-semibold border-b border-[var(--glass-border-subtle)] min-h-[60px] p-2",
                    "text-[var(--text-secondary)] font-[var(--font-mono)]"
                  )}
                  role="cell"
                  aria-label={`${hour}:00`}
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
                  className="relative border-r border-[var(--glass-border-subtle)]"
                  style={{
                    minHeight: `${hours.length * 60}px`,
                  }}
                >
                  {/* Hour rows (visual only) */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-[var(--glass-border-subtle)] min-h-[60px]"
                    />
                  ))}
                  {/* Bookings for this day */}
                  {dayBookings.map((booking) => {
                    const position = getBookingPosition(booking);
                    const isCompact = parseFloat(position.height.replace("%", "")) < 15;

                    return (
                      <div
                        key={booking.id}
                        style={{
                          position: "absolute",
                          left: "8px",
                          right: "8px",
                          top: position.top,
                          height: position.height,
                          minHeight: "50px",
                        }}
                      >
                        <AppointmentCard
                          booking={booking}
                          timezone={timezone}
                          compact={isCompact}
                          variant="timeline"
                          onClick={() => onBookingClick(booking)}
                          showStatus={!isCompact}
                        />
                      </div>
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

