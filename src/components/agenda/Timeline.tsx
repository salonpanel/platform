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
 * Componente Timeline premium para mostrar horas del día
 * Con detección automática de hora actual y animaciones suaves
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
  
  // Detectar hora actual para resaltar
  const currentHour = useMemo(() => {
    const now = new Date();
    return now.getHours();
  }, []);

  // Altura por hora según densidad (si no se proporciona)
  const defaultHourHeight = density === "ultra-compact" ? 48 : density === "compact" ? 64 : 80;
  const effectiveHourHeight = hourHeight || defaultHourHeight;

  return (
    <div className={cn("flex flex-col relative", className)}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {hours.map((hour, index) => (
          <div
            key={`grid-${hour}`}
            className="absolute left-16 right-0 border-t border-white/7"
            style={{ top: `${index * effectiveHourHeight}px` }}
          />
        ))}
        {hours.slice(0, -1).map((hour, index) => (
          <div
            key={`grid-half-${hour}`}
            className="absolute left-16 right-0 border-t border-white/10 opacity-50"
            style={{ top: `${index * effectiveHourHeight + effectiveHourHeight / 2}px` }}
          />
        ))}
      </div>
      {/* Current time indicator */}
      <motion.div
        layoutId="current-time-line"
        className="absolute left-0 right-0 z-20 pointer-events-none"
        style={{
          top: `${(currentHour - startHour) * effectiveHourHeight + effectiveHourHeight / 2}px`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative">
          {/* Main time line */}
          <div className="absolute left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-lg shadow-blue-500/30" />
          {/* Time indicator dot */}
          <motion.div
            className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-50 dark:border-slate-950 shadow-lg shadow-blue-500/30"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [1, 0.9, 1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          {/* Current time label */}
          <div className="absolute left-4 -translate-y-1/2 bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-lg">
            {format(new Date(), "HH:mm")}
          </div>
        </div>
      </motion.div>

      {/* Hours timeline */}
      <div
        className="relative"
        style={{
          height: `${hours.length * effectiveHourHeight}px`,
          minHeight: `${hours.length * effectiveHourHeight}px`
        }}
      >
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
            >
              {children && children(hour)}
            </HourSlot>
          </div>
        ))}
      </div>

      {/* Subtle gradient fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent pointer-events-none" />
    </div>
  );
}




