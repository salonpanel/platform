"use client";

import React, { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Staff, Booking, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { AppointmentCard } from "./AppointmentCard";
import { BlockingOverlay } from "./BlockingOverlay";
import { FreeSlotOverlay } from "./FreeSlotOverlay";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";
import { CalendarGrid } from "./CalendarGrid";
import { STAFF_COLUMN_MIN_WIDTH_DESKTOP, STAFF_COLUMN_MIN_WIDTH_MOBILE, SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

interface StaffColumnProps {
  staff: Staff;
  bookings: Booking[];
  blockings: StaffBlocking[];
  selectedDate: string;
  timezone: string;
  showFreeSlots?: boolean;
  staffSchedules?: StaffSchedule[];
  onBookingClick?: (booking: Booking) => void;
  onBookingMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  onFreeSlotClick?: (slot: { staffId: string; time: string; endTime: string; date: string }) => void;
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
  onBookingClick,
  onBookingMouseDown,
  onSlotClick,
  onFreeSlotClick,
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

  // Calculate current time position
  const currentMinutes = useMemo(() => {
    const now = new Date();
    const today = new Date();
    const selectedDateObj = new Date(selectedDate + "T00:00:00");

    if (
      selectedDateObj.getFullYear() !== today.getFullYear() ||
      selectedDateObj.getMonth() !== today.getMonth() ||
      selectedDateObj.getDate() !== today.getDate()
    ) {
      return null;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    return totalMinutes;
  }, [selectedDate]);

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

    const startHour = 8; // This should come from props
    const startMinutes = startHour * 60;
    const relativeStartMinutes = startMinutesFromMidnight - startMinutes;
    const relativeEndMinutes = endMinutesFromMidnight - startMinutes;
    const duration = relativeEndMinutes - relativeStartMinutes;

    // Use shared constants for consistent positioning
    const slotIndex = Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES);
    const top = Math.max(0, slotIndex * SLOT_HEIGHT_PX);
    const height = Math.max(MIN_BOOKING_HEIGHT_PX, Math.ceil(duration / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX);

    return { top, height, startMinutes: startMinutesFromMidnight, endMinutes: endMinutesFromMidnight };
  };

  return (
    <motion.div
      key={staff.id}
      data-staff-id={staff.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05, duration: 0.2, ease: "easeOut" }}
      className="flex-1 min-w-[300px] border-r border-border-default last:border-r-0 relative bg-primary"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 px-5 py-4 flex-shrink-0" style={{ height: "72px" }}>
        <GlassCard variant="inset" padding="md" className="h-full">
          <div className="flex items-center gap-3 h-full">
            <motion.div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold shadow-sm",
                "bg-accent-blue/10 border border-accent-blue/25 text-accent-blue"
              )}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.15 }}
            >
              {staff.name.charAt(0).toUpperCase()}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-semibold text-sm tracking-tight truncate",
                "text-primary font-sans"
              )}>
                {staff.name}
              </div>
              <div className={cn(
                "text-xs mt-0.5 flex items-center gap-1.5",
                "text-tertiary font-sans"
              )}>
                <div className="h-1.5 w-1.5 rounded-full bg-accent-aqua" />
                {(() => {
                  const schedule = staffSchedules.find(s => s.staff_id === staff.id);
                  return schedule ? `${schedule.start_time} - ${schedule.end_time}` : "09:00 - 19:00";
                })()}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Content area */}
      <div
        ref={columnRef}
        data-staff-column={staff.id}
        className="relative flex-1 overflow-y-auto scrollbar-hide bg-primary"
        style={{ height: `calc(100% - 72px)` }}
      >
        {/* Grid */}
        <CalendarGrid
          startHour={8}
          endHour={22}
          onSlotClick={onSlotClick}
          staffId={staff.id}
        />

        {/* Current time indicator */}
        <CurrentTimeIndicator currentMinutes={currentMinutes} />

        {/* Free slots */}
        <FreeSlotOverlay
          freeSlots={freeSlotsByStaff}
          onSlotClick={onFreeSlotClick}
          staffId={staff.id}
          selectedDate={selectedDate}
        />

        {/* Blockings */}
        <BlockingOverlay
          blockings={blockings}
          timezone={timezone}
        />

        {/* Bookings */}
        {bookings.map((booking, bookingIndex) => {
          const position = getBookingPosition(booking);

          return (
            <AppointmentCard
              key={booking.id}
              booking={booking}
              position={position}
              onClick={onBookingClick}
              onMouseDown={onBookingMouseDown}
            />
          );
        })}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.staff.id === nextProps.staff.id &&
    prevProps.bookings.length === nextProps.bookings.length &&
    prevProps.bookings.every((b, i) => b.id === nextProps.bookings[i]?.id) &&
    prevProps.blockings.length === nextProps.blockings.length &&
    prevProps.blockings.every((b, i) => b.id === nextProps.blockings[i]?.id) &&
    prevProps.selectedDate === nextProps.selectedDate &&
    prevProps.timezone === nextProps.timezone &&
    prevProps.showFreeSlots === nextProps.showFreeSlots &&
    prevProps.staffSchedules?.length === nextProps.staffSchedules?.length
  );
});
