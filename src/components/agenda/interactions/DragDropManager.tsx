"use client";

import { useState, useRef, useCallback } from "react";
import { Booking } from "@/types/agenda";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";

interface DragDropManagerProps {
  bookings?: Booking[];
  onBookingMove?: (bookingId: string, newStaffId: string, newStartTime: string, newEndTime: string) => void;
  onBookingResize?: (bookingId: string, newStartTime: string, newEndTime: string) => void;
  timezone?: string;
}

interface DragState {
  bookingId: string;
  originalStaffId: string;
  originalTop: number;
  dragOffset: { x: number; y: number };
  currentTop: number;
  currentStaffId: string;
}

interface ResizeState {
  bookingId: string;
  staffId: string;
  originalHeight: number;
  originalTop: number;
  resizeType: "start" | "end";
  currentHeight: number;
}

export function useDragDropManager({
  bookings,
  onBookingMove,
  onBookingResize,
  timezone = "Europe/Madrid",
}: DragDropManagerProps = {}) {
  const [draggingBooking, setDraggingBooking] = useState<DragState | null>(null);
  const [resizingBooking, setResizingBooking] = useState<ResizeState | null>(null);

  const draggingRef = useRef<DragState | null>(null);
  const resizingRef = useRef<ResizeState | null>(null);

  const justFinishedDragRef = useRef(false);
  const justFinishedResizeRef = useRef(false);

  // Utility functions
  const pixelsToMinutes = (pixels: number): number => {
    const slots = Math.round(Math.max(0, pixels) / SLOT_HEIGHT_PX); // Use shared constants
    const relativeMinutes = slots * SLOT_DURATION_MINUTES;
    return 8 * 60 + relativeMinutes; // Start from 8:00
  };

  const minutesToTime = (minutes: number): string => {
    const clampedMinutes = Math.max(0, Math.min(1439, Math.floor(minutes)));
    const hours = Math.floor(clampedMinutes / 60);
    const mins = clampedMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  const getStaffIdFromElement = (element: HTMLElement | null): string | null => {
    if (!element) return null;
    const staffColumn = element.closest('[data-staff-id]');
    if (staffColumn) {
      return staffColumn.getAttribute('data-staff-id');
    }
    return null;
  };

  // Drag handlers
  const handleBookingMouseDown = useCallback(
    (e: React.MouseEvent, booking: Booking, top: number) => {
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Check if booking is protected
      if (booking.status === "paid" || booking.status === "completed") {
        return;
      }

      const bookingElement = e.currentTarget as HTMLElement;
      const bookingRect = bookingElement.getBoundingClientRect();

      const dragOffset = {
        x: e.clientX - bookingRect.left,
        y: e.clientY - bookingRect.top,
      };

      const dragState: DragState = {
        bookingId: booking.id,
        originalStaffId: booking.staff_id || "",
        originalTop: top,
        dragOffset,
        currentTop: top,
        currentStaffId: booking.staff_id || "",
      };

      setDraggingBooking(dragState);
      draggingRef.current = dragState;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentDrag = draggingRef.current;
        if (!currentDrag) return;

        const elementUnderMouse = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement;
        const newStaffId = getStaffIdFromElement(elementUnderMouse) || currentDrag.originalStaffId;

        const relativeY = moveEvent.clientY - bookingRect.top + currentDrag.dragOffset.y;
        const slotIndex = Math.round(relativeY / SLOT_HEIGHT_PX);
        const snappedY = slotIndex * SLOT_HEIGHT_PX;
        const clampedY = Math.max(0, snappedY);

        const updatedDrag = {
          ...currentDrag,
          currentTop: clampedY,
          currentStaffId: newStaffId,
        };

        setDraggingBooking(updatedDrag);
        draggingRef.current = updatedDrag;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const currentDrag = draggingRef.current;
        if (!currentDrag) {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        const movedDistance = Math.abs(currentDrag.currentTop - currentDrag.originalTop);
        const wasActualDrag = movedDistance > 5;

        if (!wasActualDrag) {
          setDraggingBooking(null);
          draggingRef.current = null;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        justFinishedDragRef.current = true;
        setTimeout(() => {
          justFinishedDragRef.current = false;
        }, 100);

        // Calculate new time
        const newMinutes = pixelsToMinutes(currentDrag.currentTop);
        const newTime = minutesToTime(newMinutes);

        const bookingToMove = bookings?.find((b) => b.id === currentDrag.bookingId);
        if (bookingToMove && onBookingMove) {
          const originalStart = new Date(bookingToMove.starts_at);
          const originalEnd = new Date(bookingToMove.ends_at);
          const durationMs = originalEnd.getTime() - originalStart.getTime();
          const durationMinutes = durationMs / (1000 * 60);

          const newEndMinutes = newMinutes + durationMinutes;
          const newEndTime = minutesToTime(Math.floor(newEndMinutes));

          // Create new dates
          const selectedDate = ""; // This should come from props
          const [startHour, startMinute] = newTime.split(":").map(Number);
          const [endHour, endMinute] = newEndTime.split(":").map(Number);

          const newStartsAt = new Date(`${selectedDate}T${newTime}:00`);
          const newEndsAt = new Date(`${selectedDate}T${newEndTime}:00`);

          onBookingMove(
            currentDrag.bookingId,
            currentDrag.currentStaffId,
            newStartsAt.toISOString(),
            newEndsAt.toISOString()
          );
        }

        setDraggingBooking(null);
        draggingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [bookings, onBookingMove]
  );

  // Resize handlers
  const handleBookingResizeStart = useCallback(
    (e: React.MouseEvent, booking: Booking, height: number, top: number, resizeType: "start" | "end") => {
      if (booking.status === "paid" || booking.status === "completed") {
        return;
      }

      e.stopPropagation();

      const resizeState: ResizeState = {
        bookingId: booking.id,
        staffId: booking.staff_id || "",
        originalHeight: height,
        originalTop: top,
        resizeType,
        currentHeight: height,
      };

      setResizingBooking(resizeState);
      resizingRef.current = resizeState;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentResize = resizingRef.current;
        if (!currentResize) return;

        const deltaY = moveEvent.clientY - e.clientY;
        const newHeight = Math.max(64, currentResize.originalHeight + (currentResize.resizeType === "end" ? deltaY : -deltaY));

        const updatedResize = {
          ...currentResize,
          currentHeight: newHeight,
        };

        setResizingBooking(updatedResize);
        resizingRef.current = updatedResize;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const currentResize = resizingRef.current;
        if (!currentResize) {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        const wasActualResize = Math.abs(currentResize.currentHeight - currentResize.originalHeight) > 5;

        if (!wasActualResize) {
          setResizingBooking(null);
          resizingRef.current = null;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        justFinishedResizeRef.current = true;
        setTimeout(() => {
          justFinishedResizeRef.current = false;
        }, 100);

        // Calculate new times
        const bookingToResize = bookings?.find((b) => b.id === currentResize.bookingId);
        if (bookingToResize && onBookingResize) {
          const originalStart = new Date(bookingToResize.starts_at);
          const originalEnd = new Date(bookingToResize.ends_at);

          if (currentResize.resizeType === "end") {
            // Resize end time
            const newEndMinutes = pixelsToMinutes(currentResize.originalTop + currentResize.currentHeight);
            const newEndTime = minutesToTime(newEndMinutes);
            const newEndDate = new Date(originalStart);
            const [endHour, endMinute] = newEndTime.split(":").map(Number);
            newEndDate.setHours(endHour, endMinute);

            onBookingResize(currentResize.bookingId, originalStart.toISOString(), newEndDate.toISOString());
          } else {
            // Resize start time
            const newStartMinutes = pixelsToMinutes(currentResize.originalTop);
            const newStartTime = minutesToTime(newStartMinutes);
            const newStartDate = new Date(originalEnd);
            const [startHour, startMinute] = newStartTime.split(":").map(Number);
            newStartDate.setHours(startHour, startMinute);

            onBookingResize(currentResize.bookingId, newStartDate.toISOString(), originalEnd.toISOString());
          }
        }

        setResizingBooking(null);
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [bookings, onBookingResize]
  );

  return {
    draggingBooking,
    resizingBooking,
    handleBookingMouseDown,
    handleBookingResizeStart,
    justFinishedDrag: justFinishedDragRef.current,
    justFinishedResize: justFinishedResizeRef.current,
  };
}
