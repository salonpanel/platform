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
      className="flex-shrink-0 px-4 py-2 bg-[rgba(15,23,42,0.4)] border-b border-[rgba(255,255,255,0.03)]"
    >
      <div className="flex gap-3 overflow-x-auto scrollbar-hide">
        {/* Quick Stats - Más compactos */}
        {hasStats && (
          <div className="flex gap-2 flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              className="flex-shrink-0"
            >
              <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(15,23,42,0.6)] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.3)] px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-[8px] bg-[rgba(58,109,255,0.15)]">
                    <Calendar className="h-3 w-3 text-[#3A6DFF]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {quickStats.totalBookings}
                    </div>
                    <div className="text-[9px] text-[rgba(255,255,255,0.6)]">
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
              <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(15,23,42,0.6)] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.3)] px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-[8px] bg-[rgba(79,227,193,0.15)]">
                    <Clock className="h-3 w-3 text-[#4FE3C1]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {quickStats.totalHours}h
                    </div>
                    <div className="text-[9px] text-[rgba(255,255,255,0.6)]">
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
              <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(15,23,42,0.6)] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.3)] px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-[8px] bg-[rgba(160,107,255,0.15)]">
                    <DollarSign className="h-3 w-3 text-[#A06BFF]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {(quickStats.totalAmount / 100).toFixed(0)}€
                    </div>
                    <div className="text-[9px] text-[rgba(255,255,255,0.6)]">
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
                <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(15,23,42,0.6)] backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.3)] px-3 py-2 transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-[8px] bg-gradient-to-br from-[rgba(58,109,255,0.1)] to-[rgba(79,227,193,0.1)]">
                      <TrendingUp className="h-3 w-3 text-[#4FE3C1]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        {Math.round((quickStats.totalAmount / quickStats.totalBookings) / 100)}€
                      </div>
                      <div className="text-[9px] text-[rgba(255,255,255,0.6)]">
                        promedio
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Staff Utilization Chips - Más integrados */}
        {staffUtilization.length > 0 && (
          <div className="flex gap-2 flex-shrink-0 pl-3 border-l border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-1 flex-shrink-0">
              <Users className="h-3 w-3 text-[rgba(255,255,255,0.5)]" />
              <span className="text-xs text-[rgba(255,255,255,0.6)] font-medium">Staff</span>
            </div>

            {staffUtilization.map((staff) => (
              <motion.button
                key={staff.staffId}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStaffToggle(staff.staffId)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-[8px] border transition-all duration-200 flex-shrink-0",
                  selectedStaffId === staff.staffId
                    ? "bg-[#3A6DFF] text-white border-[#3A6DFF] shadow-sm"
                    : getUtilizationColor(staff.utilization)
                )}
              >
                <span className="text-xs font-medium truncate max-w-[50px]">
                  {staff.staffName}
                </span>
                <span className="text-xs font-bold">
                  {staff.utilization}%
                </span>
                {selectedStaffId === staff.staffId && (
                  <X
                    className="h-3 w-3"
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
