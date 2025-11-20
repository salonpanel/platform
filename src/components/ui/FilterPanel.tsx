"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export interface FilterChip {
  id: string;
  label: string;
  onRemove?: () => void;
}

export interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  activeFilters?: FilterChip[];
  onClearAll?: () => void;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function FilterPanel({
  title,
  children,
  activeFilters = [],
  onClearAll,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: FilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "rounded-[var(--radius-lg)] glass border-[var(--glass-border)] p-4",
        className
      )}
    >
      {(title || activeFilters.length > 0) && (
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h3
              className="text-sm font-semibold text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {title}
            </h3>
          )}
          {activeFilters.length > 0 && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              style={{
                fontFamily: "var(--font-body)",
                transitionDuration: "var(--duration-base)",
              }}
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}

      {/* Active filters chips */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <motion.div
              key={filter.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] glass border-[var(--glass-border)] px-3 py-1.5"
            >
              <span
                className="text-xs text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {filter.label}
              </span>
              {filter.onRemove && (
                <button
                  onClick={filter.onRemove}
                  className="p-0.5 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-all"
                  style={{ transitionDuration: "var(--duration-base)" }}
                  aria-label="Eliminar filtro"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Filter content */}
      <div className={cn(collapsible && isCollapsed && "hidden")}>
        {children}
      </div>
    </motion.div>
  );
}

/**
 * ============================================================================
 * FILTERPANEL COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Panel de filtros en servicios
 * - Panel de filtros en clientes
 * - Cualquier sección de filtros reutilizable
 * 
 * PROPS PRINCIPALES:
 * - title: string - Título del panel
 * - children: ReactNode - Contenido del panel (inputs, selects, etc.)
 * - activeFilters: FilterChip[] - Chips de filtros activos
 * - onClearAll: () => void - Callback para limpiar todos los filtros
 * - collapsible: boolean - Permitir colapsar el panel
 * - defaultCollapsed: boolean - Estado inicial colapsado
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * const [filters, setFilters] = useState({
 *   status: "all",
 *   category: "all",
 * });
 * 
 * const activeFilters = [
 *   { id: "status", label: `Estado: ${filters.status}`, onRemove: () => setFilters({ ...filters, status: "all" }) },
 *   { id: "category", label: `Categoría: ${filters.category}`, onRemove: () => setFilters({ ...filters, category: "all" }) },
 * ];
 * 
 * <FilterPanel
 *   title="Filtros"
 *   activeFilters={activeFilters}
 *   onClearAll={() => setFilters({ status: "all", category: "all" })}
 * >
 *   <Select
 *     value={filters.status}
 *     onChange={(e) => setFilters({ ...filters, status: e.target.value })}
 *     label="Estado"
 *   >
 *     <option value="all">Todos</option>
 *     <option value="active">Activos</option>
 *   </Select>
 * </FilterPanel>
 * ```
 */

