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
}

export function TimeColumn({ startHour, endHour, timezone }: TimeColumnProps) {
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
    <div className={`border-r border-white/5 bg-[#0B0C10]/80 backdrop-blur-xl sticky left-0 z-30 flex flex-col h-full`} style={{ width: `${TIME_COLUMN_WIDTH_PX}px` }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0B0C10]/90 border-b border-white/5 px-4 py-4 backdrop-blur-md flex items-center flex-shrink-0" style={{ height: `${TIMELINE_HEADER_HEIGHT_PX}px` }}>
        <div className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          "text-gray-500 font-sans"
        )}>
          Hora
        </div>
      </div>

      {/* Time slots */}
      <div className="relative flex-1 overflow-y-auto scrollbar-hide bg-transparent" style={{ height: `calc(100% - ${TIMELINE_HEADER_HEIGHT_PX}px)` }}>
        {timeSlots.map((time, index) => {
          const [hour, minute] = time.split(":").map(Number);
          const isHour = minute === 0;

          return (
            <div
              key={time}
              className={cn(
                "absolute left-0 right-0 flex items-start justify-end pr-3 pt-1",
                isHour ? "border-t border-white/[0.03]" : "border-t border-dashed border-white/[0.02]"
              )}
              style={{
                top: `${index * SLOT_HEIGHT_PX}px`,
                height: `${SLOT_HEIGHT_PX}px`,
                width: "100%",
                left: 0,
                right: 0,
                pointerEvents: "none"
              }}
            >
              {isHour && (
                <span className={cn(
                  "text-xs font-mono",
                  "text-gray-500"
                )}>
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
