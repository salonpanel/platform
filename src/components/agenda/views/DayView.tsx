"use client";

import { useMemo, useRef, useCallback } from "react";
import { Staff, Booking, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { TimeColumn } from "../core/TimeColumn";
import { StaffColumn } from "../core/StaffColumn";
import { CalendarSkeleton } from "../core/LoadingSkeleton";
import { useCalendarInteractions } from "../hooks/useCalendarInteractions";
import { useDragDropManager } from "../interactions/DragDropManager";
import { useScrollSyncManager } from "../interactions/ScrollSyncManager";
import { motion } from "framer-motion";
import { staggerPresets } from "../motion/presets";
import { STAFF_COLUMN_MIN_WIDTH_DESKTOP, STAFF_COLUMN_MIN_WIDTH_MOBILE } from "../constants/layout";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { buildStaffWindowsForDay } from "../utils/timeWindows";
import { AgendaActionPopover } from "@/components/calendar/AgendaActionPopover";

interface DayViewProps {
  bookings: Booking[];
  staffBlockings: StaffBlocking[];
  staffList: Staff[];
  staffSchedules: StaffSchedule[];
  selectedDate: string;
  timezone: string;
  showFreeSlots?: boolean;
  loading?: boolean;
  onBookingClick?: (booking: Booking) => void;
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  onFreeSlotClick?: (slot: { staffId: string; time: string; endTime: string; date: string }) => void;
  onBookingMove?: (bookingId: string, newStaffId: string, newStartTime: string, newEndTime: string) => void;
  onBookingResize?: (bookingId: string, newStartTime: string, newEndTime: string) => void;
  onPopoverShow?: (position: { x: number; y: number }, slot?: any, booking?: Booking) => void;
  onBookingContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
  slotPopover?: {
    open: boolean;
    position: { x: number; y: number };
    slot: { staffId: string; date: string; time: string };
  } | null;
  onSlotPopoverClose?: () => void;
  onSlotNewBooking?: (slot: { staffId: string; date: string; time: string }) => void;
  onSlotBlock?: (slot: { staffId: string; date: string; time: string }) => void;
  onSlotAbsence?: (slot: { staffId: string; date: string; time: string }) => void;
}

export function DayView({
  bookings,
  staffBlockings,
  staffList,
  staffSchedules,
  selectedDate,
  timezone,
  showFreeSlots = false,
  loading = false,
  onBookingClick,
  onSlotClick,
  onFreeSlotClick,
  onBookingMove,
  onBookingResize,
  onPopoverShow,
  onBookingContextMenu,
  slotPopover,
  onSlotPopoverClose,
  onSlotNewBooking,
  onSlotBlock,
  onSlotAbsence,
}: DayViewProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Interaction handlers
  const interactions = useCalendarInteractions({
    onSlotClick,
    onBookingClick,
    onPopoverShow,
    onBookingMove,
    onBookingResize,
    selectedDate,
    timezone,
    scrollContainerRef: timelineRef,
  });

  // Ventanas de disponibilidad por staff/día (horario base menos bloqueos)
  const staffWindows = useMemo(() => {
    return buildStaffWindowsForDay(staffSchedules || [], staffBlockings || [], selectedDate, timezone);
  }, [staffSchedules, staffBlockings, selectedDate, timezone]);

  // Rango global del día ("shop hours") derivado de la unión de todas las ventanas de disponibilidad
  // Nota: actualmente no existe una tabla business_hours separada; las horas de apertura
  // de la agenda se derivan de los horarios de staff + bloqueos.
  const { dayStartHour, dayEndHour } = useMemo(() => {
    const allWindows: { startMinutes: number; endMinutes: number }[] = [];

    if (staffWindows) {
      Object.values(staffWindows).forEach((wins) => {
        if (wins && wins.length) {
          allWindows.push(...wins);
        }
      });
    }

    if (allWindows.length > 0) {
      let minMinutes = allWindows[0].startMinutes;
      let maxMinutes = allWindows[0].endMinutes;

      allWindows.forEach((w) => {
        if (w.startMinutes < minMinutes) minMinutes = w.startMinutes;
        if (w.endMinutes > maxMinutes) maxMinutes = w.endMinutes;
      });

      const startHour = Math.max(0, Math.min(23, Math.floor(minMinutes / 60)));
      const endHour = Math.max(1, Math.min(23, Math.ceil(maxMinutes / 60)));

      if (endHour <= startHour) {
        return { dayStartHour: startHour, dayEndHour: Math.min(23, startHour + 1) };
      }

      return { dayStartHour: startHour, dayEndHour: endHour };
    }

    // Fallback cuando aún no hay ventanas de disponibilidad: usar rango basado en staffSchedules
    if (!staffSchedules || staffSchedules.length === 0) {
      return { dayStartHour: 8, dayEndHour: 22 };
    }

    let minHour = 23;
    let maxHour = 0;
    staffSchedules.forEach((s) => {
      const [startH] = s.start_time.split(":").map(Number);
      const [endH] = s.end_time.split(":").map(Number);
      if (!isNaN(startH)) minHour = Math.min(minHour, startH);
      if (!isNaN(endH)) maxHour = Math.max(maxHour, endH);
    });

    const startHour = Math.max(0, Math.min(minHour, 23));
    const endHour = Math.max(1, Math.min(maxHour, 23));

    if (endHour <= startHour) {
      return { dayStartHour: startHour, dayEndHour: Math.min(23, startHour + 1) };
    }

    return { dayStartHour: startHour, dayEndHour: endHour };
  }, [staffWindows, staffSchedules]);

  // Drag and drop manager (auto-scroll + clamps usando el mismo rango global del día)
  const dragDrop = useDragDropManager({
    bookings,
    onBookingMove,
    onBookingResize,
    timezone,
    scrollContainerRef: timelineRef,
    dayStartHour,
    dayEndHour,
    staffWindows,
  });

  // Scroll synchronization
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const setColumnRef = useCallback((staffId: string) => (element: HTMLElement | null) => {
    if (element) {
      columnRefs.current.set(staffId, element);
    } else {
      columnRefs.current.delete(staffId);
    }
  }, []);

  const columnElements = useMemo(() => {
    return Array.from(columnRefs.current.values());
  }, [staffList.length]); // Recompute when staff list changes

  useScrollSyncManager({
    columns: columnElements,
    enabled: true,
  });

  // Group data by staff
  const bookingsByStaff = useMemo(() => {
    const map = new Map<string, Booking[]>();
    staffList.forEach((staff) => {
      map.set(staff.id, []);
    });

    bookings.forEach((booking) => {
      if (booking.staff_id && map.has(booking.staff_id)) {
        map.get(booking.staff_id)!.push(booking);
      }
    });

    return map;
  }, [bookings, staffList]);

  const blockingsByStaff = useMemo(() => {
    const map = new Map<string, StaffBlocking[]>();
    staffList.forEach((staff) => {
      map.set(staff.id, []);
    });

    staffBlockings.forEach((blocking) => {
      if (blocking.staff_id && map.has(blocking.staff_id)) {
        map.get(blocking.staff_id)!.push(blocking);
      }
    });

    return map;
  }, [staffBlockings, staffList]);

  if (loading) {
    return <CalendarSkeleton staffCount={staffList.length || 1} />;
  }

  return (
    <div className="w-full h-full min-h-[520px] flex flex-col overflow-hidden bg-[#0B0C10] relative">
      {/* Radial Gradient Overlay for Neo-Glass effect */}
      <div 
        className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none z-0"
        style={{ transform: 'translate(-20%, -20%)' }}
      />
      
      <div
        ref={timelineRef}
        className="relative flex-1 overflow-x-auto overflow-y-auto scrollbar-hide z-10"
      >
        {/* Grid Container - Flexible width */}
        <div className="flex h-full min-w-full">
          {/* Time Column - Sticky Left (always visible, even if there is no staff) */}
          <div className="sticky left-0 z-30 shadow-xl">
            <TimeColumn
              startHour={dayStartHour}
              endHour={dayEndHour}
              timezone={timezone}
            />
          </div>

          {/* Staff Columns - Scrollable */}
          <motion.div
            variants={staggerPresets.staffColumns.variants}
            initial="hidden"
            animate="visible"
            className="flex min-w-0 flex-1"
          >
            {staffList.map((staff, staffIndex) => {
              const staffBookings = bookingsByStaff.get(staff.id) || [];
              const staffBlockings = blockingsByStaff.get(staff.id) || [];

              return (
                <motion.div
                  key={staff.id}
                  variants={staggerPresets.staffColumns.variants}
                  custom={staffIndex}
                  className="flex-1 min-w-[280px] md:min-w-[300px] lg:min-w-[320px]"
                >
                  <StaffColumn
                    staff={staff}
                    bookings={staffBookings}
                    blockings={staffBlockings}
                    selectedDate={selectedDate}
                    timezone={timezone}
                    showFreeSlots={showFreeSlots}
                    staffSchedules={staffSchedules}
                    staffWindows={staffWindows}
                    dayStartHour={dayStartHour}
                    dayEndHour={dayEndHour}
                    onBookingClick={(booking) => interactions.handleBookingClick(null, booking)}
                    onBookingMouseDown={dragDrop.handleBookingMouseDown}
                    onBookingContextMenu={onBookingContextMenu}
                    onSlotClick={interactions.handleSlotClick}
                    onFreeSlotClick={onFreeSlotClick}
                    ref={setColumnRef(staff.id)}
                    draggingBooking={dragDrop.draggingBooking}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Slot action popover anclado al contenedor scroll */}
        {slotPopover && slotPopover.open && onSlotPopoverClose && (
          <AgendaActionPopover
            isOpen={slotPopover.open}
            position={slotPopover.position}
            onClose={onSlotPopoverClose}
            onNewBooking={() => {
              if (slotPopover) {
                onSlotNewBooking?.(slotPopover.slot);
              }
            }}
            onUnavailability={() => {
              if (slotPopover) {
                onSlotBlock?.(slotPopover.slot);
              }
            }}
            onAbsence={() => {
              if (slotPopover) {
                onSlotAbsence?.(slotPopover.slot);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
