"use client";

import { useMemo } from "react";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";
import type { TimeWindow } from "../utils/timeWindows";

interface CalendarGridProps {
  startHour: number;
  endHour: number;
  onSlotClick?: (e: React.MouseEvent, staffId: string, timeSlot: string) => void;
  staffId: string;
  availabilityWindows?: TimeWindow[];
}

export function CalendarGrid({ startHour, endHour, onSlotClick, staffId, availabilityWindows }: CalendarGridProps) {
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
        slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
      }
    }
    return slots;
  }, [startHour, endHour]);

  const isSlotDisabled = (timeSlot: string) => {
    if (!availabilityWindows || availabilityWindows.length === 0) return true;

    const [h, m] = timeSlot.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return false;

    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + SLOT_DURATION_MINUTES;

    const hasOverlap = availabilityWindows.some((w) => {
      return endMinutes > w.startMinutes && startMinutes < w.endMinutes;
    });

    return !hasOverlap;
  };

  return (
    <>
      {/* Grid slots */}
      {timeSlots.map((time, index) => {
        const isHour = time.endsWith(":00");
        const disabled = isSlotDisabled(time);

        return (
          <div
            key={time}
            onClick={(e) => onSlotClick?.(e, staffId, time)}
            className={cn(
              "absolute inset-x-0 cursor-pointer transition-colors duration-150",
              disabled
                ? "bg-black/40 pointer-events-none bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_4px)]"
                : "hover:bg-white/[0.02]"
            )}
            style={{
              top: index * SLOT_HEIGHT_PX,
              height: SLOT_HEIGHT_PX,
              borderTopWidth: 1,
              borderTopColor: isHour ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
              borderTopStyle: "solid",
              zIndex: 0,
            }}
            data-time-slot={time}
          />
        );
      })}
    </>
  );
}
