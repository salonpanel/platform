"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays } from "lucide-react";
import { format, isToday, addDays, subDays } from "date-fns";

interface DaySwitcherProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  showTodayButton?: boolean;
}

/**
 * Componente premium para cambiar de día en la agenda
 * Con navegación suave, botón "Hoy" y diseño glassmórfico
 */
export function DaySwitcher({
  selectedDate,
  onDateChange,
  density = "default",
  className,
  showTodayButton = true,
}: DaySwitcherProps) {
  const goToPreviousDay = () => {
    onDateChange(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  // Formatear fecha en español
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dayName = days[selectedDate.getDay()];
  const monthName = months[selectedDate.getMonth()];
  const formattedDate = `${dayName}, ${selectedDate.getDate()} de ${monthName}`;
  const isCurrentDay = isToday(selectedDate);

  const buttonSize = density === "ultra-compact" ? "h-8 w-8" : density === "compact" ? "h-9 w-9" : "h-10 w-10";
  const textSize = density === "ultra-compact" ? "text-sm" : density === "compact" ? "text-base" : "text-lg";
  const iconSize = density === "ultra-compact" ? "h-4 w-4" : density === "compact" ? "h-4.5 w-4.5" : "h-5 w-5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-center gap-2", className)}
    >
      {/* Botón anterior */}
      <motion.button
        whileHover={{ scale: 1.1, x: -2 }}
        whileTap={{ scale: 0.9 }}
        onClick={goToPreviousDay}
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200",
          "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-secondary)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua-border)] hover:shadow-lg hover:shadow-[var(--accent-aqua)]/20",
          buttonSize
        )}
        aria-label="Día anterior"
      >
        <ChevronLeft className={iconSize} />
      </motion.button>

      {/* Fecha actual */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={goToToday}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200",
          isCurrentDay
            ? "bg-gradient-to-r from-[var(--accent-aqua)]/20 to-[var(--accent-blue)]/20 border-[var(--accent-aqua)]/50 text-[var(--accent-aqua)] shadow-lg shadow-[var(--accent-aqua)]/20"
            : "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-bg)] hover:shadow-lg",
          density === "ultra-compact" ? "px-3 py-2" : "px-4 py-2.5"
        )}
        style={{
          background: isCurrentDay 
            ? "linear-gradient(135deg, rgba(79, 227, 193, 0.1) 0%, rgba(58, 109, 255, 0.1) 100%)"
            : undefined
        }}
      >
        <Calendar className={cn(iconSize, isCurrentDay ? "text-[var(--accent-aqua)]" : "text-[var(--text-secondary)]")} />
        <div className="text-left">
          <div
            className={cn(
              "font-semibold capitalize",
              textSize
            )}
            style={{
              fontFamily: "var(--font-heading)",
              color: isCurrentDay ? "var(--accent-aqua)" : "var(--text-primary)"
            }}
          >
            {formattedDate}
          </div>
          {isCurrentDay && (
            <div className={cn(
              "text-xs font-medium opacity-80",
              "flex items-center gap-1"
            )} style={{ color: "var(--accent-aqua)" }}>
              <CalendarDays className={cn("h-3 w-3", density === "ultra-compact" ? "h-2.5 w-2.5" : "h-3 w-3")} />
              Hoy
            </div>
          )}
        </div>
      </motion.button>

      {/* Botón siguiente */}
      <motion.button
        whileHover={{ scale: 1.1, x: 2 }}
        whileTap={{ scale: 0.9 }}
        onClick={goToNextDay}
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200",
          "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-secondary)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua-border)] hover:shadow-lg hover:shadow-[var(--accent-aqua)]/20",
          buttonSize
        )}
        aria-label="Día siguiente"
      >
        <ChevronRight className={iconSize} />
      </motion.button>

      {/* Botón "Hoy" separado */}
      {showTodayButton && !isCurrentDay && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={goToToday}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] border backdrop-blur-sm transition-all duration-200",
            "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/25 text-[var(--accent-blue)]",
            "hover:bg-[var(--accent-blue)]/20 hover:border-[var(--accent-blue)]/40 hover:shadow-lg hover:shadow-[var(--accent-blue)]/20",
            density === "ultra-compact" ? "px-2 py-1.5" : "px-3 py-2"
          )}
        >
          <CalendarDays className={cn(
            density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4"
          )} />
          <span className={cn(
            "font-semibold text-sm",
            density === "ultra-compact" ? "text-xs" : "text-sm"
          )} style={{ fontFamily: "var(--font-heading)" }}>
            Hoy
          </span>
        </motion.button>
      )}
    </motion.div>
  );
}

