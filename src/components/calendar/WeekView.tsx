"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import React from "react";
import { motion } from "framer-motion";
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
  /** Móvil: sincronizar día con la agenda (URL / datos) */
  onDateChange?: (date: string) => void;
  /** Abrir modal de nueva cita (usado en empty state del desktop) */
  onNewBooking?: () => void;
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
  onDateChange,
  onNewBooking,
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
        onDateChange={onDateChange}
      />
    );
  }

  return (
    <DesktopWeekListView
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
      onDateChange={onDateChange}
      onNewBooking={onNewBooking}
    />
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
    prevProps.mobileToolbar === nextProps.mobileToolbar &&
    prevProps.onDateChange === nextProps.onDateChange &&
    prevProps.onNewBooking === nextProps.onNewBooking
  );
});

// ─── DesktopWeekListView — tira de días + lista de citas detallada ──────────
interface DesktopWeekListViewProps {
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
  onDateChange?: (date: string) => void;
  onNewBooking?: () => void;
}

function DesktopWeekListView({
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
  onDateChange,
  onNewBooking,
}: DesktopWeekListViewProps) {
  const today = startOfToday();
  const PAST_DAYS = 60;
  const FUTURE_DAYS = 180;

  const allDays = useMemo(() => {
    return Array.from({ length: PAST_DAYS + FUTURE_DAYS + 1 }, (_, i) =>
      addDays(today, i - PAST_DAYS)
    );
  }, [today]);

  const [selectedDay, setSelectedDay] = useState<string>(() => selectedDate || format(today, "yyyy-MM-dd"));

  const stripRef = useRef<HTMLDivElement>(null);
  const todayBtnRef = useRef<HTMLButtonElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const listScrolled = listScrollTop > 2;

  useEffect(() => { setListScrollTop(0); listScrollRef.current?.scrollTo({ top: 0 }); }, [selectedDay]);

  useEffect(() => {
    if (!selectedDate) return;
    setSelectedDay((prev) => {
      if (prev === selectedDate) return prev;
      requestAnimationFrame(() => scrollDayChipIntoView(stripRef.current, selectedDate));
      return selectedDate;
    });
  }, [selectedDate]);

  // Scroll to today on mount
  useEffect(() => {
    let cancelled = false;
    const strip = stripRef.current;
    const todayEl = todayBtnRef.current;
    if (!strip || !todayEl) return;
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
    const run = () => {
      if (cancelled) return;
      const finalLeft = Math.max(0, todayEl.offsetLeft - 8);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { strip.scrollLeft = finalLeft; return; }
      const approxChip = 64;
      const jumpDays = 20;
      const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
      const startLeft = Math.min(finalLeft + jumpDays * approxChip, maxScroll);
      strip.scrollLeft = startLeft;
      const duration = 520;
      const from = startLeft;
      const to = finalLeft;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const u = Math.min(1, (now - t0) / duration);
        strip.scrollLeft = from + (to - from) * easeOutCubic(u);
        if (u < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);

  const activeStaffId = mobileSelectedStaffId === null
    ? null
    : staffList.some((s) => s.id === mobileSelectedStaffId) ? mobileSelectedStaffId : staffList[0]?.id ?? null;

  const dayBookingsAll = useMemo(() => {
    return bookings.filter((b) => {
      const local = new Date(new Date(b.starts_at).toLocaleString("en-US", { timeZone: timezone }));
      return format(local, "yyyy-MM-dd") === selectedDay;
    });
  }, [bookings, selectedDay, timezone]);

  const dayBookings = activeStaffId
    ? dayBookingsAll.filter((b) => b.staff_id === activeStaffId)
    : dayBookingsAll;

  const countByDay = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      const local = new Date(new Date(b.starts_at).toLocaleString("en-US", { timeZone: timezone }));
      const k = format(local, "yyyy-MM-dd");
      map[k] = (map[k] ?? 0) + 1;
    });
    return map;
  }, [bookings, timezone]);

  const stripDateBounds = useMemo(() => ({
    min: format(allDays[0], "yyyy-MM-dd"),
    max: format(allDays[allDays.length - 1], "yyyy-MM-dd"),
  }), [allDays]);

  const selectedDayLabel = useMemo(() => {
    const raw = new Intl.DateTimeFormat("es-ES", {
      weekday: "long", day: "numeric", month: "long",
    }).format(new Date(selectedDay + "T12:00:00"));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [selectedDay]);

  const totalRevenue = useMemo(() => {
    return dayBookings.reduce((sum, b) => sum + (b.service?.price_cents ?? 0), 0) / 100;
  }, [dayBookings]);

  const dayStatsLine = dayBookings.length === 0
    ? "Sin citas"
    : `${dayBookings.length} cita${dayBookings.length !== 1 ? "s" : ""}${totalRevenue > 0 ? ` · ${totalRevenue.toFixed(0)}€` : ""}`;

  // Per-staff booking counts for the selected day (for staff pill badges)
  const bookingCountsByStaffForDay = useMemo(() => {
    const map: Record<string, number> = {};
    dayBookingsAll.forEach((b) => {
      if (b.staff_id) map[b.staff_id] = (map[b.staff_id] ?? 0) + 1;
    });
    return map;
  }, [dayBookingsAll]);

  // "EN CURSO" / "PRÓXIMO" indicators — computed at render time for today's appointments
  const nowIndicator = useMemo(() => {
    const todayKey = format(today, "yyyy-MM-dd");
    if (selectedDay !== todayKey) return { currentId: null, nextId: null };
    const nowMs = Date.now();
    const sorted = [...dayBookings].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    let currentId: string | null = null;
    let nextId: string | null = null;
    for (const b of sorted) {
      const start = new Date(b.starts_at).getTime();
      const end = new Date(b.ends_at).getTime();
      if (start <= nowMs && nowMs <= end && !currentId) {
        currentId = b.id;
      } else if (start > nowMs && !nextId) {
        nextId = b.id;
      }
    }
    return { currentId, nextId };
  }, [dayBookings, selectedDay, today]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bf-bg)]">
      {/* Toolbar: day summary + staff selector + date picker — single row */}
      <div className="flex-shrink-0 border-b border-[var(--bf-border)]/50 bg-[var(--bf-bg)] px-4 py-2 flex items-center gap-3 min-h-[44px]">
        {/* Day stats (left, shrink-proof) */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--bf-ink-300)]">{dayStatsLine}</span>
        </div>

        {/* Separator */}
        <div className="w-px h-4 flex-shrink-0 bg-[var(--bf-border)]/60" />

        {/* Staff filter (scrollable flex region) */}
        {staffList.length > 1 ? (
          <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0">
            <button
              type="button"
              onClick={() => onMobileStaffChange?.(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150",
                activeStaffId === null
                  ? "bg-[var(--bf-primary)] text-[var(--bf-ink)]"
                  : "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] border border-[var(--bf-border)]"
              )}
            >
              Todos
            </button>
            {staffList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onMobileStaffChange?.(s.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150",
                  activeStaffId === s.id
                    ? "bg-[var(--bf-primary)] text-[var(--bf-ink)]"
                    : "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] border border-[var(--bf-border)]"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: staffColorById.get(s.id) ?? "var(--bf-primary)" }}
                />
                {s.name}
                {bookingCountsByStaffForDay[s.id] ? (
                  <span className={cn(
                    "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    activeStaffId === s.id ? "bg-black/20 text-white" : "bg-[var(--bf-primary)]/15 text-[var(--bf-primary)]"
                  )}>
                    {bookingCountsByStaffForDay[s.id]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Date picker icon */}
        <motion.label
          whileTap={{ scale: 0.94 }}
          className="relative flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] transition-colors hover:bg-[var(--bf-surface)]"
        >
          <Calendar className="pointer-events-none h-3.5 w-3.5 text-[var(--bf-ink-400)]" aria-hidden />
          <input
            type="date"
            min={stripDateBounds.min}
            max={stripDateBounds.max}
            value={selectedDay}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setSelectedDay(v);
              onDateChange?.(v);
              requestAnimationFrame(() => scrollDayChipIntoView(stripRef.current, v));
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            style={{ fontSize: 16 }}
            aria-label="Ir a una fecha"
          />
        </motion.label>
      </div>

      {/* Day strip */}
      <div
        ref={stripRef}
        className="relative z-20 flex flex-shrink-0 gap-1.5 overflow-x-auto border-b border-[var(--bf-border)]/50 bg-[var(--bf-bg)] px-3 py-2 scrollbar-hide"
      >
        {allDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const todayKey = format(today, "yyyy-MM-dd");
          const isSelected = dayKey === selectedDay;
          const isToday = dayKey === todayKey;
          const count = countByDay[dayKey] ?? 0;

          return (
            <button
              key={dayKey}
              ref={isToday ? todayBtnRef : undefined}
              type="button"
              data-day={dayKey}
              onClick={() => {
                setSelectedDay(dayKey);
                onDateChange?.(dayKey);
                scrollDayChipIntoView(stripRef.current, dayKey);
              }}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 rounded-[var(--r-md)] px-3 py-1.5 min-w-[52px] transition-all duration-150 relative"
              style={
                isSelected
                  ? { backgroundColor: "var(--bf-primary)", border: "none" }
                  : isToday
                  ? { backgroundColor: "rgba(79,161,216,0.10)", border: "1px solid rgba(79,161,216,0.35)" }
                  : { backgroundColor: "transparent", border: "1px solid transparent" }
              }
            >
              <span
                className="text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: isSelected ? "var(--bf-ink)" : isToday ? "var(--bf-primary)" : "var(--bf-ink-400)",
                }}
              >
                {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day).slice(0, 2)}
              </span>
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
              {isToday && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: "var(--bf-primary)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Appointment list */}
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "pointer-events-none absolute left-0 right-0 z-10 -top-px bg-gradient-to-b from-[var(--bf-bg)] via-[var(--bf-bg)]/90 to-transparent transition-[height,opacity] duration-200 ease-out",
            listScrolled ? "h-7 opacity-100" : "h-0 opacity-0"
          )}
          aria-hidden
        />
        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-4 pt-3 scrollbar-hide"
          onScroll={(e) => setListScrollTop(e.currentTarget.scrollTop)}
        >
          {dayBookings.length > 0 ? (
            <div className="space-y-2">
              {dayBookings
                .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                .map((booking) => {
                  const isNow = nowIndicator.currentId === booking.id;
                  const isNext = !nowIndicator.currentId && nowIndicator.nextId === booking.id;
                  return (
                    <div key={booking.id}>
                      {isNow && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-px flex-1 bg-[var(--bf-primary)]/20" />
                          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[rgba(79,161,216,0.15)] text-[var(--bf-primary)] border border-[rgba(79,161,216,0.3)] whitespace-nowrap">
                            ● EN CURSO
                          </span>
                          <div className="h-px flex-1 bg-[var(--bf-primary)]/20" />
                        </div>
                      )}
                      {isNext && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-px flex-1 bg-[var(--bf-border)]/50" />
                          <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[var(--bf-bg-elev)] text-[var(--bf-ink-400)] border border-[var(--bf-border)] whitespace-nowrap">
                            PRÓXIMO
                          </span>
                          <div className="h-px flex-1 bg-[var(--bf-border)]/50" />
                        </div>
                      )}
                      <AppointmentCard
                        booking={booking}
                        timezone={timezone}
                        variant="desktop-list"
                        staffColor={
                          booking.staff_id
                            ? staffColorById.get(booking.staff_id)
                            : (booking.staff?.color ?? null)
                        }
                        onClick={() => onBookingClick(booking)}
                        onContextMenu={(e) => onBookingContextMenu?.(e, booking)}
                      />
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex h-full min-h-[12rem] items-center justify-center py-8">
              <GlassEmptyState
                icon={Calendar}
                title="Sin citas para hoy"
                description="La agenda está libre para este día."
                actionLabel="+ Nueva cita"
                onAction={onNewBooking}
                variant="default"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  onDateChange?: (date: string) => void;
}

function scrollDayChipIntoView(strip: HTMLDivElement | null, dayKey: string) {
  if (!strip) return;
  const btn = strip.querySelector<HTMLButtonElement>(`button[data-day="${dayKey}"]`);
  btn?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
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
  onDateChange,
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

  const stripRef = useRef<HTMLDivElement>(null);
  const todayBtnRef = useRef<HTMLButtonElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const listScrolled = listScrollTop > 2;

  useEffect(() => {
    setListScrollTop(0);
    listScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedMobileDay]);

  useEffect(() => {
    if (!selectedDate) return;
    setSelectedMobileDay((prev) => {
      if (prev === selectedDate) return prev;
      requestAnimationFrame(() => scrollDayChipIntoView(stripRef.current, selectedDate));
      return selectedDate;
    });
  }, [selectedDate]);

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

  const stripDateBounds = useMemo(
    () => ({
      min: format(allDays[0], "yyyy-MM-dd"),
      max: format(allDays[allDays.length - 1], "yyyy-MM-dd"),
    }),
    [allDays]
  );

  // Entrada: “spin” rápido desde ~1 mes hacia delante hasta la posición de hoy (pista de desliz)
  useEffect(() => {
    let cancelled = false;
    const strip = stripRef.current;
    const todayEl = todayBtnRef.current;
    if (!strip || !todayEl) return;

    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

    const run = () => {
      if (cancelled) return;
      const finalLeft = Math.max(0, todayEl.offsetLeft - 8);
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        strip.scrollLeft = finalLeft;
        return;
      }
      const approxChip = 52;
      const jumpDays = 32;
      const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
      const startLeft = Math.min(finalLeft + jumpDays * approxChip, maxScroll);
      strip.scrollLeft = startLeft;

      const duration = 520;
      const from = startLeft;
      const to = finalLeft;
      const t0 = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const u = Math.min(1, (now - t0) / duration);
        strip.scrollLeft = from + (to - from) * easeOutCubic(u);
        if (u < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bf-bg)]"
      role="region"
      aria-label="Vista semanal móvil"
    >
      {/*
        Fila superior: flex (no grid con max-w 45% en los lados) para que búsqueda/filtros
        no roben espacio al selector de personal ni se superpongan.
      */}
      <div className="relative z-20 flex-shrink-0 border-b border-transparent bg-[var(--bf-bg)] px-2 py-1.5 sm:px-3">
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex shrink-0 items-center justify-start gap-1">
            {mobileToolbar && (
              <AgendaQuickActions
                only="notifications"
                onSearchClick={mobileToolbar.onSearchClick}
                onNotificationsClick={mobileToolbar.onNotificationsClick}
                unreadNotifications={mobileToolbar.unreadNotifications}
                filters={mobileToolbar.filters}
                onFiltersChange={mobileToolbar.onFiltersChange}
              />
            )}
            <motion.label
              whileTap={{ scale: 0.94 }}
              className={cn(
                "relative flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-[var(--r-md)]",
                "border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] transition-colors hover:bg-[var(--bf-surface)]"
              )}
            >
              <Calendar className="pointer-events-none h-3.5 w-3.5 text-[var(--bf-ink-400)]" aria-hidden />
              <input
                type="date"
                min={stripDateBounds.min}
                max={stripDateBounds.max}
                value={selectedMobileDay}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setSelectedMobileDay(v);
                  onDateChange?.(v);
                  requestAnimationFrame(() => scrollDayChipIntoView(stripRef.current, v));
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                style={{ fontSize: 16 }}
                aria-label="Ir a una fecha"
              />
            </motion.label>
          </div>
          <div
            className="min-w-0 flex-1 px-0.5"
            role="group"
            aria-label="Miembro del equipo"
          >
            {staffList.length > 1 && onMobileStaffChange ? (
              <MobileStaffSwitcher
                staffList={staffList}
                selectedStaffId={activeStaffId}
                onSelectStaff={onMobileStaffChange}
                bookingCounts={bookingCounts}
                includeAllOption
                density="toolbar"
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-end">
            {mobileToolbar ? (
              <AgendaQuickActions
                only="searchAndFilters"
                onSearchClick={mobileToolbar.onSearchClick}
                onNotificationsClick={mobileToolbar.onNotificationsClick}
                unreadNotifications={mobileToolbar.unreadNotifications}
                filters={mobileToolbar.filters}
                onFiltersChange={mobileToolbar.onFiltersChange}
                filterMenuSide="right"
              />
            ) : (
              <span className="inline-block w-8 flex-shrink-0" aria-hidden />
            )}
          </div>
        </div>
      </div>

      {/* Tira de días — misma “capa” que la cabecera, por encima del scroll de citas */}
      <div
        ref={stripRef}
        className="relative z-20 flex flex-shrink-0 gap-1.5 overflow-x-auto border-b border-[var(--bf-border)]/50 bg-[var(--bf-bg)] px-2 py-2 scrollbar-hide"
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
              data-day={dayKey}
              onClick={() => {
                setSelectedMobileDay(dayKey);
                onDateChange?.(dayKey);
                scrollDayChipIntoView(stripRef.current, dayKey);
              }}
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

      {/* Lista: sin separación bajo el borde de fechas; el degradado solo al hacer scroll, para no velar nunca la 1.ª tarjeta en reposo */}
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "pointer-events-none absolute left-0 right-0 z-10 -top-px bg-gradient-to-b from-[var(--bf-bg)] via-[var(--bf-bg)]/90 to-transparent transition-[height,opacity] duration-200 ease-out",
            listScrolled ? "h-7 opacity-100" : "h-0 opacity-0"
          )}
          aria-hidden
        />
        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-3 pt-3 scrollbar-hide [touch-action:pan-y]"
          onScroll={(e) => setListScrollTop(e.currentTarget.scrollTop)}
        >
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
            <div className="flex h-full min-h-[12rem] items-center justify-center py-4">
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
    </div>
  );
}

