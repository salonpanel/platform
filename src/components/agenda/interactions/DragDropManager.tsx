"use client";

import { useState, useRef, useCallback, RefObject } from "react";
import { Booking } from "@/types/agenda";
import type { StaffWindowsMap, TimeWindow } from "../utils/timeWindows";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";

interface DragDropManagerProps {
  bookings?: Booking[];
  onBookingMove?: (bookingId: string, newStaffId: string, newStartTime: string, newEndTime: string) => void;
  onBookingResize?: (bookingId: string, newStartTime: string, newEndTime: string) => void;
  timezone?: string;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  dayStartHour?: number;
  dayEndHour?: number;
  staffWindows?: StaffWindowsMap;
  slotHeight?: number;
}

export interface DragState {
  bookingId: string;
  bookingSnapshot: Booking;
  originalStaffId: string;
  originalTop: number;
  initialScrollTop: number;
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
  scrollContainerRef,
  dayStartHour,
  dayEndHour,
  staffWindows,
  slotHeight = SLOT_HEIGHT_PX,
}: DragDropManagerProps = {}) {
  const [draggingBooking, setDraggingBooking] = useState<DragState | null>(null);
  const [resizingBooking, setResizingBooking] = useState<ResizeState | null>(null);

  const draggingRef = useRef<DragState | null>(null);
  const resizingRef = useRef<ResizeState | null>(null);

  const justFinishedDragRef = useRef(false);
  const justFinishedResizeRef = useRef(false);

  // Estado para auto-scroll continuo mientras el cursor está en el borde
  const scrollDirectionRef = useRef<0 | 1 | -1>(0);
  const scrollAnimationFrameRef = useRef<number | null>(null);

  const START_HOUR = dayStartHour ?? 8;
  const END_HOUR = dayEndHour ?? 22;

  // Utility functions
  const pixelsToMinutes = (pixels: number): number => {
    const slots = Math.round(Math.max(0, pixels) / slotHeight); // Use dynamic slot height
    const relativeMinutes = slots * SLOT_DURATION_MINUTES;
    return START_HOUR * 60 + relativeMinutes;
  };
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
  const TOTAL_SLOTS = TOTAL_MINUTES / SLOT_DURATION_MINUTES;
  const TOTAL_HEIGHT_PX = TOTAL_SLOTS * slotHeight;

  const snapToValidWindow = (rawStartMinutes: number, durationMinutes: number, staffId: string): number | null => {
    const windowsForStaff: TimeWindow[] | undefined = staffWindows ? staffWindows[staffId] : undefined;

    if (!windowsForStaff || windowsForStaff.length === 0) {
      return null;
    }

    const validWindows = windowsForStaff.filter((w) => w.endMinutes - w.startMinutes >= durationMinutes);
    if (validWindows.length === 0) return null;

    const insideWindow = validWindows.find((w) => rawStartMinutes >= w.startMinutes && rawStartMinutes <= w.endMinutes - durationMinutes);
    if (insideWindow) {
      return Math.min(Math.max(rawStartMinutes, insideWindow.startMinutes), insideWindow.endMinutes - durationMinutes);
    }

    const sorted = [...validWindows].sort((a, b) => a.startMinutes - b.startMinutes);

    if (rawStartMinutes < sorted[0].startMinutes) {
      return sorted[0].startMinutes;
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (rawStartMinutes > current.endMinutes && rawStartMinutes < next.startMinutes) {
        return next.startMinutes;
      }
    }

    const last = sorted[sorted.length - 1];
    const latestStart = last.endMinutes - durationMinutes;
    if (rawStartMinutes <= last.endMinutes && latestStart >= last.startMinutes) {
      return latestStart;
    }

    return null;
  };

  const stopAutoScroll = () => {
    scrollDirectionRef.current = 0;
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
  };

  const startAutoScrollLoop = () => {
    if (scrollAnimationFrameRef.current !== null) return;

    const step = () => {
      const dir = scrollDirectionRef.current;
      const container = scrollContainerRef?.current;
      const currentDrag = draggingRef.current;

      if (!dir || !container || !currentDrag) {
        scrollAnimationFrameRef.current = null;
        return;
      }

      const maxScrollTop = Math.max(0, TOTAL_HEIGHT_PX - container.clientHeight);
      const prevScrollTop = container.scrollTop;
      const scrollStep = 12; // velocidad de scroll por frame

      const nextScrollTop = Math.min(maxScrollTop, Math.max(0, prevScrollTop + dir * scrollStep));
      container.scrollTop = nextScrollTop;

      const scrollDelta = nextScrollTop - currentDrag.initialScrollTop;
      const newTopRaw = currentDrag.originalTop + scrollDelta;

      const slotIndex = Math.round(newTopRaw / slotHeight);
      const clampedSlotIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, slotIndex));
      const clampedY = clampedSlotIndex * slotHeight;

      const updatedDrag: DragState = {
        ...currentDrag,
        currentTop: clampedY,
      };

      draggingRef.current = updatedDrag;
      setDraggingBooking(updatedDrag);

      scrollAnimationFrameRef.current = requestAnimationFrame(step);
    };

    scrollAnimationFrameRef.current = requestAnimationFrame(step);
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

      const initialScrollTop = scrollContainerRef?.current?.scrollTop ?? 0;

      const dragState: DragState = {
        bookingId: booking.id,
        bookingSnapshot: booking,
        originalStaffId: booking.staff_id || "",
        originalTop: top,
        initialScrollTop,
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

        // Desplazamiento vertical relativo al punto inicial del drag
        const deltaY = moveEvent.clientY - e.clientY;

        // Determinar dirección de auto-scroll según posición del ratón
        const container = scrollContainerRef?.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const threshold = 60; // px desde el borde
          if (moveEvent.clientY < rect.top + threshold) {
            scrollDirectionRef.current = -1;
            startAutoScrollLoop();
          } else if (moveEvent.clientY > rect.bottom - threshold) {
            scrollDirectionRef.current = 1;
            startAutoScrollLoop();
          } else {
            scrollDirectionRef.current = 0;
          }
        }

        const scrollDelta = container ? container.scrollTop - currentDrag.initialScrollTop : 0;
        const newTopRaw = currentDrag.originalTop + deltaY + scrollDelta;

        const slotIndex = Math.round(newTopRaw / slotHeight);
        const clampedSlotIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, slotIndex));
        const clampedY = clampedSlotIndex * slotHeight;

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

        // Calculate new time based on position
        const rawMinutes = pixelsToMinutes(currentDrag.currentTop);

        const bookingToMove = bookings?.find((b) => b.id === currentDrag.bookingId);
        if (bookingToMove && onBookingMove) {
          const originalStart = new Date(bookingToMove.starts_at);
          const originalEnd = new Date(bookingToMove.ends_at);
          const durationMs = originalEnd.getTime() - originalStart.getTime();
          const durationMinutes = durationMs / (1000 * 60);

          const snappedStartMinutes = currentDrag.currentStaffId
            ? snapToValidWindow(rawMinutes, durationMinutes, currentDrag.currentStaffId)
            : null;

          if (snappedStartMinutes === null) {
            setDraggingBooking(null);
            draggingRef.current = null;
            stopAutoScroll();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            return;
          }

          const newEndMinutes = snappedStartMinutes + durationMinutes;

          const newTime = minutesToTime(snappedStartMinutes);
          const newEndTime = minutesToTime(Math.floor(newEndMinutes));

          // Derive new dates from the original start date, adjusting only time
          const [startHour, startMinute] = newTime.split(":").map(Number);
          const [endHour, endMinute] = newEndTime.split(":").map(Number);

          const newStartsAt = new Date(originalStart);
          newStartsAt.setHours(startHour, startMinute, 0, 0);

          const newEndsAt = new Date(originalStart);
          newEndsAt.setHours(endHour, endMinute, 0, 0);

          onBookingMove(
            currentDrag.bookingId,
            currentDrag.currentStaffId,
            newStartsAt.toISOString(),
            newEndsAt.toISOString()
          );
        }

        setDraggingBooking(null);
        draggingRef.current = null;
        stopAutoScroll();
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
        const newHeight = Math.max(slotHeight, currentResize.originalHeight + (currentResize.resizeType === "end" ? deltaY : -deltaY));

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
            // Resize end time, clamped to availability windows for this staff
            const rawEndMinutes = pixelsToMinutes(currentResize.originalTop + currentResize.currentHeight);

            // Base start minutes from visual position
            const startMinutes = pixelsToMinutes(currentResize.originalTop);

            let finalEndMinutes = rawEndMinutes;

            const windowsForStaff = staffWindows ? staffWindows[currentResize.staffId] : undefined;
            if (windowsForStaff && windowsForStaff.length > 0) {
              const window = windowsForStaff.find(
                (w) => startMinutes >= w.startMinutes && startMinutes < w.endMinutes
              );

              if (window) {
                const minEnd = Math.max(startMinutes + SLOT_DURATION_MINUTES, window.startMinutes + SLOT_DURATION_MINUTES);
                const maxEnd = window.endMinutes;
                finalEndMinutes = Math.min(Math.max(rawEndMinutes, minEnd), maxEnd);
              }
            }

            const newEndTime = minutesToTime(finalEndMinutes);
            const newEndDate = new Date(originalStart);
            const [endHour, endMinute] = newEndTime.split(":").map(Number);
            newEndDate.setHours(endHour, endMinute);

            onBookingResize(currentResize.bookingId, originalStart.toISOString(), newEndDate.toISOString());
          } else {
            // Resize start time, clamped to availability windows for this staff
            // Keep the original end fixed and adjust the start within the containing window

            // Compute original end minutes in tenant timezone so it aligns with staffWindows
            const originalEndTenant = new Date(
              originalEnd.toLocaleString("en-US", { timeZone: timezone })
            );
            const originalEndMinutes =
              originalEndTenant.getHours() * 60 + originalEndTenant.getMinutes();

            // Derive a raw new start from the current height (duration) anchored at the fixed end
            const slots = Math.max(1, Math.round(currentResize.currentHeight / slotHeight));
            const newDurationMinutes = slots * SLOT_DURATION_MINUTES;
            let rawStartMinutes = originalEndMinutes - newDurationMinutes;

            const windowsForStaff = staffWindows ? staffWindows[currentResize.staffId] : undefined;

            if (!windowsForStaff || windowsForStaff.length === 0) {
              // No availability windows for this staff/day -> cancel resize
              setResizingBooking(null);
              resizingRef.current = null;
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
              return;
            }

            // Find the window that contains the (fixed) booking end
            const containingWindow = windowsForStaff.find(
              (w) => originalEndMinutes > w.startMinutes && originalEndMinutes <= w.endMinutes
            );

            if (!containingWindow) {
              // End is not inside any availability window -> cancel resize
              setResizingBooking(null);
              resizingRef.current = null;
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
              return;
            }

            // Clamp start so that it stays within the containing window and leaves at least one slot
            const maxStart = originalEndMinutes - SLOT_DURATION_MINUTES;
            const minStart = containingWindow.startMinutes;

            if (maxStart <= minStart) {
              // Not enough room to keep at least one slot -> cancel resize
              setResizingBooking(null);
              resizingRef.current = null;
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
              return;
            }

            const clampedStartMinutes = Math.min(
              Math.max(rawStartMinutes, minStart),
              maxStart
            );

            const newStartTime = minutesToTime(clampedStartMinutes);
            const newStartDate = new Date(originalEnd);
            const [startHour, startMinute] = newStartTime.split(":").map(Number);
            newStartDate.setHours(startHour, startMinute, 0, 0);

            onBookingResize(
              currentResize.bookingId,
              newStartDate.toISOString(),
              originalEnd.toISOString()
            );
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
