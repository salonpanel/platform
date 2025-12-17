"use client";

import { SLOT_HEIGHT_PX, SLOT_DURATION_MINUTES } from "../constants/layout";

interface CurrentTimeIndicatorProps {
  currentMinutes: number | null;
  startHour?: number;
  endHour?: number;
}

export function CurrentTimeIndicator({ currentMinutes, startHour = 8, endHour = 22 }: CurrentTimeIndicatorProps) {
  if (currentMinutes === null) return null;

  const dayStartMinutes = startHour * 60;
  const dayEndMinutes = endHour * 60;

  // Si la hora actual está fuera del rango del día, no mostramos el indicador
  if (currentMinutes < dayStartMinutes || currentMinutes > dayEndMinutes) return null;

  const relativeMinutes = currentMinutes - dayStartMinutes;
  const top = (relativeMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{
        top: `${top}px`,
        height: "2px",
      }}
    >
      {/* Neon Glow Line */}
      <div 
        className="absolute left-0 top-0 w-full h-full bg-[#4FE3C1] opacity-80"
        style={{ boxShadow: "0 0 10px rgba(79,227,193,0.6)" }}
      />
      
      {/* Dot */}
      <div 
        className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#4FE3C1] rounded-full -translate-x-1"
        style={{ boxShadow: "0 0 10px rgba(79,227,193,0.8)" }}
      />
      
      {/* Label */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[#4FE3C1] rounded-sm text-[9px] font-bold text-black font-mono tracking-tighter shadow-lg">
        AHORA
      </div>
    </div>
  );
}
