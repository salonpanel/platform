"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Staff } from "@/types/agenda";

interface MobileStaffTabsProps {
  staffList: Staff[];
  selectedStaffId: string | null;
  onSelectStaff: (staffId: string) => void;
  /** Optional booking count per staff for badge display */
  bookingCounts?: Record<string, number>;
}

/**
 * MobileStaffTabs — Horizontal pill tabs for selecting a staff member on mobile.
 * Follows the Fresha/Square pattern: instead of horizontal scroll columns,
 * show one staff at a time with quick-switch tabs.
 */
export function MobileStaffTabs({
  staffList,
  selectedStaffId,
  onSelectStaff,
  bookingCounts,
}: MobileStaffTabsProps) {
  // Show "Todos" tab only when there are 2+ staff
  const showAllTab = staffList.length > 1;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2 bg-[var(--bg-primary)]/80 backdrop-blur-sm border-b border-[var(--glass-border-subtle)]">
      {showAllTab && (
        <StaffTab
          label="Todos"
          isSelected={!selectedStaffId}
          onClick={() => onSelectStaff("")}
          count={bookingCounts ? Object.values(bookingCounts).reduce((a, b) => a + b, 0) : undefined}
        />
      )}
      {staffList.map((staff) => (
        <StaffTab
          key={staff.id}
          label={staff.display_name || staff.name}
          color={staff.color}
          isSelected={selectedStaffId === staff.id}
          onClick={() => onSelectStaff(staff.id)}
          count={bookingCounts?.[staff.id]}
        />
      ))}
    </div>
  );
}

function StaffTab({
  label,
  color,
  isSelected,
  onClick,
  count,
}: {
  label: string;
  color?: string | null;
  isSelected: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
        "transition-all duration-200 flex-shrink-0",
        "focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/40",
        // Minimum tap target
        "min-h-[36px]",
        isSelected
          ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
          : "bg-white/5 text-[var(--text-secondary)] border border-transparent hover:bg-white/8 hover:text-[var(--text-primary)]"
      )}
      aria-pressed={isSelected}
    >
      {/* Staff color dot */}
      {color && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}

      <span className="truncate max-w-[100px]">{label}</span>

      {/* Booking count badge */}
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold",
            isSelected
              ? "bg-[var(--accent-blue)]/25 text-[var(--accent-blue)]"
              : "bg-white/10 text-[var(--text-tertiary)]"
          )}
        >
          {count}
        </span>
      )}

      {/* Active indicator underline */}
      {isSelected && (
        <motion.div
          layoutId="staff-tab-indicator"
          className="absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-[var(--accent-blue)]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}
