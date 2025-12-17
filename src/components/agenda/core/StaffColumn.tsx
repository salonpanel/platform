"use client";

import React, { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Staff, Booking, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { AppointmentCard } from "../AppointmentCard";
import { BlockingOverlay } from "./BlockingOverlay";
import { FreeSlotOverlay } from "./FreeSlotOverlay";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import type { DragState } from "../interactions/DragDropManager";
import { CalendarGrid } from "./CalendarGrid";
import type { StaffWindowsMap } from "../utils/timeWindows";
import { STAFF_COLUMN_MIN_WIDTH_DESKTOP, STAFF_COLUMN_MIN_WIDTH_MOBILE, SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

interface StaffColumnProps {
  staff: Staff;
  bookings: Booking[];
  blockings: StaffBlocking[];
  selectedDate: string;
  timezone: string;
  showFreeSlots?: boolean;
  staffSchedules?: StaffSchedule[];
  staffWindows?: StaffWindowsMap;
  dayStartHour: number;
  dayEndHour: number;
  onBookingClick?: (booking: Booking) => void;
  onBookingMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
  onBookingContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  onFreeSlotClick?: (slot: { staffId: string; time: string; endTime: string; date: string }) => void;
  ref?: React.Ref<HTMLDivElement>;
  draggingBooking?: DragState | null;
  slotHeight?: number;
}

interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
  duration: number;
}

export const StaffColumn = React.memo(function StaffColumn({
  staff,
  bookings,
  blockings,
  selectedDate,
  timezone,
  showFreeSlots = false,
  staffSchedules = [],
  staffWindows,
  dayStartHour,
  dayEndHour,
  onBookingClick,
  onBookingMouseDown,
  onBookingContextMenu,
  onSlotClick,
  onFreeSlotClick,
  ref,
  draggingBooking,
  slotHeight = SLOT_HEIGHT_PX,
}: StaffColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  // Calculate free slots
  const freeSlotsByStaff = useMemo(() => {
    if (!showFreeSlots) return [];

    const schedule = staffSchedules.find(s => s.staff_id === staff.id);
    const dayStartMinutes = schedule
      ? (parseInt(schedule.start_time.split(":")[0]) * 60 + parseInt(schedule.start_time.split(":")[1]))
      : 8 * 60; // Default 8:00
    const dayEndMinutes = schedule
      ? (parseInt(schedule.end_time.split(":")[0]) * 60 + parseInt(schedule.end_time.split(":")[1]))
      : 22 * 60; // Default 22:00

    // Get occupied slots from bookings and blockings
    const occupiedSlots: Array<{ startMinutes: number; endMinutes: number }> = [];

    bookings.forEach(booking => {
      const startsAt = new Date(booking.starts_at);
      const endsAt = new Date(booking.ends_at);
      const localStartsAt = new Date(
        startsAt.toLocaleString("en-US", { timeZone: timezone })
      );
      const localEndsAt = new Date(
        endsAt.toLocaleString("en-US", { timeZone: timezone })
      );

      const startMinutes = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
      const endMinutes = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();

      occupiedSlots.push({ startMinutes, endMinutes });
    });

    blockings.forEach(blocking => {
      const startsAt = new Date(blocking.start_at);
      const endsAt = new Date(blocking.end_at);
      const localStartsAt = new Date(
        startsAt.toLocaleString("en-US", { timeZone: timezone })
      );
      const localEndsAt = new Date(
        endsAt.toLocaleString("en-US", { timeZone: timezone })
      );

      const startMinutes = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
      const endMinutes = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();

      occupiedSlots.push({ startMinutes, endMinutes });
    });

    // Sort occupied slots
    occupiedSlots.sort((a, b) => a.startMinutes - b.startMinutes);

    const freeSlots: FreeSlot[] = [];
    const MIN_GAP_DURATION = 30; // Minimum 30 minutes

    // Gap from start to first booking
    if (occupiedSlots.length === 0) {
      const duration = dayEndMinutes - dayStartMinutes;
      if (duration >= MIN_GAP_DURATION) {
        freeSlots.push({
          startMinutes: dayStartMinutes,
          endMinutes: dayEndMinutes,
          duration,
        });
      }
    } else {
      const firstOccupied = occupiedSlots[0];
      if (firstOccupied.startMinutes > dayStartMinutes) {
        const duration = firstOccupied.startMinutes - dayStartMinutes;
        if (duration >= MIN_GAP_DURATION) {
          freeSlots.push({
            startMinutes: dayStartMinutes,
            endMinutes: firstOccupied.startMinutes,
            duration,
          });
        }
      }

      // Gaps between bookings
      for (let i = 0; i < occupiedSlots.length - 1; i++) {
        const current = occupiedSlots[i];
        const next = occupiedSlots[i + 1];
        const gapStart = current.endMinutes;
        const gapEnd = next.startMinutes;
        const duration = gapEnd - gapStart;

        if (duration >= MIN_GAP_DURATION) {
          freeSlots.push({
            startMinutes: gapStart,
            endMinutes: gapEnd,
            duration,
          });
        }
      }

      // Gap from last booking to end
      const lastOccupied = occupiedSlots[occupiedSlots.length - 1];
      if (lastOccupied.endMinutes < dayEndMinutes) {
        const duration = dayEndMinutes - lastOccupied.endMinutes;
        if (duration >= MIN_GAP_DURATION) {
          freeSlots.push({
            startMinutes: lastOccupied.endMinutes,
            endMinutes: dayEndMinutes,
            duration,
          });
        }
      }
    }

    return freeSlots;
  }, [showFreeSlots, staff.id, staffSchedules, bookings, blockings, timezone]);

  // Calculate current time position in tenant timezone
  const currentMinutes = useMemo(() => {
    const now = new Date();

    // Convert "now" to tenant local time
    const tenantNow = new Date(
      now.toLocaleString("en-US", { timeZone: timezone })
    );

    const tenantToday = new Date(
      tenantNow.getFullYear(),
      tenantNow.getMonth(),
      tenantNow.getDate(),
      0,
      0,
      0,
      0
    );

    const selectedDateObj = new Date(selectedDate + "T00:00:00");

    if (
      selectedDateObj.getFullYear() !== tenantToday.getFullYear() ||
      selectedDateObj.getMonth() !== tenantToday.getMonth() ||
      selectedDateObj.getDate() !== tenantToday.getDate()
    ) {
      return null;
    }

    const hours = tenantNow.getHours();
    const minutes = tenantNow.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    return totalMinutes;
  }, [selectedDate, timezone]);

  // Calculate booking positions
  const getBookingPosition = (booking: Booking) => {
    const startsAt = new Date(booking.starts_at);
    const endsAt = new Date(booking.ends_at);
    const localStartsAt = new Date(
      startsAt.toLocaleString("en-US", { timeZone: timezone })
    );
    const localEndsAt = new Date(
      endsAt.toLocaleString("en-US", { timeZone: timezone })
    );

    const startMinutesFromMidnight = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
    const endMinutesFromMidnight = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();

    const dayStartMinutes = dayStartHour * 60;
    const relativeStartMinutes = startMinutesFromMidnight - dayStartMinutes;
    const relativeEndMinutes = endMinutesFromMidnight - dayStartMinutes;
    const duration = relativeEndMinutes - relativeStartMinutes;

    // Use shared constants for consistent positioning
    const slotIndex = Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES);
    const top = Math.max(0, slotIndex * slotHeight);
    const height = Math.max(MIN_BOOKING_HEIGHT_PX, Math.ceil(duration / SLOT_DURATION_MINUTES) * slotHeight);

    return { top, height, startMinutes: startMinutesFromMidnight, endMinutes: endMinutesFromMidnight };
  };

  return (
    <motion.div
      key={staff.id}
      data-staff-id={staff.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05, duration: 0.2, ease: "easeOut" }}
      className="flex-1 min-w-[300px] border-r border-white/5 last:border-r-0 relative bg-transparent"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-3 py-3 flex-shrink-0 bg-[#0B0C10]/95 backdrop-blur border-b border-white/5" style={{ height: "72px" }}>
        <div className="h-full rounded-xl bg-white/[0.02] border border-white/5 p-2 flex items-center gap-3 shadow-inner">
          <div className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shadow-lg",
            "bg-gradient-to-br from-gray-800 to-black border border-white/10 text-white",
            "ring-2 ring-[#0B0C10]"
          )}>
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm tracking-wide text-white truncate font-sans">
              {staff.name}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#4FE3C1] shadow-[0_0_8px_#4FE3C1]" />
              <span className="text-[10px] text-gray-500 font-medium">
                {(() => {
                  const schedule = staffSchedules.find(s => s.staff_id === staff.id);
                  return schedule ? `${schedule.start_time} - ${schedule.end_time}` : "Activo";
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content area: scroll handled by shared timeline container in DayView */}
      <div
        ref={ref || columnRef}
        data-staff-column={staff.id}
        className="relative flex-1 bg-transparent pt-4 pb-8"
      >
        {/* Grid */}
        <CalendarGrid
          startHour={dayStartHour}
          endHour={dayEndHour}
          onSlotClick={onSlotClick}
          staffId={staff.id}
          availabilityWindows={staffWindows ? staffWindows[staff.id] : undefined}
        />

        {/* Current time indicator (aligned with dynamic day grid) */}
        <CurrentTimeIndicator
          currentMinutes={currentMinutes}
          startHour={dayStartHour}
          endHour={dayEndHour}
        />

        {/* Free slots */}
        <FreeSlotOverlay
          freeSlots={freeSlotsByStaff}
          onSlotClick={onFreeSlotClick}
          staffId={staff.id}
          selectedDate={selectedDate}
          dayStartHour={dayStartHour}
        />

        {/* Blockings */}
        <BlockingOverlay
          blockings={blockings}
          timezone={timezone}
          dayStartHour={dayStartHour}
        />

        {/* Bookings */}
        {bookings.map((booking, bookingIndex) => {
          const position = getBookingPosition(booking);

          return (
            <div
              key={booking.id}
              data-booking
              className={cn(
                "absolute left-2 right-2 z-20",
                draggingBooking?.bookingId === booking.id ? "opacity-40" : ""
              )}
              style={{
                top: `${position.top}px`,
                minHeight: `${position.height}px`,
              }}
              onMouseDown={(e) => onBookingMouseDown?.(e, booking, position.top)}
            >
              <AppointmentCard
                booking={booking}
                timezone={timezone}
                variant="timeline"
                onClick={() => onBookingClick?.(booking)}
                onContextMenu={(e) => onBookingContextMenu?.(e, booking)}
              />
            </div>
          );
        })}

        {/* Visual drag ghost following the mouse within this staff column */}
        {draggingBooking && draggingBooking.currentStaffId === staff.id && (
          <div
            className="absolute left-2 right-2 pointer-events-none z-40"
            style={{ top: `${draggingBooking.currentTop}px` }}
          >
            <AppointmentCard
              booking={draggingBooking.bookingSnapshot}
              timezone={timezone}
              variant="timeline"
              className="opacity-90 scale-[1.02]"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Importante: si cambia draggingBooking debemos re-renderizar para actualizar el ghost visual
  const draggingChanged = prevProps.draggingBooking !== nextProps.draggingBooking;

  if (draggingChanged) {
    return false;
  }

  // Re-render if core props that affect layout change
  if (
    prevProps.staff.id !== nextProps.staff.id ||
    prevProps.selectedDate !== nextProps.selectedDate ||
    prevProps.timezone !== nextProps.timezone ||
    prevProps.showFreeSlots !== nextProps.showFreeSlots ||
    prevProps.dayStartHour !== nextProps.dayStartHour ||
    prevProps.dayEndHour !== nextProps.dayEndHour ||
    prevProps.staffWindows !== nextProps.staffWindows
  ) {
    return false;
  }

  // Re-render if bookings for this staff change in length or in any key field
  if (prevProps.bookings.length !== nextProps.bookings.length) {
    return false;
  }

  const bookingsChanged = prevProps.bookings.some((prevBooking, index) => {
    const nextBooking = nextProps.bookings[index];
    if (!nextBooking) return true;

    return (
      prevBooking.id !== nextBooking.id ||
      prevBooking.starts_at !== nextBooking.starts_at ||
      prevBooking.ends_at !== nextBooking.ends_at ||
      prevBooking.status !== nextBooking.status ||
      prevBooking.staff_id !== nextBooking.staff_id
    );
  });

  if (bookingsChanged) {
    return false;
  }

  // Re-render if blockings for this staff change
  if (prevProps.blockings.length !== nextProps.blockings.length) {
    return false;
  }

  const blockingsChanged = prevProps.blockings.some((prevBlocking, index) => {
    const nextBlocking = nextProps.blockings[index];
    if (!nextBlocking) return true;

    return (
      prevBlocking.id !== nextBlocking.id ||
      prevBlocking.start_at !== nextBlocking.start_at ||
      prevBlocking.end_at !== nextBlocking.end_at ||
      prevBlocking.type !== nextBlocking.type
    );
  });

  if (blockingsChanged) {
    return false;
  }

  // Re-render if staff schedules length changes (detailed comparison is not necessary here)
  if (prevProps.staffSchedules?.length !== nextProps.staffSchedules?.length) {
    return false;
  }

  // No relevant changes detected -> skip re-render
  return true;
});
