"use client";

import { useMemo } from "react";
import { format, parseISO, startOfWeek, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface AgendaDayStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  timezone?: string;
}

export function AgendaDayStrip({ selectedDate, onDateSelect, timezone }: AgendaDayStripProps) {
  const selectedDateObj = parseISO(selectedDate);
  const today = new Date();

  // Generar 7 días empezando desde el lunes de la semana actual
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDateObj, { weekStartsOn: 1 }); // Lunes
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayName: format(date, "EEE").charAt(0).toUpperCase() + format(date, "EEE").slice(1).toLowerCase(),
        dayNumber: format(date, "d"),
        isToday: isSameDay(date, today),
        isSelected: isSameDay(date, selectedDateObj),
      };
    });
  }, [selectedDateObj, today]);

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
      {weekDays.map((day) => (
        <button
          key={day.dateStr}
          onClick={() => onDateSelect(day.dateStr)}
          className={cn(
            "flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200",
            "min-w-[60px]",
            day.isSelected
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : day.isToday
              ? "bg-gray-100 text-gray-900 font-semibold"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <span className="text-xs font-medium">{day.dayName}</span>
          <span className={cn(
            "text-lg font-semibold mt-1",
            day.isSelected ? "text-white" : day.isToday ? "text-[var(--color-accent)]" : "text-gray-700"
          )}>
            {day.dayNumber}
          </span>
        </button>
      ))}
    </div>
  );
}

