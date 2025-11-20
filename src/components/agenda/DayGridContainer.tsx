"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHeightAware } from "@/components/panel/HeightAwareContainer";

interface DayGridContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor para el grid del día en Agenda
 * Calcula altura dinámicamente para que todas las horas quepan sin scroll
 * Permite solo scroll interno dentro del timeline
 */
export function DayGridContainer({ children, className }: DayGridContainerProps) {
  const heightAware = useHeightAware();

  // Calcular altura por hora dinámicamente
  // Objetivo: que todas las horas (24) quepan en la altura disponible
  const availableHeight = heightAware.height - 200; // Restar header, topbar, etc.
  const hourHeight = Math.max(
    heightAware.density === "ultra-compact" ? 35 : heightAware.density === "compact" ? 50 : 70,
    Math.floor(availableHeight / 24)
  );

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-lg)] border glass border-[var(--glass-border)]",
        className
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        maxHeight: `${availableHeight}px`,
      }}
    >
      {/* Header sticky */}
      <div className="flex-shrink-0 border-b border-[var(--glass-border)]/30 p-3">
        <h3
          className="text-sm font-semibold"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
          }}
        >
          Timeline del día
        </h3>
      </div>

      {/* Timeline scrollable interno */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div
          style={{
            minHeight: `${hourHeight * 24}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}


