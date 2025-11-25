"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, DollarSign, TrendingUp, Users, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Staff } from "@/types/agenda";

interface QuickStats {
  totalBookings: number;
  totalHours: number;
  totalAmount: number;
  rangeLabel?: string;
}

interface StaffUtilization {
  staffId: string;
  staffName: string;
  utilization: number;
}

interface AgendaContextBarProps {
  quickStats?: QuickStats | null;
  staffList: Staff[];
  selectedStaffId: string | null;
  onStaffChange: (staffId: string | null) => void;
  searchOpen: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchClose: () => void;
}

/**
 * AgendaContextBar - Context toolbar with KPIs and staff filters
 * Scrollable row containing quick stats and staff utilization chips
 */
export function AgendaContextBar({
  quickStats,
  staffList,
  selectedStaffId,
  onStaffChange,
  searchOpen,
  searchTerm,
  onSearchChange,
  onSearchClose,
}: AgendaContextBarProps) {
  const handleStaffToggle = (staffId: string) => {
    if (selectedStaffId === staffId) {
      // Deselect if already selected
      onStaffChange(null);
    } else {
      // Select this staff
      onStaffChange(staffId);
    }
  };

  const clearStaffFilter = () => {
    onStaffChange(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 px-5 py-4 bg-white/5 backdrop-blur-xl border border-white/8 rounded-2xl"
    >
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-[240px]">
          <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/60 font-semibold">Resumen diario</p>
            <p className="text-sm text-white/80">Salas, ingresos y rendimiento a la vista</p>
          </div>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="w-full lg:w-[360px]"
            >
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Buscar cliente, servicio o nota"
                  className="w-full bg-white/5 border border-white/12 rounded-xl py-3 pl-10 pr-11 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/40"
                />
                <Search className="h-4 w-4 text-white/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  onClick={onSearchClose}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                  aria-label="Cerrar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {quickStats && (
          <div className="flex items-center gap-2 text-sm text-white/90 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10 shadow-inner">
              <Clock className="h-4 w-4 text-[#4FE3C1]" />
              <div className="leading-tight">
                <p className="text-[11px] text-white/60">Tiempo</p>
                <p className="text-sm font-semibold">{quickStats.totalHours}h</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10 shadow-inner">
              <DollarSign className="h-4 w-4 text-[#A06BFF]" />
              <div className="leading-tight">
                <p className="text-[11px] text-white/60">Ingresos</p>
                <p className="text-sm font-semibold">{(quickStats.totalAmount / 100).toFixed(0)}€</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10 shadow-inner">
              <TrendingUp className="h-4 w-4 text-[#4FE3C1]" />
              <div className="leading-tight">
                <p className="text-[11px] text-white/60">Promedio</p>
                <p className="text-sm font-semibold">
                  {quickStats.totalBookings > 0
                    ? `${Math.round((quickStats.totalAmount / quickStats.totalBookings) / 100)}€`
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-2 text-white/60 text-xs font-medium">
            <Users className="h-4 w-4" />
            <span>Staff</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onStaffChange(null)}
              className={cn(
                "px-3 py-2 rounded-full text-xs font-semibold transition-all border",
                !selectedStaffId
                  ? "bg-white text-[#0E0F11] border-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              )}
            >
              Todos
            </motion.button>
            {staffList.map((staff) => (
              <motion.button
                key={staff.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStaffToggle(staff.id)}
                className={cn(
                  "px-3 py-2 rounded-full text-xs font-semibold transition-all border",
                  selectedStaffId === staff.id
                    ? "bg-[#3A6DFF] text-white border-[#3A6DFF]"
                    : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                )}
              >
                {staff.name}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
