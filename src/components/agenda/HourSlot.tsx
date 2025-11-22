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
        "flex gap-4 border-b transition-all duration-200",
        isCurrentHour 
          ? "border-[var(--accent-aqua)]/30 bg-[var(--accent-aqua)]/5" 
          : "border-[var(--glass-border-subtle)] hover:border-[var(--glass-border)]/50",
        paddingClass,
        className
      )}
    >
      {/* Etiqueta de hora */}
      <div className="relative">
        <div
          className={cn(
            "font-mono font-semibold flex-shrink-0 text-right w-14 transition-colors duration-200",
            textSize,
            isCurrentHour 
              ? "text-[var(--accent-aqua)]" 
              : "text-[var(--text-tertiary)]"
          )}
          style={{
            fontFamily: "var(--font-mono)",
          }}
        >
          {hourLabel}
        </div>
        
        {/* Indicador de hora actual */}
        {isCurrentHour && (
          <motion.div
            layoutId="current-hour-indicator"
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent-aqua)] shadow-lg shadow-[var(--accent-aqua)]/50"
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
      
      {/* Contenido de la hora */}
      <div className="flex-1 min-h-0 relative">
        {/* Línea de tiempo sutil */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent" />
        
        {/* Contenido dinámico */}
        <div className="relative z-10">
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute -top-2 -right-2 text-xs bg-red-500 text-white px-1 rounded">
              {hour}h
            </div>
          )}
          {children ? (
            <div>
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs bg-green-500 text-white px-1 rounded mb-1">
                  Has children
                </div>
              )}
              {children}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[40px]">
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs bg-yellow-500 text-white px-1 rounded">
                  No children
                </div>
              )}
              <div className="w-full h-px bg-[var(--glass-border-subtle)]/50" />
            </div>
          )}
        </div>
        
        {/* Efecto de brillo sutil */}
        {isCurrentHour && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--accent-aqua)]/10 to-transparent pointer-events-none"
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




