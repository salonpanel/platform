"use client";

import { useEffect, useState } from "react";
import { SLOT_DURATION_MINUTES, SLOT_HEIGHT_PX } from "../constants/layout";

interface CurrentTimeIndicatorProps {
  currentMinutes: number | null;
  startHour?: number;
  endHour?: number;
  slotHeight?: number;
}

export function CurrentTimeIndicator({ currentMinutes, startHour = 8, endHour = 22, slotHeight = SLOT_HEIGHT_PX }: CurrentTimeIndicatorProps) {
  const [pulse, setPulse] = useState(false);
  const [displayTime, setDisplayTime] = useState("");

  // Pulse animation every 2s
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update display time
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      setDisplayTime(`${h}:${m}`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  if (currentMinutes === null) return null;

  const dayStartMinutes = startHour * 60;
  const dayEndMinutes = endHour * 60;
  if (currentMinutes < dayStartMinutes || currentMinutes > dayEndMinutes) return null;

  const relativeMinutes = currentMinutes - dayStartMinutes;
  const top = (relativeMinutes / SLOT_DURATION_MINUTES) * slotHeight;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      {/* Gradient line */}
      <div
        className="absolute left-3 right-0 top-0"
        style={{
          height: "1.5px",
          background: "linear-gradient(to right, #4FA1D8, rgba(79,161,216,0.15))",
        }}
      />

      {/* Dot with pulse */}
      <div className="absolute left-1 top-0 -translate-y-1/2">
        {/* Pulse ring */}
        {pulse && (
          <div
            className="absolute inset-0 rounded-full bg-[#4FA1D8]/40"
            style={{
              width: "20px",
              height: "20px",
              top: "-5px",
              left: "-5px",
              animation: "ping 0.7s ease-out forwards",
            }}
          />
        )}
        {/* Core dot */}
        <div
          className="w-2.5 h-2.5 bg-[#4FA1D8] rounded-full"
          style={{ boxShadow: "0 0 8px rgba(79,161,216,0.9), 0 0 2px rgba(79,161,216,1)" }}
        />
      </div>

      {/* Time label */}
      <div
        className="absolute left-5 -top-3 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-tight text-black select-none"
        style={{ background: "#4FA1D8" }}
      >
        {displayTime}
      </div>
    </div>
  );
}
