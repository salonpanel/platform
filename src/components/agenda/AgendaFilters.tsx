"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StaffSelector } from "./StaffSelector";
import { Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { Staff } from "@/types/agenda";

interface ActiveFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

interface AgendaFiltersProps {
  staffList: Staff[];
  selectedStaffId: string | null;
  onStaffChange: (staffId: string | null) => void;
  searchOpen: boolean;
  searchTerm: string;
  onSearchToggle: () => void;
  onSearchChange: (term: string) => void;
  onSearchClose: () => void;
  activeFilters: ActiveFilter[];
  onResetFilters: () => void;
  density?: "default" | "compact" | "ultra-compact";
}

/**
 * AgendaFilters - Sistema de filtros inteligente premium
 * Incluye búsqueda, filtros de staff y gestión de filtros activos
 */
export function AgendaFilters({
  staffList,
  selectedStaffId,
  onStaffChange,
  searchOpen,
  searchTerm,
  onSearchToggle,
  onSearchChange,
  onSearchClose,
  activeFilters,
  onResetFilters,
  density = "default",
}: AgendaFiltersProps) {
  const paddingClass = density === "ultra-compact" ? "p-2" : density === "compact" ? "p-3" : "p-4";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0"
    >
      <GlassCard variant="elevated" padding="md" className="w-full">
        <div className="flex flex-col gap-4">
          {/* Barra superior: Búsqueda y acciones rápidas */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {/* Botón de búsqueda inteligente */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSearchToggle}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-lg)] transition-all duration-200",
                  paddingClass,
                  "bg-[var(--glass-bg-subtle)] border border-[var(--glass-border)]",
                  "hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua-border)]",
                  "text-[var(--text-secondary)] hover:text-[var(--accent-aqua)]"
                )}
                aria-label="Buscar reservas"
              >
                <Search className={cn(
                  density === "ultra-compact" ? "h-3 w-3" : "h-4 w-4"
                )} />
                {searchTerm && (
                  <span className="text-xs font-medium">{searchTerm}</span>
                )}
              </motion.button>

              {/* Reset filters */}
              {activeFilters.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onResetFilters}
                  className={cn(
                    "flex items-center gap-2 rounded-[var(--radius-lg)] transition-all duration-200",
                    paddingClass,
                    "bg-[var(--accent-purple-glass)] border border-[var(--accent-purple-border)]",
                    "hover:bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]"
                  )}
                  aria-label="Limpiar todos los filtros"
                >
                  <Filter className={cn(
                    density === "ultra-compact" ? "h-3 w-3" : "h-4 w-4"
                  )} />
                  <span className="text-xs font-medium">Limpiar</span>
                </motion.button>
              )}
            </div>

            {/* Indicador de filtros activos */}
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)] font-medium">
                  {activeFilters.length} filtro{activeFilters.length > 1 ? 's' : ''} activo{activeFilters.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Panel de búsqueda expandido */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 pb-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Buscar por cliente, servicio o staff..."
                      className={cn(
                        "w-full pl-10 pr-4 py-2 rounded-[var(--radius-lg)] transition-all duration-200",
                        "bg-[var(--glass-bg)] border border-[var(--glass-border)]",
                        "focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20",
                        "text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                      )}
                      autoFocus
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSearchClose}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selector de staff */}
          {staffList.length > 0 && (
            <StaffSelector
              staff={staffList}
              selectedStaffId={selectedStaffId}
              onSelect={onStaffChange}
              density={density}
              showUtilization={true}
            />
          )}

          {/* Chips de filtros activos */}
          {activeFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 pt-2 border-t border-[var(--glass-border-subtle)]"
            >
              {activeFilters.map((filter, index) => (
                <motion.div
                  key={filter.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-lg)]",
                    "bg-[var(--glass-bg)] border border-[var(--glass-border)]",
                    "text-xs text-[var(--text-primary)]"
                  )}
                >
                  <span>{filter.label}</span>
                  <button
                    onClick={filter.onRemove}
                    className="hover:bg-[var(--glass-bg-subtle)] rounded-full p-0.5 transition-colors"
                    aria-label={`Remover filtro ${filter.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
