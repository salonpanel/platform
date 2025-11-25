"use client";

import { Clock, DollarSign, TrendingUp, Calendar } from "lucide-react";

interface QuickStats {
  totalBookings: number;
  totalHours: number;
  totalAmount: number;
  rangeLabel?: string;
}

interface AgendaContextBarProps {
  quickStats?: QuickStats | null;
  viewMode?: "day" | "week" | "month" | "list";
  // Deprecated props - kept for backwards compatibility
  staffUtilization?: unknown[];
  staffList?: unknown[];
  selectedStaffId?: string | null;
  onStaffChange?: (staffId: string | null) => void;
}

/**
 * AgendaContextBar - Compact stats bar above the calendar
 * Shows day metrics: bookings count, total time, revenue, average
 */
export function AgendaContextBar({
  quickStats,
}: AgendaContextBarProps) {
  const hasStats = quickStats && (quickStats.totalBookings > 0 || quickStats.totalHours > 0 || quickStats.totalAmount > 0);

  // Don't render if no stats
  if (!hasStats) {
    return null;
  }

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-white/5">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
        {/* Bookings count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
          <Calendar className="h-3.5 w-3.5 text-[#3A6DFF]" />
          <span className="text-sm font-semibold text-white">{quickStats.totalBookings}</span>
          <span className="text-xs text-white/50">{quickStats.rangeLabel || "citas"}</span>
        </div>

        {/* Total time */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
          <Clock className="h-3.5 w-3.5 text-[#4FE3C1]" />
          <span className="text-sm font-semibold text-white">{quickStats.totalHours}h</span>
          <span className="text-xs text-white/50">tiempo</span>
        </div>

        {/* Revenue */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
          <DollarSign className="h-3.5 w-3.5 text-[#A06BFF]" />
          <span className="text-sm font-semibold text-white">{(quickStats.totalAmount / 100).toFixed(0)}€</span>
          <span className="text-xs text-white/50">ingresos</span>
        </div>

        {/* Average per booking */}
        {quickStats.totalBookings > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
            <TrendingUp className="h-3.5 w-3.5 text-[#4FE3C1]" />
            <span className="text-sm font-semibold text-white">
              {Math.round((quickStats.totalAmount / quickStats.totalBookings) / 100)}€
            </span>
            <span className="text-xs text-white/50">promedio</span>
          </div>
        )}
      </div>
    </div>
  );
}
