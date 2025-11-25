"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface HourSlotProps {
  hour: number;
  children?: ReactNode;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  isCurrentHour?: boolean;
}

/**
 * Componente premium para representar una hora en el timeline de la agenda
 * Con indicador visual de hora actual y diseño glassmórfico
 */
export function HourSlot({ hour, children, density = "default", className, isCurrentHour = false }: HourSlotProps) {
  const hourLabel = format(new Date().setHours(hour, 0, 0, 0), "HH:mm");
  const paddingClass = density === "ultra-compact" ? "py-2" : density === "compact" ? "py-3" : "py-3.5";
  const textSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: hour * 0.01 }}
      className={cn(
        "flex gap-4 items-start transition-all duration-200 relative h-full",
        paddingClass,
        className,
      )}
    >
      {/* Hour label */}
      <div className="relative flex-shrink-0 w-16 pt-0.5">
        <div
          className={cn(
            "font-mono font-semibold text-right transition-colors duration-200",
            isCurrentHour
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400",
            textSize
          )}
        >
          {hourLabel}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        <div className="relative z-10 h-full">
          {children}
        </div>
        {isCurrentHour && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent pointer-events-none"
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </motion.div>
  );
}




