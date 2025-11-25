"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface HourSlotProps {
  hour: number;
  children?: ReactNode;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  isCurrentHour?: boolean;
  hourHeight: number;
}

/**
 * Hour slot component for the timeline
 * Shows hour label and content area for bookings
 */
export function HourSlot({ hour, children, density = "default", className, isCurrentHour = false, hourHeight }: HourSlotProps) {
  const hourLabel = format(new Date().setHours(hour, 0, 0, 0), "HH:mm");
  const textSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";
  
  return (
    <div
      className={cn(
        "flex gap-2 relative",
        isCurrentHour ? "bg-[#4FE3C1]/5" : "",
        className
      )}
      style={{ height: `${hourHeight}px` }}
    >
      {/* Hour label - fixed width column */}
      <div className="flex-shrink-0 w-14 pt-1">
        <div
          className={cn(
            "font-mono font-medium text-right pr-2 transition-colors",
            isCurrentHour ? "text-[#4FE3C1]" : "text-white/30",
            textSize
          )}
        >
          {hourLabel}
        </div>
      </div>

      {/* Content area - for bookings */}
      <div className="flex-1 min-h-0 relative">
        {children && (
          <div className="relative z-10">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}




