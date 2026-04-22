"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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
import { AgendaQuickActions } from "@/components/agenda/AgendaQuickActions";
import type { MobileAgendaToolbarProps } from "@/components/agenda/AgendaQuickActions";

function generateDistinctHslColors(count: number): string[] {
  if (count <= 0) return [];
  // Deterministic evenly-spaced hues. HSL keeps good contrast on dark backgrounds.
  const saturation = 78;
  const lightness = 56;
  return Array.from({ length: count }, (_, i) => {
    const hue = Math.round((360 / count) * i);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  });
}

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
  mobileToolbar?: MobileAgendaToolbarProps;
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
  mobileToolbar,
}: WeekViewProps) {
  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }); // Lunes
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00
  const today = startOfToday();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Unique, deterministic staff colors (never repeated), used in "Todos" list mode.
  const staffColorById = useMemo(() => {
    const colors = generateDistinctHslColors(staffList.length);
    const map = new Map<string, string>();
    staffList.forEach((s, idx) => {
      map.set(s.id, colors[idx] ?? "hsl(180 80% 55%)");
    });
    return map;
  }, [staffList]);

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

  // ─── Mobile view: infinite day strip + filtered list ───────────────────────
  if (isMobile) {
    return (
      <MobileWeekView
        bookings={bookings}
        staffList={staffList}
        timezone={timezone}
        selectedDate={selectedDate}
        staffColorById={staffColorById}
        bookingsByDay={bookingsByDay}
        onBookingClick={onBookingClick}
        onBookingContextMenu={onBookingContextMenu}
        mobileSelectedStaffId={mobileSelectedStaffId ?? null}
        onMobileStaffChange={onMobileStaffChange}
        bookingCounts={bookingCounts}
        mobileToolbar={mobileToolbar}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bf-bg)]" role="region" aria-label="Vista semanal de reservas">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header días de la semana — plano, sin card flotante */}
        <div className="border-b border-[var(--bf-border)] bg-[var(--bf-bg-elev)] px-4 py-3">
          <div className="grid grid-cols-8 gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bf-ink-400)] border-r border-[var(--bf-border)] pr-2 flex items-center justify-center" style={{ fontFamily: "var(--font-mono)" }}>
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
                      ? "bg-[var(--bf-primary)]/20 ring-1 ring-[var(--bf-primary)]/50"
                      : isTodayDate
                      ? "bg-[var(--bf-primary)]/15 ring-1 ring-[var(--bf-primary)]/30"
                      : "hover:bg-[var(--bf-bg-elev)] border-r border-[var(--bf-border)]/50"
                  )}
                >
                  <div className={cn(
                    "text-xs font-semibold uppercase tracking-wider mb-1",
                    "text-[var(--bf-ink-400)] font-[var(--font-sans)]"
                  )}>
                    {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day)}
                  </div>
                  <div className={cn(
                    "text-lg font-semibold",
                    isSelected
                      ? "text-[var(--bf-primary)]"
                      : isTodayDate
                      ? "text-[var(--bf-primary)]"
                      : "text-[var(--bf-ink-50)]",
                    "font-[var(--font-sans)]"
                  )}>
                    {format(day, "d")}
                  </div>
                  {isTodayDate && !isSelected && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--bf-primary)]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline - Unified */}
        <div className="relative flex-1 overflow-x-auto overflow-y-auto scrollbar-hide" role="region" aria-label="Timeline semanal">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 gap-px bg-[var(--bf-border)]">
              {/* Time Column */}
              <div className="bg-[var(--bf-bg)]" role="columnheader">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className={cn(
                      "text-xs font-semibold border-b border-[var(--bf-border)]/50 min-h-[60px] p-2",
                      "text-[var(--bf-ink-400)] font-[var(--font-mono)] bg-[var(--bf-bg-elev)]"
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
                    className="relative bg-[var(--bf-bg)]"
                    style={{
                      minHeight: `${hours.length * 60}px`,
                    }}
                  >
                    {/* Hour rows (visual only) */}
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="border-b border-[var(--bf-border)]/50 min-h-[60px] hover:bg-[var(--bf-bg-elev)] transition-colors cursor-pointer"
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
  return (
    prevProps.bookings.length === nextProps.bookings.length &&
    prevProps.selectedDate === nextProps.selectedDate &&
    prevProps.timezone === nextProps.timezone &&
    prevProps.staffList.length === nextProps.staffList.length &&
    prevProps.mobileSelectedStaffId === nextProps.mobileSelectedStaffId &&
    prevProps.onMobileStaffChange === nextProps.onMobileStaffChange &&
    prevProps.onBookingClick === nextProps.onBookingClick &&
    prevProps.onPopoverShow === nextProps.onPopoverShow &&
    prevProps.onBookingContextMenu === nextProps.onBookingContextMenu &&
    prevProps.mobileToolbar === nextProps.mobileToolbar
  );
});

