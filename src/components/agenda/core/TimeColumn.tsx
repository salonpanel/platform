"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";

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
    <div className="w-20 border-r border-border-default bg-primary sticky left-0 z-10 flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-primary border-b border-border-default px-4 py-4 backdrop-blur-md flex items-center flex-shrink-0" style={{ height: "72px" }}>
        <div className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          "text-tertiary font-sans"
        )}>
          Hora
        </div>
      </div>

      {/* Time slots */}
      <div className="relative flex-1 overflow-y-auto scrollbar-hide bg-primary" style={{ height: `calc(100% - 72px)` }}>
        {timeSlots.map((time, index) => {
          const [hour, minute] = time.split(":").map(Number);
          const isHour = minute === 0;

          return (
            <div
              key={time}
              className={cn(
                "absolute left-0 right-0 flex items-start justify-end pr-3 pt-1",
                isHour ? `border-t ${theme.colors.borderHover}` : `border-t border-dashed ${theme.colors.borderDefault}`
              )}
              style={{
                top: `${index * 64}px`,
                height: "64px",
                width: "100%",
                left: 0,
                right: 0,
                pointerEvents: "none"
              }}
            >
              {isHour && (
                <span className={cn(
                  "text-xs font-semibold font-mono",
                  "text-secondary"
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
