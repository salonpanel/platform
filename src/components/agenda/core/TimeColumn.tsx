"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, TIMELINE_HEADER_HEIGHT_PX, TIME_COLUMN_WIDTH_PX } from "../constants/layout";

interface TimeColumnProps {
  startHour: number;
  endHour: number;
  timezone: string;
  slotHeight?: number;
}

export function TimeColumn({ startHour, endHour, timezone, slotHeight = SLOT_HEIGHT_PX }: TimeColumnProps) {
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
      }
    }
    return slots;
  }, [startHour, endHour]);

  return (
    <div
      className="bg-[#0B0C10]/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-full z-30"
      style={{ width: `${TIME_COLUMN_WIDTH_PX}px` }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0B0C10]/90 backdrop-blur-md border-b border-white/5 px-0 py-4 flex items-center justify-center flex-shrink-0" style={{ height: `${TIMELINE_HEADER_HEIGHT_PX}px` }}>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
          Hora
        </div>
      </div>

      {/* Time slots */}
      <div className="relative flex-1 w-full">
        {timeSlots.map((time, index) => {
          const [hour, minute] = time.split(":").map(Number);
          const isHour = minute === 0;

          return (
            <div
              key={time}
              className={cn(
                "absolute left-0 right-0 flex items-start justify-center",
                isHour ? "border-t border-white/[0.03]" : "border-t border-white/[0.015]"
              )}
              style={{
                top: `${index * slotHeight}px`,
                height: `${slotHeight}px`,
              }}
            >
              {isHour && (
                <span className="text-[11px] font-mono font-medium text-gray-500 -mt-2.5 bg-[#0B0C10] px-1">
                  {time}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
