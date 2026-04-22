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
            onClick={(e) => !disabled && onSlotClick?.(e, staffId, time)}
            className={cn(
              "absolute inset-x-0 transition-colors duration-150",
              disabled
                ? "pointer-events-none"
                : "cursor-pointer hover:bg-[rgba(79,161,216,0.04)]"
            )}
            style={{
              top: index * SLOT_HEIGHT_PX,
              height: SLOT_HEIGHT_PX,
              borderTopWidth: 1,
              borderTopColor: isHour ? "var(--bf-border)" : "rgba(29,36,48,0.5)",
              borderTopStyle: "solid",
              /* Fuera de horario: patrón muy sutil del brand kit, sin oscurecer el fondo */
              background: disabled
                ? "repeating-linear-gradient(135deg, rgba(29,36,48,0.25) 0, rgba(29,36,48,0.25) 1px, transparent 1px, transparent 10px)"
                : undefined,
              zIndex: 0,
            }}
            data-time-slot={time}
          />
        );
      })}
    </>
  );
}
