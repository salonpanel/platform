"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHeightAware } from "@/components/panel/HeightAwareContainer";

interface KPIGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Grid de KPIs que se autoajusta según altura disponible
 * - 4 columnas (altura grande > 950px)
 * - 3 columnas (altura media 800-950px)
 * - 2 columnas (altura pequeña < 800px)
 * - 1 columna en móvil estrecho
 */
export function KPIGrid({ children, className }: KPIGridProps) {
  const heightAware = useHeightAware();

  // Grid según altura
  // normal (>950px): 4 columnas desktop, 3 si no hay suficiente ancho
  // compact (750-950px): 3 columnas
  // ultra-compact (<=750px): 2 columnas
  const gridCols = heightAware.isLarge 
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
    : heightAware.isMedium 
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2";

  // Gaps según densidad
  const gaps = heightAware.density === "ultra-compact" 
    ? "gap-2" 
    : heightAware.density === "compact" 
    ? "gap-3" 
    : "gap-4";

  return (
    <div className={cn("grid", gridCols, gaps, className)}>
      {children}
    </div>
  );
}

