"use client";

import { format } from "date-fns";
import { StaffBlocking } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

interface BlockingOverlayProps {
  blockings: StaffBlocking[];
  timezone: string;
  dayStartHour?: number;
}

const blockingColors = {
  block: "bg-white/[0.03] border-l-[3px] border-white/20 text-gray-400 backdrop-blur-[2px]",
  absence: "bg-red-500/[0.05] border-l-[3px] border-red-500/40 text-red-400 backdrop-blur-[2px]",
  vacation: "bg-blue-500/[0.05] border-l-[3px] border-blue-500/40 text-blue-400 backdrop-blur-[2px]",
};

export function BlockingOverlay({ blockings, timezone, dayStartHour = 8 }: BlockingOverlayProps) {
  const getBlockingPosition = (blocking: StaffBlocking) => {
    const startsAt = new Date(blocking.start_at);
    const endsAt = new Date(blocking.end_at);
    const localStartsAt = new Date(
      startsAt.toLocaleString("en-US", { timeZone: timezone })
    );
    const localEndsAt = new Date(
      endsAt.toLocaleString("en-US", { timeZone: timezone })
    );

    // Calculate minutes from midnight
    const startMinutesFromMidnight = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
    const endMinutesFromMidnight = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();

    const dayStartMinutes = dayStartHour * 60;
    const relativeStartMinutes = startMinutesFromMidnight - dayStartMinutes;

    // Position in pixels using shared constants, aligned with dynamic day start
    const top = Math.max(0, Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX);
    const height = Math.max(
      MIN_BOOKING_HEIGHT_PX,
      Math.round((endMinutesFromMidnight - Math.max(startMinutesFromMidnight, dayStartMinutes)) / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX
    );

    return { top, height, startMinutes: startMinutesFromMidnight, endMinutes: endMinutesFromMidnight };
  };

  return (
    <>
      {blockings.map((blocking) => {
        const pos = getBlockingPosition(blocking);
        if (!pos) return null;

        const { top, height } = pos;
        const typeLabels = {
          block: "Bloqueo",
          absence: "Ausencia",
          vacation: "Vacaciones",
        };

        return (
          <div
            key={blocking.id}
            data-blocking
            className={cn(
              "absolute left-3 right-3 rounded-xl border border-white/5 p-2 z-10 shadow-sm transition-all duration-150 hover:shadow-md group opacity-50 hover:opacity-70",
              blockingColors[blocking.type] || blockingColors.block
            )}
            style={{
              top: `${top}px`,
              height: `${Math.max(height, MIN_BOOKING_HEIGHT_PX)}px`,
              minHeight: `${MIN_BOOKING_HEIGHT_PX}px`,
            }}
            title={blocking.reason || typeLabels[blocking.type]}
          >
            <div className="flex items-start justify-between h-full opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-mono font-semibold">
                    {format(new Date(blocking.start_at), "HH:mm")} - {format(new Date(blocking.end_at), "HH:mm")}
                  </span>
                </div>
                <div className="text-xs font-medium truncate">
                  {blocking.reason || typeLabels[blocking.type]}
                </div>
                {blocking.notes && (
                  <div className="text-xs opacity-60 truncate mt-0.5">
                    {blocking.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
