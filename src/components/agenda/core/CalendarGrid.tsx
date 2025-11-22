"use client";

import { useMemo } from "react";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";

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
      for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
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

        const borderColor = isHour ? theme.colors.borderHover : theme.colors.borderDefault;
        const borderStyle = isHour ? "solid" : "dashed";

        return (
          <div
            key={time}
            onClick={(e) => onSlotClick?.(e, staffId, time)}
            className={cn(
              "absolute inset-x-0 cursor-pointer transition-colors duration-150",
              !hasBooking && "hover:bg-glass/20"
            )}
            style={{
              top: index * SLOT_HEIGHT_PX,
              height: SLOT_HEIGHT_PX,
              borderTopStyle: borderStyle,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              backgroundColor: "transparent",
              zIndex: 5,
            }}
            data-time-slot={time}
          />
        );
      })}
    </>
  );
}
