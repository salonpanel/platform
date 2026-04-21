"use client";

import { useMemo, useState, useEffect } from "react";
import React from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay, startOfToday } from "date-fns";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking, Staff, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { buildStaffWindowsForDay, type TimeWindow } from "@/components/agenda/utils/timeWindows";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { GlassEmptyState } from "@/components/ui/glass";
import { Calendar } from "lucide-react";
import { MobileStaffSwitcher } from "@/components/agenda/MobileStaffSwitcher";

interface WeekViewProps {
  bookings: Booking[];
  staffList: Staff[];
  selectedDate: string;
  timezone: string;
  onBookingClick: (booking: Booking) => void;
  onPopoverShow?: (position: { x: number; y: number }, slot?: { staffId: string; date: string; time: string }, booking?: Booking) => void;
  onBookingContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
  staffSchedules?: StaffSchedule[];
  staffBlockings?: StaffBlocking[];
  // Mobile: show staff switcher under day chips, and filter to one staff
  mobileSelectedStaffId?: string | null;
  onMobileStaffChange?: (staffId: string | null) => void;
  bookingCounts?: Record<string, number>;
}

export const WeekView = React.memo(function WeekView({
  bookings,
  staffList,
  selectedDate,
  timezone,
  onBookingClick,
  onPopoverShow,
  onBookingContextMenu,
  staffSchedules,
  staffBlockings,
  mobileSelectedStaffId,
  onMobileStaffChange,
  bookingCounts,
}: WeekViewProps) {
  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }); // Lunes
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00
  const today = startOfToday();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Mobile: día seleccionado para filtrar bookings (por defecto: el día seleccionado o hoy)
  const defaultMobileDay = useMemo(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    const found = weekDays.find((d) => format(d, "yyyy-MM-dd") === selectedDate);
    return found ? selectedDate : (weekDays.find((d) => format(d, "yyyy-MM-dd") === todayKey) ? todayKey : format(weekDays[0], "yyyy-MM-dd"));
  }, [weekDays, selectedDate, today]);

  const [selectedMobileDay, setSelectedMobileDay] = useState<string>(defaultMobileDay);

  // Sync selectedMobileDay when week changes (e.g. user navigates to a different week)
  useEffect(() => {
    const weekKeys = weekDays.map((d) => format(d, "yyyy-MM-dd"));
    if (!weekKeys.includes(selectedMobileDay)) {
      setSelectedMobileDay(defaultMobileDay);
    }
  }, [defaultMobileDay, weekDays, selectedMobileDay]);

  // Availability windows per day (union of all staff windows for that date)
  const availabilityByDay = useMemo(() => {
    const map = new Map<string, TimeWindow[]>();

    if (!staffSchedules || staffSchedules.length === 0) {
      return map;
    }

    const blockings = staffBlockings || [];

    weekDays.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const windowsByStaff = buildStaffWindowsForDay(staffSchedules, blockings, dateKey, timezone);

      const allWindows: TimeWindow[] = [];
      Object.values(windowsByStaff).forEach((wins) => {
        if (wins && wins.length) {
          allWindows.push(...wins);
        }
      });

      if (allWindows.length > 0) {
        allWindows.sort((a, b) => a.startMinutes - b.startMinutes);
        map.set(dateKey, allWindows);
      }
    });

    return map;
  }, [weekDays, staffSchedules, staffBlockings, timezone]);

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

  const handleSlotClick = (e: React.MouseEvent, day: Date, hour: number) => {
    if (!onPopoverShow) return;

    const date = format(day, "yyyy-MM-dd");
    const windows = availabilityByDay.get(date);

    if (windows && windows.length > 0) {
      const startMinutes = hour * 60;
      const isInside = windows.some(
        (w) => startMinutes >= w.startMinutes && startMinutes < w.endMinutes
      );

      // If the clicked slot is outside any availability window, do not allow creating a booking
      if (!isInside) {
        return;
      }
    }

    const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
    onPopoverShow(
      { x: e.clientX, y: e.clientY },
      { staffId: "", date, time: timeSlot }
    );
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

  // Mobile view: day chips + filtered list
  if (isMobile) {
    const activeStaffId =
      mobileSelectedStaffId && staffList.some((s) => s.id === mobileSelectedStaffId)
        ? mobileSelectedStaffId
        : (staffList[0]?.id ?? null);

    const mobileDayBookingsAll = bookingsByDay.get(selectedMobileDay) || [];
    const mobileDayBookings = activeStaffId
      ? mobileDayBookingsAll.filter((b) => b.staff_id === activeStaffId)
      : mobileDayBookingsAll;

    return (
      <div className="w-full h-full flex flex-col overflow-hidden bg-[#0B0C10] relative" role="region" aria-label="Vista semanal móvil">
        {/* Radial Gradient Overlay */}
        <div
          className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none z-0"
          style={{ transform: 'translate(-20%, -20%)' }}
        />

        <div className="relative z-10 flex flex-col h-full overflow-hidden">
          {/* Day chips — sticky horizontal scroller */}
          <div
            className="flex-shrink-0 flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide"
            style={{ borderBottom: '1px solid var(--glass-border-subtle)' }}
          >
            {weekDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const isSelected = dayKey === selectedMobileDay;
              const isToday = isSameDay(day, today);
              const count = (bookingsByDay.get(dayKey) || []).length;

              return (
                <button
                  key={dayKey}
                  onClick={() => setSelectedMobileDay(dayKey)}
                  className="flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 min-w-[48px] transition-all duration-200 relative"
                  style={isSelected ? {
                    backgroundColor: 'rgba(58,109,255,0.2)',
                    border: '1px solid rgba(58,109,255,0.5)',
                  } : isToday ? {
                    backgroundColor: 'rgba(79,227,193,0.1)',
                    border: '1px solid rgba(79,227,193,0.3)',
                  } : {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--glass-border-subtle)',
                  }}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: isSelected ? '#3A6DFF' : isToday ? '#4FE3C1' : 'var(--text-tertiary)' }}
                  >
                    {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day).slice(0, 2)}
                  </span>
                  <span
                    className="text-base font-bold leading-none"
                    style={{ color: isSelected ? '#3A6DFF' : isToday ? '#4FE3C1' : 'var(--text-primary)' }}
                  >
                    {format(day, "d")}
                  </span>
                  {count > 0 && (
                    <span
                      className="text-[9px] font-semibold leading-none mt-0.5 px-1 rounded-full"
                      style={{
                        backgroundColor: isSelected ? 'rgba(58,109,255,0.3)' : 'rgba(255,255,255,0.1)',
                        color: isSelected ? '#3A6DFF' : 'var(--text-secondary)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                  {isToday && !isSelected && (
                    <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#4FE3C1]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Staff switcher — MUST be under day chips (mobile) */}
          {staffList.length > 1 && onMobileStaffChange && (
            <div className="flex-shrink-0">
              <MobileStaffSwitcher
                staffList={staffList}
                selectedStaffId={activeStaffId}
                onSelectStaff={onMobileStaffChange}
                bookingCounts={bookingCounts}
              />
            </div>
          )}

          {/* Bookings list for selected day */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 py-3">
            {mobileDayBookings.length > 0 ? (
              <div className="space-y-2">
                {mobileDayBookings
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                  .map((booking) => (
                    <AppointmentCard
                      key={booking.id}
                      booking={booking}
                      timezone={timezone}
                      variant="list"
                      staffColor={booking.staff?.color}
                      onClick={() => onBookingClick(booking)}
                      onContextMenu={(e) => onBookingContextMenu?.(e, booking)}
                    />
                  ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <GlassEmptyState
                  icon={Calendar}
                  title="Sin citas"
                  description={`No hay citas para ${new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(parseISO(selectedMobileDay))}`}
                  variant="default"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0B0C10] relative p-4" role="region" aria-label="Vista semanal de reservas">
      {/* Radial Gradient Overlay for Neo-Glass effect */}
      <div 
        className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none z-0"
        style={{ transform: 'translate(-20%, -20%)' }}
      />
      
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Header with days of the week - Unified */}
        <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] backdrop-blur-md rounded-[var(--radius-xl)] p-4 mb-4 shadow-[var(--shadow-premium)]">
          <div className="grid grid-cols-8 gap-2">
            <div className={cn(
              "text-sm font-semibold border-r border-[var(--glass-border-subtle)] pr-2",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
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
                    "text-center transition-all duration-200 relative px-2 rounded-lg",
                    isSelected
                      ? "bg-[var(--accent-blue)]/20 ring-1 ring-[var(--accent-blue)]/50"
                      : isTodayDate
                      ? "bg-[var(--accent-aqua)]/15 ring-1 ring-[var(--accent-aqua)]/30"
                      : "hover:bg-[var(--glass-bg-subtle)] border-r border-[var(--glass-border-subtle)]"
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

        {/* Timeline - Unified */}
        <div className="relative flex-1 overflow-x-auto overflow-y-auto scrollbar-hide" role="region" aria-label="Timeline semanal">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 gap-px bg-[var(--glass-border-subtle)]">
              {/* Time Column */}
              <div className="bg-[#0B0C10]" role="columnheader">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className={cn(
                      "text-xs font-semibold border-b border-[var(--glass-border-subtle)] min-h-[60px] p-2",
                      "text-[var(--text-tertiary)] font-[var(--font-mono)] bg-[var(--glass-bg-subtle)]"
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
                    className="relative bg-[#0B0C10]"
                    style={{
                      minHeight: `${hours.length * 60}px`,
                    }}
                  >
                    {/* Hour rows (visual only) */}
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="border-b border-[var(--glass-border-subtle)] min-h-[60px] hover:bg-[var(--glass-bg-subtle)] transition-colors cursor-pointer"
                        onClick={(e) => handleSlotClick(e, day, hour)}
                      />
                    ))}
                    {/* Bookings for this day */}
                    {dayBookings.map((booking) => {
                      const position = getBookingPosition(booking);

                      return (
                        <div
                          key={booking.id}
                          style={{
                            position: "absolute",
                            left: "4px",
                            right: "4px",
                            top: position.top,
                            height: position.height,
                            minHeight: "50px",
                          }}
                        >
                          <AppointmentCard
                            booking={booking}
                            timezone={timezone}
                            variant="timeline"
                            staffColor={booking.staff?.color}
                            onClick={() => onBookingClick(booking)}
                            onContextMenu={(e) => onBookingContextMenu?.(e, booking)}
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
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.bookings.length === nextProps.bookings.length &&
    prevProps.selectedDate === nextProps.selectedDate &&
    prevProps.timezone === nextProps.timezone &&
    prevProps.staffList.length === nextProps.staffList.length &&
    prevProps.onBookingClick === nextProps.onBookingClick &&
    prevProps.onPopoverShow === nextProps.onPopoverShow &&
    prevProps.onBookingContextMenu === nextProps.onBookingContextMenu
  );
});

