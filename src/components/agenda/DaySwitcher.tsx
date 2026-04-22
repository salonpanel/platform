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
          "flex items-center justify-center rounded-[var(--r-lg)] border transition-all duration-200",
          "bg-[var(--bf-bg-elev)] border-[var(--bf-border)] text-[var(--bf-ink-400)]",
          "hover:text-[var(--bf-primary)] hover:bg-[rgba(79,161,216,0.10)] hover:border-[rgba(79,161,216,0.30)]",
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
          "flex items-center gap-3 px-4 py-2.5 rounded-[var(--r-lg)] border transition-all duration-200",
          isCurrentDay
            ? "bg-[rgba(79,161,216,0.10)] border-[rgba(79,161,216,0.35)] text-[var(--bf-primary)]"
            : "bg-[var(--bf-bg-elev)] border-[var(--bf-border)] text-[var(--bf-ink-50)] hover:bg-[var(--bf-surface)]",
          density === "ultra-compact" ? "px-3 py-2" : "px-4 py-2.5"
        )}
      >
        <Calendar className={cn(iconSize, isCurrentDay ? "text-[var(--bf-primary)]" : "text-[var(--bf-ink-400)]")} />
        <div className="text-left">
          <div
            className={cn(
              "font-semibold capitalize",
              textSize
            )}
            style={{
              fontFamily: "var(--font-sans)",
              color: isCurrentDay ? "var(--bf-primary)" : "var(--bf-ink-50)"
            }}
          >
            {formattedDate}
          </div>
          {isCurrentDay && (
            <div className={cn(
              "text-xs font-medium opacity-80",
              "flex items-center gap-1"
            )} style={{ color: "var(--bf-primary)" }}>
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
          "flex items-center justify-center rounded-[var(--r-lg)] border transition-all duration-200",
          "bg-[var(--bf-bg-elev)] border-[var(--bf-border)] text-[var(--bf-ink-400)]",
          "hover:text-[var(--bf-primary)] hover:bg-[rgba(79,161,216,0.10)] hover:border-[rgba(79,161,216,0.30)]",
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
            "flex items-center gap-2 px-3 py-2 rounded-[var(--r-lg)] border transition-all duration-200",
            "bg-[var(--bf-primary)] border-transparent text-[var(--bf-ink)]",
            "hover:bg-[var(--bf-cyan-300)]",
            density === "ultra-compact" ? "px-2 py-1.5" : "px-3 py-2"
          )}
        >
          <CalendarDays className={cn(
            density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4"
          )} />
          <span className={cn(
            "font-semibold text-sm",
            density === "ultra-compact" ? "text-xs" : "text-sm"
          )} style={{ fontFamily: "var(--font-sans)" }}>
            Hoy
          </span>
        </motion.button>
      )}
    </motion.div>
  );
}

