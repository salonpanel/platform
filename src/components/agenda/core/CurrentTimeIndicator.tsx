"use client";

import { useMemo } from "react";
import { theme } from "@/theme/ui";

interface CurrentTimeIndicatorProps {
  currentMinutes: number | null;
}

export function CurrentTimeIndicator({ currentMinutes }: CurrentTimeIndicatorProps) {
  if (currentMinutes === null) return null;

  const top = (currentMinutes / 15) * 64; // 64px per 15 minutes

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{
        top: `${top}px`,
        height: "2px",
      }}
    >
      <div className="absolute left-0 top-0 w-full h-full bg-gradient-to-r from-status-cancelled via-accent-pink to-status-cancelled shadow-status-cancelled/40" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-status-cancelled rounded-full -translate-x-1.5 border-2 border-primary shadow-status-cancelled/60" />
      <div className="absolute left-6 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-status-cancelled/90 backdrop-blur-sm rounded-lg text-xs font-semibold text-primary font-sans">
        Ahora
      </div>
    </div>
  );
}
