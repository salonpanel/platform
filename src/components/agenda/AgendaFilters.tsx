"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StaffSelector } from "./StaffSelector";
import { Search, X, Filter } from "lucide-react";
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
 * AgendaFilters - Compact staff filter bar
 * Search is triggered from TopBar, expands here when active
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0"
    >
      <div className="flex flex-col gap-3">
        {/* Search panel - only visible when triggered from TopBar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Buscar por cliente, servicio o staff..."
                    className={cn(
                      "w-full pl-10 pr-4 py-2.5 rounded-xl transition-all duration-200",
                      "bg-white/5 border border-white/10",
                      "focus:border-[#4FE3C1]/50 focus:ring-2 focus:ring-[#4FE3C1]/20",
                      "text-white placeholder-white/40 text-sm"
                    )}
                    autoFocus
                  />
                </div>
                <button
                  onClick={onSearchClose}
                  className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                  aria-label="Cerrar búsqueda"
                >
                  <X className="h-4 w-4 text-white/70" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Staff selector row */}
        <div className="flex items-center justify-between gap-3">
          {/* Staff selector chips */}
          {staffList.length > 0 && (
            <div className="flex-1 min-w-0">
              <StaffSelector
                staff={staffList}
                selectedStaffId={selectedStaffId}
                onSelect={onStaffChange}
                density="compact"
                showUtilization={false}
              />
            </div>
          )}

          {/* Reset filters button */}
          {activeFilters.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onResetFilters}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200",
                "bg-white/5 border border-white/10",
                "hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium"
              )}
              aria-label="Limpiar filtros"
            >
              <Filter className="h-3 w-3" />
              <span>Limpiar</span>
            </motion.button>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap gap-2"
          >
            {activeFilters.map((filter, index) => (
              <motion.div
                key={filter.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                  "bg-[#4FE3C1]/10 border border-[#4FE3C1]/30",
                  "text-xs text-[#4FE3C1]"
                )}
              >
                <span>{filter.label}</span>
                <button
                  onClick={filter.onRemove}
                  className="hover:bg-white/10 rounded-full p-0.5 transition-colors"
                  aria-label={`Remover filtro ${filter.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
