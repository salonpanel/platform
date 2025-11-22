"use client";

import { format } from "date-fns";
import { StaffBlocking } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

interface BlockingOverlayProps {
  blockings: StaffBlocking[];
  timezone: string;
}

const blockingColors = {
  block: "bg-glass border-l-4 border-accent-blue/25 text-secondary opacity-50 backdrop-blur-sm",
  absence: "bg-status-cancelled/10 border-l-4 border-status-cancelled/25 text-status-cancelled opacity-60 backdrop-blur-sm",
  vacation: "bg-accent-blue/10 border-l-4 border-accent-blue/25 text-accent-blue opacity-60 backdrop-blur-sm",
};

export function BlockingOverlay({ blockings, timezone }: BlockingOverlayProps) {
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

    // Position in pixels using shared constants
    const top = Math.max(0, Math.round(startMinutesFromMidnight / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX);
    const height = Math.max(MIN_BOOKING_HEIGHT_PX, Math.round((endMinutesFromMidnight - startMinutesFromMidnight) / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX);

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
              "absolute left-3 right-3 rounded-xl border p-2 z-5",
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
