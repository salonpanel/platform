"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StaffSelector } from "./StaffSelector";
import { Search, X } from "lucide-react";
import { Staff } from "@/types/agenda";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileStaffSwitcher } from "./MobileStaffSwitcher";

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
  hideStaff?: boolean;
}

export function AgendaFilters({
  staffList,
  selectedStaffId,
  onStaffChange,
  searchOpen,
  searchTerm,
  onSearchChange,
  onSearchClose,
  density = "default",
  hideStaff = false,
}: AgendaFiltersProps) {
  const { isMobile } = useResponsive();
  const showStaff = staffList.length > 1 && !hideStaff;

  if (!searchOpen && !showStaff) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 flex flex-col gap-2 px-3 sm:px-4 pb-1"
    >
      {/* Search panel */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar cliente, servicio o staff..."
                  className={cn(
                    "w-full pl-10 pr-4 py-2 rounded-xl transition-all duration-200",
                    "bg-white/5 border border-white/10",
                    "focus:border-[#4FE3C1]/50 focus:ring-2 focus:ring-[#4FE3C1]/20 focus:outline-none",
                    "text-white placeholder-white/40 text-sm"
                  )}
                  autoFocus
                />
              </div>
              <button
                onClick={onSearchClose}
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                aria-label="Cerrar búsqueda"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff chips — only if more than one staff */}
      {showStaff && (
        <>
          {/* Mobile: compact switcher (arrows + bottom-sheet) */}
          {isMobile ? (
            <MobileStaffSwitcher
              staffList={staffList}
              selectedStaffId={selectedStaffId}
              onSelectStaff={onStaffChange}
            />
          ) : (
            <StaffSelector
              staff={staffList}
              selectedStaffId={selectedStaffId}
              onSelect={onStaffChange}
              density="compact"
              showUtilization={false}
            />
          )}
        </>
      )}
    </motion.div>
  );
}
