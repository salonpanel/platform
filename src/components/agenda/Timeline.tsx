"use client";

import { ReactNode, useMemo } from "react";
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
      {/* Línea de tiempo actual */}
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
          <div className="absolute left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[var(--accent-aqua)] to-transparent shadow-lg shadow-[var(--accent-aqua)]/50" />
          <motion.div
            className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[var(--accent-aqua)] border-2 border-[var(--bg-primary)] shadow-lg shadow-[var(--accent-aqua)]/50"
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
        </div>
      </motion.div>
      
      {/* Horas del timeline */}
      <div 
        className="relative"
        style={{ 
          height: `${hours.length * effectiveHourHeight}px`, // Altura total fija
          minHeight: `${hours.length * effectiveHourHeight}px`
        }}
      >
        {hours.map((hour, index) => (
          <div
            key={hour}
            style={{ 
              height: `${effectiveHourHeight}px`, // Altura fija por hora
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
      
      {/* Efecto degradado sutil al final */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/50 to-transparent pointer-events-none" />
    </div>
  );
}




