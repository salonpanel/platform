"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HourSlot } from "./HourSlot";

interface TimelineProps {
  startHour?: number;
  endHour?: number;
  children?: (hour: number) => ReactNode;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  hourHeight?: number;
}

/**
 * Componente Timeline para mostrar horas del día
 * Calcula altura dinámica según densidad y altura disponible
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

  // Altura por hora según densidad (si no se proporciona)
  const defaultHourHeight = density === "ultra-compact" ? 48 : density === "compact" ? 64 : 80;
  const effectiveHourHeight = hourHeight || defaultHourHeight;

  return (
    <div className={cn("flex flex-col", className)}>
      {hours.map((hour) => (
        <div
          key={hour}
          style={{ minHeight: `${effectiveHourHeight}px` }}
          className="relative"
        >
          <HourSlot hour={hour} density={density}>
            {children && children(hour)}
          </HourSlot>
        </div>
      ))}
    </div>
  );
}