// ─── MobileWeekView — infinite horizontal day strip ─────────────────────────
// Genera PAST_DAYS días antes de hoy y FUTURE_DAYS días después.
// Al montar hace scroll automático para que hoy quede como primer elemento visible.
const PAST_DAYS = 60;
const FUTURE_DAYS = 180;

interface MobileWeekViewProps {
  bookings: Booking[];
  staffList: Staff[];
  timezone: string;
  selectedDate: string;
  staffColorById: Map<string, string>;
  bookingsByDay: Map<string, Booking[]>;
  onBookingClick: (booking: Booking) => void;
  onBookingContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
  mobileSelectedStaffId: string | null;
  onMobileStaffChange?: (staffId: string | null) => void;
  bookingCounts?: Record<string, number>;
  mobileToolbar?: MobileAgendaToolbarProps;
}

function MobileWeekView({
  bookings,
  staffList,
  timezone,
  selectedDate,
  staffColorById,
  bookingsByDay,
  onBookingClick,
  onBookingContextMenu,
  mobileSelectedStaffId,
  onMobileStaffChange,
  bookingCounts,
  mobileToolbar,
}: MobileWeekViewProps) {
  const today = startOfToday();

  // Genera el array infinito de días
  const allDays = useMemo(() => {
    return Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, i) =>
      addDays(today, i - PAST_DAYS)
    );
  }, [today]);

  // Día seleccionado: default = hoy o el selectedDate si es válido
  const [selectedMobileDay, setSelectedMobileDay] = useState<string>(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    return selectedDate || todayKey;
  });

  // Bookings enriquecidos para el día seleccionado
  const activeStaffId =
    mobileSelectedStaffId === null
      ? null
      : staffList.some((s) => s.id === mobileSelectedStaffId)
      ? mobileSelectedStaffId
      : staffList[0]?.id ?? null;

  const mobileDayBookingsAll = useMemo(() => {
    const all: Booking[] = [];
    bookings.forEach((b) => {
      const d = new Date(b.starts_at);
      const local = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
      if (format(local, "yyyy-MM-dd") === selectedMobileDay) all.push(b);
    });
    return all;
  }, [bookings, selectedMobileDay, timezone]);

  const mobileDayBookings = activeStaffId
    ? mobileDayBookingsAll.filter((b) => b.staff_id === activeStaffId)
    : mobileDayBookingsAll;

  // Conteo por día (para el badge en las fichas)
  const countByDay = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      const d = new Date(b.starts_at);
      const local = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
      const k = format(local, "yyyy-MM-dd");
      map[k] = (map[k] ?? 0) + 1;
    });
    return map;
  }, [bookings, timezone]);

  // Ref para el scroll del strip de días
  const stripRef = useRef<HTMLDivElement>(null);
  const todayBtnRef = useRef<HTMLButtonElement>(null);

  // Al montar: scroll automático para que hoy sea el primer visible
  useEffect(() => {
    requestAnimationFrame(() => {
      if (todayBtnRef.current && stripRef.current) {
        stripRef.current.scrollLeft = todayBtnRef.current.offsetLeft - 8; // 8px de margen izq
      }
    });
  }, []);

  // Mes del día seleccionado (para la cabecera)
  const monthLabel = useMemo(() => {
    const d = parseISO(selectedMobileDay);
    return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
  }, [selectedMobileDay]);

  const statsLine = mobileToolbar?.quickStats && mobileToolbar.quickStats.totalBookings > 0
    ? [
        `${mobileToolbar.quickStats.totalBookings} citas`,
        mobileToolbar.quickStats.totalHours > 0 ? `${mobileToolbar.quickStats.totalHours}h` : null,
        mobileToolbar.quickStats.totalAmount > 0
          ? `${Math.round(mobileToolbar.quickStats.totalAmount / 100)}€`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bf-bg)]" role="region" aria-label="Vista semanal móvil">
      {/* Mes + acciones (sin duplicar barra superior de la página) */}
      <div
        className="flex-shrink-0 px-3 py-2 bg-[var(--bf-bg)]"
        style={{ borderBottom: "1px solid var(--bf-border)" }}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2 w-full min-w-0">
            <h2
              className="capitalize font-semibold text-sm tracking-tight text-center min-w-0 truncate"
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--bf-ink-50)",
                letterSpacing: "-0.01em",
              }}
            >
              {monthLabel}
            </h2>
            {mobileToolbar && (
              <AgendaQuickActions
                onSearchClick={mobileToolbar.onSearchClick}
                onNotificationsClick={mobileToolbar.onNotificationsClick}
                unreadNotifications={mobileToolbar.unreadNotifications}
                filters={mobileToolbar.filters}
                onFiltersChange={mobileToolbar.onFiltersChange}
                filterMenuSide="right"
                className="flex-shrink-0"
              />
            )}
          </div>
          {statsLine && (
            <p
              className="text-[10px] text-[var(--bf-ink-400)] font-medium text-center truncate max-w-full px-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {statsLine}
            </p>
          )}
        </div>
      </div>

      {/* ── Tira infinita de días ── */}
      <div
        ref={stripRef}
        className="flex-shrink-0 flex gap-1.5 px-2 py-2 overflow-x-auto scrollbar-hide"
        style={{ background: "var(--bf-bg)", borderBottom: "1px solid var(--bf-border)" }}
      >
        {allDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const todayKey = format(today, "yyyy-MM-dd");
          const isSelected = dayKey === selectedMobileDay;
          const isToday = dayKey === todayKey;
          const count = countByDay[dayKey] ?? 0;

          return (
            <button
              key={dayKey}
              ref={isToday ? todayBtnRef : undefined}
              type="button"
              onClick={() => setSelectedMobileDay(dayKey)}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 rounded-[var(--r-md)] px-2.5 py-1.5 min-w-[46px] transition-all duration-150 relative"
              style={
                isSelected
                  ? { backgroundColor: "var(--bf-primary)", border: "none" }
                  : isToday
                  ? { backgroundColor: "rgba(79,161,216,0.10)", border: "1px solid rgba(79,161,216,0.35)" }
                  : { backgroundColor: "transparent", border: "1px solid transparent" }
              }
            >
              {/* Día de semana */}
              <span
                className="text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: isSelected ? "var(--bf-ink)" : isToday ? "var(--bf-primary)" : "var(--bf-ink-400)",
                }}
              >
                {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day).slice(0, 2)}
              </span>

              {/* Número de día */}
              <span
                className="text-[17px] font-bold leading-none"
                style={{
                  fontFamily: "var(--font-sans)",
                  letterSpacing: "-0.02em",
                  color: isSelected ? "var(--bf-ink)" : isToday ? "var(--bf-primary)" : "var(--bf-ink-50)",
                }}
              >
                {format(day, "d")}
              </span>

              {/* Badge de citas */}
              {count > 0 && (
                <span
                  className="text-[9px] font-bold leading-none px-1.5 py-0.5 rounded-full mt-0.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    backgroundColor: isSelected ? "rgba(5,7,10,0.25)" : "rgba(79,161,216,0.15)",
                    color: isSelected ? "var(--bf-ink)" : "var(--bf-primary)",
                  }}
                >
                  {count}
                </span>
              )}

              {/* Punto indicador de hoy (cuando no está seleccionado) */}
              {isToday && !isSelected && (
                <div
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ backgroundColor: "var(--bf-primary)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Staff switcher (bajo la tira de días) */}
      {staffList.length > 1 && onMobileStaffChange && (
        <div className="flex-shrink-0">
          <MobileStaffSwitcher
            staffList={staffList}
            selectedStaffId={activeStaffId}
            onSelectStaff={onMobileStaffChange}
            bookingCounts={bookingCounts}
            includeAllOption
          />
        </div>
      )}

      {/* Lista de reservas del día seleccionado */}
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
                  staffColor={
                    booking.staff_id
                      ? staffColorById.get(booking.staff_id)
                      : (booking.staff?.color ?? null)
                  }
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
              description={`No hay citas para ${new Intl.DateTimeFormat("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(parseISO(selectedMobileDay))}`}
              variant="default"
            />
          </div>
        )}
      </div>
    </div>
  );
}

