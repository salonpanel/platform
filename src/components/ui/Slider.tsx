"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface SliderProps {
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  showValue?: boolean;
  variant?: "single" | "range";
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      className,
      label,
      showValue = true,
      variant = "single",
    },
    ref
  ) => {
    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const getPercentage = useCallback(
      (val: number) => {
        return ((val - min) / (max - min)) * 100;
      },
      [min, max]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent, index?: number) => {
        if (disabled) return;
        setIsDragging(true);

        const handleMouseMove = (moveEvent: MouseEvent) => {
          if (!sliderRef.current) return;

          const rect = sliderRef.current.getBoundingClientRect();
          const x = moveEvent.clientX - rect.left;
          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const newValue = min + (percentage / 100) * (max - min);
          const steppedValue = Math.round(newValue / step) * step;
          const clampedValue = Math.max(min, Math.min(max, steppedValue));

          if (variant === "range" && Array.isArray(localValue)) {
            const [start, end] = localValue;
            if (index === 0) {
              const newRange: [number, number] = [Math.min(clampedValue, end), end];
              setLocalValue(newRange);
              onChange(newRange);
            } else {
              const newRange: [number, number] = [start, Math.max(clampedValue, start)];
              setLocalValue(newRange);
              onChange(newRange);
            }
          } else {
            setLocalValue(clampedValue);
            onChange(clampedValue);
          }
        };

        const handleMouseUp = () => {
          setIsDragging(false);
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      },
      [disabled, min, max, step, variant, localValue, onChange]
    );

    const handleTouchStart = useCallback(
      (e: React.TouchEvent, index?: number) => {
        if (disabled) return;
        setIsDragging(true);

        const handleTouchMove = (moveEvent: TouchEvent) => {
          if (!sliderRef.current) return;

          const rect = sliderRef.current.getBoundingClientRect();
          const touch = moveEvent.touches[0];
          const x = touch.clientX - rect.left;
          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const newValue = min + (percentage / 100) * (max - min);
          const steppedValue = Math.round(newValue / step) * step;
          const clampedValue = Math.max(min, Math.min(max, steppedValue));

          if (variant === "range" && Array.isArray(localValue)) {
            const [start, end] = localValue;
            if (index === 0) {
              const newRange: [number, number] = [Math.min(clampedValue, end), end];
              setLocalValue(newRange);
              onChange(newRange);
            } else {
              const newRange: [number, number] = [start, Math.max(clampedValue, start)];
              setLocalValue(newRange);
              onChange(newRange);
            }
          } else {
            setLocalValue(clampedValue);
            onChange(clampedValue);
          }
        };

        const handleTouchEnd = () => {
          setIsDragging(false);
          document.removeEventListener("touchmove", handleTouchMove);
          document.removeEventListener("touchend", handleTouchEnd);
        };

        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleTouchEnd);
      },
      [disabled, min, max, step, variant, localValue, onChange]
    );

    const startValue = variant === "range" && Array.isArray(localValue) ? localValue[0] : (localValue as number);
    const endValue = variant === "range" && Array.isArray(localValue) ? localValue[1] : undefined;

    return (
      <div ref={ref} className={cn("w-full", className)}>
        {label && (
          <label
            className="mb-2 block text-sm font-semibold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <div
            ref={sliderRef}
            className={cn(
              "relative h-2 w-full rounded-[var(--radius-pill)] glass cursor-pointer",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{
              background: `linear-gradient(to right, 
                var(--accent-aqua-glass) 0%, 
                var(--accent-aqua-glass) ${getPercentage(startValue)}%, 
                var(--glass-bg) ${getPercentage(startValue)}%, 
                var(--glass-bg) ${endValue ? getPercentage(endValue) : 100}%, 
                var(--glass-bg) 100%)`,
            }}
          >
            {/* Track fill */}
            {variant === "range" && endValue && (
              <div
                className="absolute h-full rounded-[var(--radius-pill)] bg-[var(--accent-aqua-glass)]"
                style={{
                  left: `${getPercentage(startValue)}%`,
                  width: `${getPercentage(endValue) - getPercentage(startValue)}%`,
                }}
              />
            )}

            {/* Single thumb */}
            {variant === "single" && (
              <motion.div
                className="absolute top-1/2 h-5 w-5 -translate-y-1/2 cursor-grab active:cursor-grabbing rounded-[var(--radius-pill)] bg-[var(--gradient-primary)] border-2 border-[var(--accent-aqua-border)] shadow-[var(--glow-border-aqua)]"
                style={{
                  left: `calc(${getPercentage(startValue)}% - 10px)`,
                }}
                onMouseDown={(e) => handleMouseDown(e)}
                onTouchStart={(e) => handleTouchStart(e)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              />
            )}

            {/* Range thumbs */}
            {variant === "range" && endValue && (
              <>
                <motion.div
                  className="absolute top-1/2 h-5 w-5 -translate-y-1/2 cursor-grab active:cursor-grabbing rounded-[var(--radius-pill)] bg-[var(--gradient-primary)] border-2 border-[var(--accent-aqua-border)] shadow-[var(--glow-border-aqua)]"
                  style={{
                    left: `calc(${getPercentage(startValue)}% - 10px)`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 0)}
                  onTouchStart={(e) => handleTouchStart(e, 0)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                />
                <motion.div
                  className="absolute top-1/2 h-5 w-5 -translate-y-1/2 cursor-grab active:cursor-grabbing rounded-[var(--radius-pill)] bg-[var(--gradient-primary)] border-2 border-[var(--accent-aqua-border)] shadow-[var(--glow-border-aqua)]"
                  style={{
                    left: `calc(${getPercentage(endValue)}% - 10px)`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 1)}
                  onTouchStart={(e) => handleTouchStart(e, 1)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                />
              </>
            )}
          </div>

          {/* Value display */}
          {showValue && (
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span style={{ fontFamily: "var(--font-body)" }}>
                {variant === "range" && Array.isArray(localValue)
                  ? `${localValue[0]} - ${localValue[1]}`
                  : localValue}
              </span>
              <div className="flex gap-2">
                <span style={{ fontFamily: "var(--font-body)" }}>{min}</span>
                <span style={{ fontFamily: "var(--font-body)" }}>{max}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Slider.displayName = "Slider";

/**
 * ============================================================================
 * SLIDER / RANGE COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Filtros de precio en servicios
 * - Filtros de duración
 * - Cualquier rango numérico que necesite selección visual
 * 
 * PROPS PRINCIPALES:
 * - value: number | [number, number] - Valor actual (single o range)
 * - onChange: (value) => void - Callback cuando cambia el valor
 * - min/max: Límites del slider
 * - step: Incremento (default: 1)
 * - variant: "single" | "range" - Tipo de slider
 * - showValue: boolean - Mostrar valores actuales
 * - disabled: boolean - Deshabilitar interacción
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * // Single slider
 * <Slider
 *   value={price}
 *   onChange={setPrice}
 *   min={0}
 *   max={200}
 *   step={5}
 *   label="Precio máximo (€)"
 *   showValue
 * />
 * 
 * // Range slider
 * <Slider
 *   value={[minPrice, maxPrice]}
 *   onChange={([min, max]) => {
 *     setMinPrice(min);
 *     setMaxPrice(max);
 *   }}
 *   min={0}
 *   max={200}
 *   variant="range"
 *   label="Rango de precio"
 * />
 * ```
 */

