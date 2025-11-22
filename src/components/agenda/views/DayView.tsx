"use client";

import { useMemo, useRef } from "react";
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
}: DayViewProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Interaction handlers
  const interactions = useCalendarInteractions({
    onSlotClick,
    onBookingClick,
    onPopoverShow,
    onBookingMove,
    onBookingResize,
    selectedDate,
    timezone,
  });

  // Drag and drop manager
  const dragDrop = useDragDropManager({
    bookings,
    onBookingMove,
    onBookingResize,
    timezone,
  });

  // Scroll synchronization
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const columnElements = useMemo(() => {
    return Array.from(columnRefs.current.values());
  }, [staffList.length]);

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
    return <CalendarSkeleton staffCount={staffList.length} />;
  }

  if (staffList.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-secondary">No hay staff seleccionado</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-primary">
      <div
        ref={timelineRef}
        className="relative flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
      >
        <div className="flex h-full" style={{ minWidth: `${staffList.length * STAFF_COLUMN_MIN_WIDTH_DESKTOP}px` }}>
          {/* Responsive adjustment for mobile */}
          <style jsx>{`
            @media (max-width: 768px) {
              div { min-width: ${staffList.length * STAFF_COLUMN_MIN_WIDTH_MOBILE}px !important; }
            }
          `}</style>
          {/* Time Column */}
          <TimeColumn
            startHour={8}
            endHour={22}
            timezone={timezone}
          />

          {/* Staff Columns */}
          <motion.div
            variants={staggerPresets.staffColumns.variants}
            initial="hidden"
            animate="visible"
            className="flex"
          >
            {staffList.map((staff, staffIndex) => {
              const staffBookings = bookingsByStaff.get(staff.id) || [];
              const staffBlockings = blockingsByStaff.get(staff.id) || [];

              return (
                <motion.div
                  key={staff.id}
                  variants={staggerPresets.staffColumns.variants}
                  custom={staffIndex}
                  className="flex-1 min-w-[300px] lg:min-w-[300px] md:min-w-[260px] sm:min-w-[260px]"
                >
                  <StaffColumn
                    staff={staff}
                    bookings={staffBookings}
                    blockings={staffBlockings}
                    selectedDate={selectedDate}
                    timezone={timezone}
                    showFreeSlots={showFreeSlots}
                    staffSchedules={staffSchedules}
                    onBookingClick={(booking) => interactions.handleBookingClick({} as React.MouseEvent, booking)}
                    onBookingMouseDown={dragDrop.handleBookingMouseDown}
                    onSlotClick={interactions.handleSlotClick}
                    onFreeSlotClick={onFreeSlotClick}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
