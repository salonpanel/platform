"use client";

import { ReactNode, useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { HourSlot } from "./HourSlot";
import { motion } from "framer-motion";

interface TimelineProps {
  startHour?: number;
  endHour?: number;
  children?: (hour: number) => ReactNode;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  hourHeight?: number;
}

/**
 * Timeline component for day view with hour slots
 * Shows current time indicator and hour grid lines
 */
export function Timeline({
  startHour = 8,
  endHour = 20,
  children,
  density = "default",
  className,
  hourHeight,
}: TimelineProps) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  
  // Current hour for highlighting
  const currentHour = useMemo(() => {
    const now = new Date();
    return now.getHours();
  }, []);

  // Height per hour based on density
  const defaultHourHeight = density === "ultra-compact" ? 50 : density === "compact" ? 65 : 80;
  const effectiveHourHeight = hourHeight || defaultHourHeight;

  return (
    <div className={cn("flex flex-col relative", className)}>
      {/* Current time indicator */}
      {currentHour >= startHour && currentHour <= endHour && (
        <motion.div
          layoutId="current-time-line"
          className="absolute left-0 right-0 z-30 pointer-events-none"
          style={{
            top: `${(currentHour - startHour) * effectiveHourHeight + effectiveHourHeight / 2}px`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative">
            <div className="absolute left-0 w-full h-0.5 bg-gradient-to-r from-[#4FE3C1] via-[#3A6DFF] to-transparent" />
            <motion.div
              className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#4FE3C1] shadow-lg shadow-[#4FE3C1]/40"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <div className="absolute left-4 -translate-y-1/2 bg-gradient-to-r from-[#4FE3C1] to-[#3A6DFF] text-white text-[10px] font-medium px-2 py-0.5 rounded-md shadow-lg">
              {format(new Date(), "HH:mm")}
            </div>
          </div>
        </motion.div>
      )}

      {/* Hours timeline */}
      <div
        className="relative"
        style={{
          height: `${hours.length * effectiveHourHeight}px`,
          minHeight: `${hours.length * effectiveHourHeight}px`
        }}
      >
        {/* Hour grid lines - aligned precisely with hour slots */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {hours.map((hour, index) => {
            const top = index * effectiveHourHeight;
            return (
              <div
                key={`hour-line-${hour}`}
                className="absolute left-14 right-0 h-px bg-white/5"
                style={{ top }}
              />
            );
          })}

          {/* Half-hour tick marks */}
          {effectiveHourHeight >= 50 &&
            hours.slice(0, -1).map((hour, index) => {
              const top = index * effectiveHourHeight + effectiveHourHeight / 2;
              return (
                <div
                  key={`half-hour-${hour}`}
                  className="absolute left-16 right-0 h-px bg-white/[0.02]"
                  style={{ top }}
                />
              );
            })}
        </div>

        {/* Hour slots with labels */}
        {hours.map((hour, index) => (
          <div
            key={hour}
            style={{
              height: `${effectiveHourHeight}px`,
              position: 'absolute',
              top: `${index * effectiveHourHeight}px`,
              left: 0,
              right: 0
            }}
            className="relative"
          >
            <HourSlot
              hour={hour}
              density={density}
              isCurrentHour={hour === currentHour}
              hourHeight={effectiveHourHeight}
            >
              {children && children(hour)}
            </HourSlot>
          </div>
        ))}
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0E0F11] to-transparent pointer-events-none" />
    </div>
  );
}




