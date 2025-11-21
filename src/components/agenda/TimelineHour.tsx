"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TimelineHourProps {
  hour: number;
  children?: ReactNode;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
}

/**
 * Componente para cada hora en el timeline
 * Tipografía compacta, líneas menos gruesas
 */
export function TimelineHour({
  hour,
  children,
  density = "default",
  className,
}: TimelineHourProps) {
  const hourHeight = {
    default: "min-h-[80px]",
    compact: "min-h-[60px]",
    "ultra-compact": "min-h-[45px]",
  };

  const textStyles = {
    default: "text-xs",
    compact: "text-[10px]",
    "ultra-compact": "text-[9px]",
  };

  const formatHour = (h: number) => {
    return `${h.toString().padStart(2, "0")}:00`;
  };

  return (
    <div
      className={cn(
        "flex border-b border-[var(--glass-border)]/30",
        hourHeight[density],
        className
      )}
    >
      {/* Hora label */}
      <div
        className={cn(
          "flex-shrink-0 w-16 px-2 flex items-start pt-1",
          textStyles[density]
        )}
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--text-tertiary)",
        }}
      >
        {formatHour(hour)}
      </div>

      {/* Contenido (bookings) */}
      <div className="flex-1 min-w-0 py-1">
        {children}
      </div>
    </div>
  );
}




