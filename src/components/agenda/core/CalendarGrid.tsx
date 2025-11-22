"use client";

import { useMemo } from "react";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  startHour: number;
  endHour: number;
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  staffId: string;
}

export function CalendarGrid({ startHour, endHour, onSlotClick, staffId }: CalendarGridProps) {
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
      }
    }
    return slots;
  }, [startHour, endHour]);

  const hasBookingAtPosition = (timeSlot: string) => {
    // This will be passed from parent component
    // For now, return false - will be implemented when integrated
    return false;
  };

  return (
    <>
      {/* Grid slots */}
      {timeSlots.map((time, index) => {
        const isHour = time.endsWith(":00");
        const hasBooking = hasBookingAtPosition(time);

        return (
          <div
            key={time}
            onClick={(e) => onSlotClick?.(e, staffId, time)}
            className={cn(
              "absolute left-0 right-0 cursor-pointer transition-colors duration-150",
              isHour ? `border-t ${theme.colors.borderHover}` : `border-t border-dashed ${theme.colors.borderDefault}`,
              !hasBooking ? "hover:bg-glass" : ""
            )}
            style={{ top: `${index * 64}px`, height: "64px" }}
            data-time-slot={time}
          />
        );
      })}
    </>
  );
}
