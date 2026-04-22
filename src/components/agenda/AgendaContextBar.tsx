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
    <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--bf-border)]">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {/* Bookings count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]">
          <Calendar className="h-3.5 w-3.5 text-[var(--bf-primary)]" />
          <span className="text-sm font-semibold text-[var(--bf-ink-50)]">{quickStats.totalBookings}</span>
          <span className="text-xs text-[var(--bf-ink-400)]" style={{ fontFamily: "var(--font-mono)" }}>{quickStats.rangeLabel || "citas"}</span>
        </div>

        {/* Total time */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]">
          <Clock className="h-3.5 w-3.5 text-[var(--bf-primary)]" />
          <span className="text-sm font-semibold text-[var(--bf-ink-50)]">{quickStats.totalHours}h</span>
          <span className="text-xs text-[var(--bf-ink-400)]" style={{ fontFamily: "var(--font-mono)" }}>tiempo</span>
        </div>

        {/* Revenue */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]">
          <DollarSign className="h-3.5 w-3.5 text-[var(--bf-success)]" />
          <span className="text-sm font-semibold text-[var(--bf-ink-50)]">{(quickStats.totalAmount / 100).toFixed(0)}€</span>
          <span className="text-xs text-[var(--bf-ink-400)]" style={{ fontFamily: "var(--font-mono)" }}>ingresos</span>
        </div>

        {/* Average per booking */}
        {quickStats.totalBookings > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--bf-primary)]" />
            <span className="text-sm font-semibold text-[var(--bf-ink-50)]">
              {Math.round((quickStats.totalAmount / quickStats.totalBookings) / 100)}€
            </span>
            <span className="text-xs text-[var(--bf-ink-400)]" style={{ fontFamily: "var(--font-mono)" }}>promedio</span>
          </div>
        )}
      </div>
    </div>
  );
}
