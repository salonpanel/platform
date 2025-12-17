"use client";

import { useCallback } from "react";
import { Booking, CalendarSlot } from "@/types/agenda";

interface CalendarInteractionsProps {
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  onBookingClick?: (booking: Booking) => void;
  onBookingMouseDown?: (e: React.MouseEvent, booking: Booking, top: number) => void;
  onPopoverShow?: (position: { x: number; y: number }, slot?: CalendarSlot, booking?: Booking) => void;
}

export function useCalendarInteractions({
  onSlotClick,
  onBookingClick,
  onBookingMouseDown,
  onPopoverShow,
}: CalendarInteractionsProps = {}) {
  const handleSlotClick = useCallback(
    (e: React.MouseEvent, staffId: string, timeSlot: string) => {
      // Don't trigger if clicking on a booking
      if ((e.target as HTMLElement).closest('[data-booking]')) {
        return;
      }

      // Calculate slot data
      const [hour, minute] = timeSlot.split(":").map(Number);
      const startMinutesFromMidnight = hour * 60 + minute;

      const slot: CalendarSlot = {
        staffId,
        time: timeSlot,
        date: "", // Will be filled by parent
        endTime: "", // Will be calculated by parent
      };

      // Call slot click handler
      onSlotClick?.(e, staffId, timeSlot);

      // Show popover if handler exists
      if (onPopoverShow) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        onPopoverShow({ x, y }, slot);
      }
    },
    [onSlotClick, onPopoverShow]
  );

  const handleBookingClick = useCallback(
    (e: React.MouseEvent, booking: Booking) => {
      // Prevent default behavior if it was a drag
      const wasDragged = (e as any).wasDragged;
      if (wasDragged) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Show booking details or popover
      if (onPopoverShow) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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

      // Prevent onClick if drag will start
      e.stopPropagation();
      onBookingMouseDown?.(e, booking, top);
    },
    [onBookingMouseDown]
  );

  return {
    handleSlotClick,
    handleBookingClick,
    handleBookingMouseDown,
  };
}
