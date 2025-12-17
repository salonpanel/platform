"use client";

import { forwardRef, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "./Input";

export interface TimePickerProps {
  value?: string; // Format: "HH:mm"
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  step?: number; // Minutes step (default: 15)
}

export const TimePicker = forwardRef<HTMLDivElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      label,
      placeholder = "00:00",
      disabled = false,
      className,
      error,
      step = 15,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hours, setHours] = useState(value ? parseInt(value.split(":")[0]) : 0);
    const [minutes, setMinutes] = useState(value ? parseInt(value.split(":")[1]) : 0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (value) {
        const [h, m] = value.split(":").map(Number);
        setHours(h);
        setMinutes(m);
      }
    }, [value]);

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

    const formatTime = (h: number, m: number) => {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const handleTimeChange = (newHours: number, newMinutes: number) => {
      setHours(newHours);
      setMinutes(newMinutes);
      onChange(formatTime(newHours, newMinutes));
    };

    const incrementHour = () => {
      const newHours = (hours + 1) % 24;
      handleTimeChange(newHours, minutes);
    };

    const decrementHour = () => {
      const newHours = hours === 0 ? 23 : hours - 1;
      handleTimeChange(newHours, minutes);
    };

    const incrementMinute = () => {
      const newMinutes = Math.min(59, Math.ceil(minutes / step) * step + step);
      handleTimeChange(hours, newMinutes >= 60 ? 0 : newMinutes);
    };

    const decrementMinute = () => {
      const newMinutes = Math.max(0, Math.floor(minutes / step) * step - step);
      handleTimeChange(hours, newMinutes < 0 ? 59 : newMinutes);
    };

    const hourOptions = Array.from({ length: 24 }, (_, i) => i);
    const minuteOptions = Array.from({ length: 60 / step }, (_, i) => i * step);

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        <div ref={containerRef} className="relative">
          <Input
            label={label}
            value={value || ""}
            placeholder={placeholder}
            disabled={disabled}
            error={error}
            readOnly
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="cursor-pointer"
            icon={<Clock className="h-4 w-4 text-[var(--text-secondary)]" />}
          />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
              className="absolute z-50 mt-2 w-full rounded-[var(--radius-xl)] glass-strong border-[var(--glass-border-strong)] shadow-[var(--shadow-modal)] p-4"
            >
              <div className="flex items-center justify-center gap-4">
                {/* Hours */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={incrementHour}
                    disabled={disabled}
                    className="p-2 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-all mb-2"
                    style={{ transitionDuration: "var(--duration-base)" }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <div className="glass rounded-[var(--radius-md)] px-4 py-3 min-w-[60px] text-center">
                    <span
                      className="text-2xl font-semibold text-[var(--text-primary)]"
                      style={{ fontFamily: "var(--font-kpi)" }}
                    >
                      {String(hours).padStart(2, "0")}
                    </span>
                  </div>
                  <button
                    onClick={decrementHour}
                    disabled={disabled}
                    className="p-2 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-all mt-2"
                    style={{ transitionDuration: "var(--duration-base)" }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <span
                  className="text-xl font-semibold text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  :
                </span>

                {/* Minutes */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={incrementMinute}
                    disabled={disabled}
                    className="p-2 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-all mb-2"
                    style={{ transitionDuration: "var(--duration-base)" }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <div className="glass rounded-[var(--radius-md)] px-4 py-3 min-w-[60px] text-center">
                    <span
                      className="text-2xl font-semibold text-[var(--text-primary)]"
                      style={{ fontFamily: "var(--font-kpi)" }}
                    >
                      {String(minutes).padStart(2, "0")}
                    </span>
                  </div>
                  <button
                    onClick={decrementMinute}
                    disabled={disabled}
                    className="p-2 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-all mt-2"
                    style={{ transitionDuration: "var(--duration-base)" }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Quick time buttons */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--glass-border-subtle)] pt-4">
                {["09:00", "12:00", "15:00", "18:00"].map((time) => {
                  const [h, m] = time.split(":").map(Number);
                  return (
                    <button
                      key={time}
                      onClick={() => {
                        handleTimeChange(h, m);
                        setIsOpen(false);
                      }}
                      className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-pill)] glass hover:bg-[var(--accent-aqua-glass)] transition-all"
                      style={{
                        fontFamily: "var(--font-body)",
                        transitionDuration: "var(--duration-base)",
                      }}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>

              {/* Close button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--text-primary)] rounded-[var(--radius-sm)] bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg)] transition-all"
                  style={{
                    fontFamily: "var(--font-body)",
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

TimePicker.displayName = "TimePicker";

/**
 * ============================================================================
 * TIMEPICKER COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Selección de hora en formularios de reservas
 * - Filtros de hora en agenda
 * - Cualquier input que requiera selección de hora
 * 
 * PROPS PRINCIPALES:
 * - value: string - Hora en formato "HH:mm"
 * - onChange: (time: string) => void - Callback cuando cambia la hora
 * - label: string - Etiqueta del campo
 * - placeholder: string - Texto placeholder
 * - step: number - Incremento de minutos (default: 15)
 * - disabled: boolean - Deshabilitar el picker
 * - error: string - Mensaje de error
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * const [time, setTime] = useState("09:00");
 * 
 * <TimePicker
 *   value={time}
 *   onChange={setTime}
 *   label="Hora de inicio"
 *   placeholder="Selecciona una hora"
 *   step={15}
 * />
 * ```
 */

