"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";

interface DaySwitcherProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
}

/**
 * Componente para cambiar de día en la agenda
 * Navegación con botones anterior/siguiente y selector de fecha
 */
export function DaySwitcher({
  selectedDate,
  onDateChange,
  density = "default",
  className,
}: DaySwitcherProps) {
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  // Formatear fecha en español manualmente
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dayName = days[selectedDate.getDay()];
  const monthName = months[selectedDate.getMonth()];
  const formattedDate = `${dayName}, ${selectedDate.getDate()} de ${monthName}`;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  const buttonSize = density === "ultra-compact" ? "h-7 w-7" : density === "compact" ? "h-8 w-8" : "h-9 w-9";
  const textSize = density === "ultra-compact" ? "text-sm" : density === "compact" ? "text-base" : "text-lg";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Botón anterior */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={goToPreviousDay}
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua-border)] transition-all",
          buttonSize
        )}
        style={{
          transitionDuration: "var(--duration-base)",
        }}
        aria-label="Día anterior"
      >
        <ChevronLeft className={cn(density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </motion.button>

      {/* Fecha actual */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={goToToday}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border transition-all",
          isToday
            ? "bg-[var(--accent-aqua-glass)] border-[var(--accent-aqua-border)] text-[var(--accent-aqua)]"
            : "bg-[var(--glass-bg-subtle)] border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-bg)]",
          density === "ultra-compact" ? "px-2 py-1" : "px-3 py-2"
        )}
        style={{
          transitionDuration: "var(--duration-base)",
        }}
      >
        <Calendar className={cn(density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span
          className={cn(
            "font-semibold font-satoshi capitalize",
            textSize
          )}
          style={{
            fontFamily: "var(--font-heading)",
          }}
        >
          {formattedDate}
        </span>
      </motion.button>

      {/* Botón siguiente */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={goToNextDay}
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua-border)] transition-all",
          buttonSize
        )}
        style={{
          transitionDuration: "var(--duration-base)",
        }}
        aria-label="Día siguiente"
      >
        <ChevronRight className={cn(density === "ultra-compact" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </motion.button>
    </div>
  );
}

