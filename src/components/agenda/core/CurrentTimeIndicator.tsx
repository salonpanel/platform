"use client";

import { useMemo } from "react";
import { theme } from "@/theme/ui";
import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";

interface CurrentTimeIndicatorProps {
  currentMinutes: number | null;
}

export function CurrentTimeIndicator({ currentMinutes }: CurrentTimeIndicatorProps) {
  if (currentMinutes === null) return null;

  const top = (currentMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX; // Use shared constants

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{
        top: `${top}px`,
        height: "2px",
      }}
    >
      <div className="absolute left-0 top-0 w-full h-full bg-gradient-to-r from-[#4FE3C1] via-[#4FE3C1] to-transparent opacity-80" style={{ boxShadow: "0 0 8px rgba(79,227,193,0.4)" }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#4FE3C1] rounded-full -translate-x-1.5 border-2 border-[#0B0C10]" style={{ boxShadow: "0 0 12px rgba(79,227,193,0.6)" }} />
      <div className="absolute left-6 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-[#4FE3C1]/20 backdrop-blur-md rounded-lg text-[10px] font-semibold text-[#4FE3C1] font-sans border border-[#4FE3C1]/30">
        Ahora
      </div>
    </div>
  );
}
