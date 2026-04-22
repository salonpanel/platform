"use client";

import { forwardRef, useState, useRef, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "./Input";

export interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  error?: string;
}

export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      placeholder = "Seleccionar fecha",
      disabled = false,
      className,
      minDate,
      maxDate,
      error,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(value ? startOfMonth(value) : startOfMonth(new Date()));
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { locale: es });
    const calendarEnd = endOfWeek(monthEnd, { locale: es });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const handleDateSelect = (date: Date) => {
      onChange(date);
      setIsOpen(false);
    };

    const handlePrevMonth = () => {
      setCurrentMonth(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
      setCurrentMonth(addMonths(currentMonth, 1));
    };

    const isDateDisabled = (date: Date) => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    };

    const weekDays = ["L", "M", "X", "J", "V", "S", "D"];

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        <div ref={containerRef} className="relative">
          <Input
            label={label}
            value={value ? format(value, "dd/MM/yyyy") : ""}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
            readOnly
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="cursor-pointer"
              icon={
              <Calendar className="h-4 w-4 text-[var(--bf-ink-400)]" />
            }
          />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
              className="absolute z-50 mt-2 w-full rounded-[var(--r-xl)] bg-[var(--bf-surface)] border border-[var(--bf-border)] shadow-[var(--bf-shadow-card)] p-4"
            >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-[var(--r-sm)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)] transition-all"
                  style={{ transitionDuration: "var(--duration-base)" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3
                  className="text-sm font-semibold text-[var(--bf-ink-50)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {format(currentMonth, "MMMM yyyy", { locale: es })}
                </h3>
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-[var(--r-sm)] text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)] transition-all"
                  style={{ transitionDuration: "var(--duration-base)" }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Week days */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-semibold text-[var(--bf-ink-400)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = value && isSameDay(day, value);
                  const isTodayDate = isToday(day);
                  const disabled = isDateDisabled(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !disabled && handleDateSelect(day)}
                      disabled={disabled || !isCurrentMonth}
                      className={cn(
                        "relative p-2 text-sm rounded-[var(--r-sm)] transition-all",
                        !isCurrentMonth && "opacity-30",
                        disabled && "opacity-30 cursor-not-allowed",
                        isSelected &&
                          "bg-[var(--bf-primary)] text-[var(--bf-ink)] shadow-[var(--bf-shadow-glow)]",
                        !isSelected &&
                          isCurrentMonth &&
                          !disabled &&
                          "text-[var(--bf-ink-100)] hover:bg-[var(--bf-bg-elev)]",
                        isTodayDate && !isSelected && "ring-1 ring-[rgba(79,161,216,0.4)]"
                      )}
                      style={{
                        fontFamily: "var(--font-sans)",
                        transitionDuration: "var(--duration-base)",
                      }}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--bf-border)] pt-4">
                {value && (
                  <button
                    onClick={() => {
                      onChange(null);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 text-xs text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] rounded-[var(--r-sm)] hover:bg-[var(--bf-bg-elev)] transition-all"
                    style={{
                      fontFamily: "var(--font-sans)",
                      transitionDuration: "var(--duration-base)",
                    }}
                  >
                    Limpiar
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--bf-ink-50)] rounded-[var(--r-sm)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface-2)] transition-all"
                  style={{
                    fontFamily: "var(--font-sans)",
                    transitionDuration: "var(--duration-base)",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";

/**
 * ============================================================================
 * DATEPICKER COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Filtros de fecha en agenda
 * - Selección de fechas en formularios
 * - Cualquier input que requiera selección de fecha
 * 
 * PROPS PRINCIPALES:
 * - value: Date | null - Fecha seleccionada
 * - onChange: (date: Date | null) => void - Callback cuando cambia la fecha
 * - label: string - Etiqueta del campo
 * - placeholder: string - Texto placeholder
 * - minDate/maxDate: Date - Fechas mínima/máxima permitidas
 * - disabled: boolean - Deshabilitar el picker
 * - error: string - Mensaje de error
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
 * 
 * <DatePicker
 *   value={selectedDate}
 *   onChange={setSelectedDate}
 *   label="Fecha de reserva"
 *   placeholder="Selecciona una fecha"
 *   minDate={new Date()}
 * />
 * ```
 */

