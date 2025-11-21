"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface HourSlotProps {
  hour: number;
  children?: ReactNode;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
}

/**
 * Componente para representar una hora en el timeline de la agenda
 */
export function HourSlot({ hour, children, density = "default", className }: HourSlotProps) {
  const hourLabel = format(new Date().setHours(hour, 0, 0, 0), "HH:mm");
  const paddingClass = density === "ultra-compact" ? "py-1" : density === "compact" ? "py-2" : "py-3";
  const textSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";

  return (
    <div className={cn("flex gap-3 border-b border-[var(--glass-border-subtle)]", paddingClass, className)}>
      <div
        className={cn(
          "font-mono font-semibold flex-shrink-0 w-12 text-right",
          textSize
        )}
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)",
        }}
      >
        {hourLabel}
      </div>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}




