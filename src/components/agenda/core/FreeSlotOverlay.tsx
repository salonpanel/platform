"use client";

import { motion } from "framer-motion";
import { minutesToTime } from "@/lib/timezone";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES, MIN_BOOKING_HEIGHT_PX } from "../constants/layout";

interface FreeSlot {
  startMinutes: number;
  endMinutes: number;
  duration: number;
}

interface FreeSlotOverlayProps {
  freeSlots: FreeSlot[];
  onSlotClick?: (slot: { staffId: string; time: string; endTime: string; date: string }) => void;
  staffId: string;
  selectedDate: string;
}

export function FreeSlotOverlay({
  freeSlots,
  onSlotClick,
  staffId,
  selectedDate
}: FreeSlotOverlayProps) {
  return (
    <>
      {freeSlots.map((gap, gapIndex) => {
        const relativeStartMinutes = gap.startMinutes;
        const relativeEndMinutes = gap.endMinutes;

        // Calculate position using shared constants
        const slotIndexStart = Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES);
        const slotIndexEnd = Math.round(relativeEndMinutes / SLOT_DURATION_MINUTES);
        const top = Math.max(0, slotIndexStart * SLOT_HEIGHT_PX);
        const height = Math.max(MIN_BOOKING_HEIGHT_PX, (slotIndexEnd - slotIndexStart) * SLOT_HEIGHT_PX);

        const durationHours = Math.floor(gap.duration / 60);
        const durationMins = gap.duration % 60;
        const durationLabel = durationHours > 0
          ? `${durationHours}h ${durationMins > 0 ? durationMins + "m" : ""}`.trim()
          : `${durationMins}m`;

        return (
          <motion.div
            key={`free-slot-${gapIndex}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: gapIndex * 0.05 }}
            onClick={(e) => {
              e.stopPropagation();
              const gapStartTime = minutesToTime(gap.startMinutes);
              const gapEndTime = minutesToTime(gap.endMinutes);
              onSlotClick?.({
                staffId,
                time: gapStartTime,
                endTime: gapEndTime,
                date: selectedDate,
              });
            }}
            className={cn(
              "absolute left-3 right-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 z-0 group",
              "border-[#4FE3C1]/30 bg-[#4FE3C1]/5 hover:bg-[#4FE3C1]/10 hover:border-[#4FE3C1]/50 backdrop-blur-sm"
            )}
            style={{
              top: `${top}px`,
              height: `${height}px`,
              minHeight: `${MIN_BOOKING_HEIGHT_PX}px`,
            }}
            title={`Hueco libre: ${minutesToTime(gap.startMinutes)} - ${minutesToTime(gap.endMinutes)} (${durationLabel})`}
          >
            <div className="flex items-center justify-center h-full p-2">
              <div className="text-center">
                <div className={cn(
                  "text-xs font-semibold mb-0.5",
                  "text-[#4FE3C1] font-sans"
                )}>
                  Libre {durationLabel}
                </div>
                <div className={cn(
                  "text-[10px] font-mono",
                  "text-[#4FE3C1]/70 font-mono"
                )}>
                  {minutesToTime(gap.startMinutes)} - {minutesToTime(gap.endMinutes)}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}
