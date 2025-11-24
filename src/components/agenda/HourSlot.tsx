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
  const paddingClass = density === "ultra-compact" ? "py-2" : density === "compact" ? "py-3" : "py-4";
  const textSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: hour * 0.01 }}
      className={cn(
        "flex gap-4 border-b transition-all duration-200 relative",
        isCurrentHour
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300/70 dark:hover:border-slate-600/70",
        className
      )}
      style={{ paddingTop: paddingClass === "py-2" ? "8px" : paddingClass === "py-3" ? "12px" : "16px" }}
    >
      {/* Hour label */}
      <div className="relative flex-shrink-0 w-16">
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

        {/* Current hour indicator */}
        {isCurrentHour && (
          <motion.div
            layoutId="current-hour-indicator"
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"
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
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {/* Subtle horizontal grid line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200/30 dark:via-slate-700/30 to-transparent" />

        {/* Content */}
        <div className="relative z-10">
          {children ? (
            <div>
              {children}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[40px]">
              <div className="w-full h-px bg-slate-200/20 dark:bg-slate-700/20" />
            </div>
          )}
        </div>

        {/* Current hour highlight effect */}
        {isCurrentHour && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent pointer-events-none"
            animate={{
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </div>
    </motion.div>
  );
}




