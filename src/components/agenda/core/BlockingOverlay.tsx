"use client";

import { format } from "date-fns";
import { Lock, UserX, Plane } from "lucide-react";
import { StaffBlocking } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

const BLOCKING_ICONS = {
  block:    Lock,
  absence:  UserX,
  vacation: Plane,
} as const;

interface BlockingOverlayProps {
  blockings: StaffBlocking[];
  timezone: string;
  dayStartHour?: number;
}

const blockingColors = {
  block:    "bg-[var(--bf-border)]/30 border-l-[3px] border-[var(--bf-border-2)] text-[var(--bf-ink-400)]",
  absence:  "bg-[rgba(224,96,114,0.06)] border-l-[3px] border-[var(--bf-danger)]/40 text-[var(--bf-danger)]",
  vacation: "bg-[rgba(79,161,216,0.06)] border-l-[3px] border-[var(--bf-primary)]/40 text-[var(--bf-primary)]",
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
              "absolute left-3 right-3 rounded-[var(--r-md)] border border-[var(--bf-border)] p-2 z-10 transition-all duration-150 group opacity-60 hover:opacity-85",
              blockingColors[blocking.type] || blockingColors.block
            )}
            style={{
              top: `${top}px`,
              height: `${Math.max(height, MIN_BOOKING_HEIGHT_PX)}px`,
              minHeight: `${MIN_BOOKING_HEIGHT_PX}px`,
            }}
            title={blocking.reason || typeLabels[blocking.type]}
          >
            {/* Icono permanente cuando hay espacio suficiente (≥30px) */}
            {height >= 30 && (() => {
              const Icon = BLOCKING_ICONS[blocking.type] ?? Lock;
              return (
                <div className="absolute top-1.5 left-2 opacity-60 group-hover:opacity-90 transition-opacity duration-150">
                  <Icon className="h-3 w-3" />
                </div>
              );
            })()}

            {/* Detalles completos: solo en hover */}
            <div className="flex items-start justify-between h-full opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex-1 min-w-0 pl-4">
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
