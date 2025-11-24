"use client";

import { motion } from "framer-motion";
import { Calendar, Clock, DollarSign, TrendingUp, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Staff } from "@/types/agenda";
import { UiCard } from "@/components/ui/apple-ui-kit";

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
  staffUtilization: StaffUtilization[];
  staffList: Staff[];
  selectedStaffId: string | null;
  onStaffChange: (staffId: string | null) => void;
  viewMode: "day" | "week" | "month" | "list";
}

/**
 * AgendaContextBar - Context toolbar with KPIs and staff filters
 * Scrollable row containing quick stats and staff utilization chips
 */
export function AgendaContextBar({
  quickStats,
  staffUtilization,
  staffList,
  selectedStaffId,
  onStaffChange,
  viewMode,
}: AgendaContextBarProps) {
  const getUtilizationColor = (utilization: number) => {
    if (utilization < 40) return "text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/20";
    if (utilization < 80) return "text-[var(--accent-aqua)] bg-[var(--accent-aqua)]/10 border-[var(--accent-aqua)]/20";
    return "text-[var(--accent-purple)] bg-[var(--accent-purple)]/10 border-[var(--accent-purple)]/20";
  };

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

  const hasStats = quickStats && (quickStats.totalBookings > 0 || quickStats.totalHours > 0 || quickStats.totalAmount > 0);

  // Don't render if no stats and no staff utilization
  if (!hasStats && staffUtilization.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 px-4 py-3 bg-[rgba(15,23,42,0.65)] border-b border-white/5"
    >
      <div className="flex gap-4 overflow-x-auto scrollbar-hide">
        {/* Quick Stats */}
        {hasStats && (
          <div className="flex gap-3 flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              className="flex-shrink-0"
            >
              <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 transition-transform transition-shadow duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-[var(--radius-md)] bg-[var(--accent-blue-glass)]">
                    <Calendar className="h-3 w-3 text-[var(--accent-blue)]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {quickStats.totalBookings}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      {quickStats.rangeLabel || "citas"}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              className="flex-shrink-0"
            >
              <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 transition-transform transition-shadow duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-[var(--radius-md)] bg-[var(--accent-aqua-glass)]">
                    <Clock className="h-3 w-3 text-[var(--accent-aqua)]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {quickStats.totalHours}h
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      tiempo total
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              className="flex-shrink-0"
            >
              <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 transition-transform transition-shadow duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-[var(--radius-md)] bg-[var(--accent-purple-glass)]">
                    <DollarSign className="h-3 w-3 text-[var(--accent-purple)]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {(quickStats.totalAmount / 100).toFixed(0)}€
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      ingresos
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {quickStats.totalBookings > 0 && (
              <motion.div
                whileHover={{ scale: 1.02, y: -1 }}
                className="flex-shrink-0"
              >
                <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 transition-transform transition-shadow duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--accent-blue)]/10 to-[var(--accent-aqua)]/10">
                      <TrendingUp className="h-3 w-3 text-[var(--accent-aqua)]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {Math.round((quickStats.totalAmount / quickStats.totalBookings) / 100)}€
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">
                        promedio
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Staff Utilization Chips */}
        {staffUtilization.length > 0 && (
          <div className="flex gap-2 flex-shrink-0 pl-4 border-l border-white/5">
            <div className="flex items-center gap-1 flex-shrink-0">
              <Users className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)] font-medium">Staff</span>
            </div>

            {staffUtilization.map((staff) => (
              <motion.button
                key={staff.staffId}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStaffToggle(staff.staffId)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-[var(--radius-lg)] border transition-all duration-200 flex-shrink-0",
                  selectedStaffId === staff.staffId
                    ? "bg-[var(--accent-blue)] text-white border-[var(--accent-blue)] shadow-sm"
                    : getUtilizationColor(staff.utilization)
                )}
              >
                <span className="text-xs font-medium truncate max-w-[60px]">
                  {staff.staffName}
                </span>
                <span className="text-xs font-bold">
                  {staff.utilization}%
                </span>
                {selectedStaffId === staff.staffId && (
                  <X
                    className="h-3 w-3 ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearStaffFilter();
                    }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
