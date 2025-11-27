"use client";

import { useCallback, type RefObject } from "react";
import { Booking, CalendarSlot } from "@/types/agenda";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";

interface UseCalendarInteractionsProps {
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  onBookingClick?: (booking: Booking) => void;
  onBookingMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
  onPopoverShow?: (position: { x: number; y: number }, slot?: any, booking?: Booking) => void;
  onBookingMove?: (bookingId: string, newStaffId: string, newStartTime: string, newEndTime: string) => void;
  onBookingResize?: (bookingId: string, newStartTime: string, newEndTime: string) => void;
  tenantId?: string;
  selectedDate?: string;
  timezone?: string;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function useCalendarInteractions({
  onSlotClick,
  onBookingClick,
  onBookingMouseDown,
  onPopoverShow,
  onBookingMove,
  onBookingResize,
  tenantId,
  selectedDate,
  timezone = "Europe/Madrid",
  scrollContainerRef,
}: UseCalendarInteractionsProps = {}) {
  // Utility functions
  const pixelsToMinutes = (pixels: number): number => {
    const slots = Math.round(Math.max(0, pixels) / SLOT_HEIGHT_PX);
    const relativeMinutes = slots * SLOT_DURATION_MINUTES;
    return 8 * 60 + relativeMinutes; // Start from 8:00
  };

  const minutesToTime = (minutes: number): string => {
    const clampedMinutes = Math.max(0, Math.min(1439, Math.floor(minutes)));
    const hours = Math.floor(clampedMinutes / 60);
    const mins = clampedMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const createBookingSlot = (staffId: string, timeSlot: string): CalendarSlot => {
    const [hour, minute] = timeSlot.split(":").map(Number);
    const startMinutesFromMidnight = hour * 60 + minute;

    return {
      staffId,
      time: timeSlot,
      date: selectedDate || new Date().toISOString().split("T")[0],
      endTime: minutesToTime(startMinutesFromMidnight + 30), // Default 30 min slot
    };
  };

  const handleSlotClick = useCallback(
    (e: React.MouseEvent, staffId: string, timeSlot: string) => {
      // Don't trigger if clicking on a booking
      if ((e.target as HTMLElement).closest('[data-booking]')) {
        return;
      }

      const slot = createBookingSlot(staffId, timeSlot);

      // Call slot click handler
      onSlotClick?.(e, staffId, timeSlot);

      // Show popover if handler exists
      if (onPopoverShow) {
        // Si tenemos contenedor de scroll, calcular coordenadas relativas a él
        if (scrollContainerRef?.current) {
          const container = scrollContainerRef.current;
          const containerRect = container.getBoundingClientRect();
          const x = e.clientX - containerRect.left + container.scrollLeft;
          const y = e.clientY - containerRect.top + container.scrollTop;
          onPopoverShow({ x, y }, slot);
        } else {
          // Fallback seguro: usar coordenadas absolutas de viewport
          const x = e.clientX;
          const y = e.clientY;
          onPopoverShow({ x, y }, slot);
        }
      }
    },
    [onSlotClick, onPopoverShow, selectedDate, scrollContainerRef]
  );

  const handleBookingClick = useCallback(
    (e: React.MouseEvent | null, booking: Booking) => {
      // Caso sin evento real (p.ej. llamado desde DayView): delegar directamente en onBookingClick
      if (!e) {
        onBookingClick?.(booking);
        return;
      }

      // Prevent default behavior if it was a drag
      const wasDragged = (e as any).wasDragged;
      if (wasDragged) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Show booking details or popover
      if (onPopoverShow) {
        const x = e.clientX;
        const y = e.clientY;
        onPopoverShow({ x, y }, undefined, booking);
      } else {
        onBookingClick?.(booking);
      }
    },
    [onBookingClick, onPopoverShow]
  );

  const handleBookingMouseDown = useCallback(
    (e: React.MouseEvent, booking: Booking, top: number) => {
      // Check if clicking on resize handle
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
        return;
      }

      // Check if booking is protected
      if (booking.status === "paid" || booking.status === "completed") {
        return;
      }

      // Prevent onClick if drag will start
      e.stopPropagation();
      onBookingMouseDown?.(e, booking, top);
    },
    [onBookingMouseDown]
  );

  const handleBookingMove = useCallback(
    (bookingId: string, newStaffId: string, newStartTime: string, newEndTime: string) => {
      onBookingMove?.(bookingId, newStaffId, newStartTime, newEndTime);
    },
    [onBookingMove]
  );

  const handleBookingResize = useCallback(
    (bookingId: string, newStartTime: string, newEndTime: string) => {
      onBookingResize?.(bookingId, newStartTime, newEndTime);
    },
    [onBookingResize]
  );

  return {
    handleSlotClick,
    handleBookingClick,
    handleBookingMouseDown,
    handleBookingMove,
    handleBookingResize,
    utilities: {
      pixelsToMinutes,
      minutesToTime,
      createBookingSlot,
    },
  };
}
