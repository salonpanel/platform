"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Users, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Staff } from "@/types/agenda";

interface MobileStaffSwitcherProps {
  staffList: Staff[];
  selectedStaffId: string | null; // null = "Todos"
  onSelectStaff: (staffId: string | null) => void;
  bookingCounts?: Record<string, number>;
  includeAllOption?: boolean;
}

/**
 * MobileStaffSwitcher — Replaces horizontal scrolling tabs.
 * Shows the active staff member with prev/next arrows (Fresha-style).
 * Tapping the name opens a bottom sheet to pick any staff or "Todos".
 *
 * UX rationale:
 * - Much faster to switch between barbers than scrolling hidden tabs
 * - Immediately visible who you're looking at
 * - Bottom sheet lists all barbers at once with their booking counts
 */
export function MobileStaffSwitcher({
  staffList,
  selectedStaffId,
  onSelectStaff,
  bookingCounts,
  includeAllOption = false,
}: MobileStaffSwitcherProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build the ordered list of options (optionally includes "Todos")
  const staffOptions: Array<{ id: string | null; name: string; color?: string | null }> = [];
  if (includeAllOption) {
    staffOptions.push({ id: null, name: "Todos", color: null });
  }
  staffList.forEach((s) => {
    staffOptions.push({ id: s.id, name: s.display_name || s.name, color: s.color });
  });

  // If the caller doesn't support "Todos", never treat null as selected
  const effectiveSelectedId = includeAllOption ? selectedStaffId : (selectedStaffId ?? staffList[0]?.id ?? null);

  // Current index in the options list
  const currentIndex = staffOptions.findIndex((o) => o.id === effectiveSelectedId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const current = staffOptions[safeIndex];

  // Total bookings for "Todos" tab
  const totalBookings = bookingCounts
    ? Object.values(bookingCounts).reduce((a, b) => a + b, 0)
    : 0;

  const getCount = useCallback(
    (id: string | null) => {
      if (!bookingCounts) return 0;
      if (id === null) return totalBookings;
      return bookingCounts[id] ?? 0;
    },
    [bookingCounts, totalBookings]
  );

  const goToPrev = useCallback(() => {
    if (safeIndex > 0) {
      onSelectStaff(staffOptions[safeIndex - 1].id);
    }
  }, [safeIndex, staffOptions, onSelectStaff]);

  const goToNext = useCallback(() => {
    if (safeIndex < staffOptions.length - 1) {
      onSelectStaff(staffOptions[safeIndex + 1].id);
    }
  }, [safeIndex, staffOptions, onSelectStaff]);

  // Don't render if there's only 1 staff (no switching needed)
  if (staffList.length <= 1) return null;

  const currentCount = getCount(current?.id ?? null);
  const currentColor =
    current?.id !== null
      ? staffList.find((s) => s.id === current?.id)?.color
      : null;

  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < staffOptions.length - 1;

  return (
    <>
      {/* Compact switcher bar */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] backdrop-blur-md shadow-[var(--shadow-premium)] px-2 py-2">
        {/* Prev arrow */}
        <motion.button
          id="staff-prev-btn"
          whileTap={{ scale: 0.88 }}
          onClick={goToPrev}
          disabled={!canGoPrev}
          className={cn(
            "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl",
            "transition-all duration-200",
            canGoPrev
              ? "text-[var(--text-primary)] active:bg-white/10"
              : "text-[var(--text-tertiary)] opacity-40"
          )}
          aria-label="Barbero anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        {/* Center — tappable staff info */}
        <motion.button
          id="staff-name-picker-btn"
          whileTap={{ scale: 0.97 }}
          onClick={() => setSheetOpen(true)}
          className="flex-1 flex items-center justify-center gap-2.5 py-1.5 px-2 rounded-xl active:bg-white/5 hover:bg-white/[0.03] transition-all duration-150 min-w-0"
          aria-label="Seleccionar barbero"
        >
          {/* Color dot or "all" icon */}
          {currentColor ? (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-black/20"
              style={{ backgroundColor: currentColor }}
            />
          ) : (
            <Users className="w-3.5 h-3.5 text-[var(--accent-aqua)] flex-shrink-0" />
          )}

          {/* Name */}
          <span className="text-[13px] font-semibold font-satoshi text-[var(--text-primary)] truncate leading-tight">
            {current?.name ?? "—"}
          </span>

          {/* Booking count badge */}
          {currentCount > 0 && (
            <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[var(--accent-aqua)]/15 text-[var(--accent-aqua)] leading-none">
              {currentCount}
            </span>
          )}

          {/* Chevron down hint */}
          <span className="text-[var(--text-tertiary)] text-xs leading-none flex-shrink-0">▾</span>
        </motion.button>

        {/* Next arrow */}
        <motion.button
          id="staff-next-btn"
          whileTap={{ scale: 0.88 }}
          onClick={goToNext}
          disabled={!canGoNext}
          className={cn(
            "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl",
            "transition-all duration-200",
            canGoNext
              ? "text-[var(--text-primary)] active:bg-white/10"
              : "text-[var(--text-tertiary)] opacity-40"
          )}
          aria-label="Siguiente barbero"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
        </div>
      </div>

      {/* Bottom sheet via Portal to escape CSS transforms and z-index issues */}
      {mounted && createPortal(
        <AnimatePresence>
          {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="staff-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[52]"
              onClick={() => setSheetOpen(false)}
            />

            {/* Sheet panel */}
            <motion.div
              key="staff-sheet-panel"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[56] rounded-t-3xl bg-[var(--bg-primary)] border-t border-[var(--glass-border)] nav-inset-bottom"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--text-tertiary)]/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--glass-border-subtle)]">
                <h3 className="text-base font-semibold font-satoshi text-[var(--text-primary)]">
                  Selecciona un barbero
                </h3>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="p-2 -mr-1 rounded-xl text-[var(--text-secondary)] active:bg-white/8 transition-all duration-200"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Staff list */}
              <div className="overflow-y-auto max-h-[60vh] p-3 space-y-1.5 pb-4">
                {staffOptions.map((option, idx) => {
                  const isSelected = option.id === effectiveSelectedId;
                  const count = getCount(option.id);
                  const staffColor =
                    option.id !== null
                      ? staffList.find((s) => s.id === option.id)?.color
                      : null;

                  return (
                    <motion.button
                      key={option.id ?? "todos"}
                      id={`staff-sheet-option-${option.id ?? "todos"}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onSelectStaff(option.id);
                        setSheetOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200",
                        isSelected
                          ? "bg-[var(--accent-aqua)]/10 border border-[var(--accent-aqua)]/25"
                          : "bg-white/[0.03] border border-transparent active:bg-white/[0.07]"
                      )}
                    >
                      {/* Avatar / icon */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={
                          staffColor
                            ? {
                                backgroundColor: `${staffColor}22`,
                                color: staffColor,
                                border: `1.5px solid ${staffColor}40`,
                              }
                            : {
                                backgroundColor: "rgba(79,227,193,0.1)",
                                color: "var(--accent-aqua)",
                                border: "1.5px solid rgba(79,227,193,0.25)",
                              }
                        }
                      >
                        {option.id === null ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          <span className="text-sm font-bold">
                            {(option.name.charAt(0) || "?").toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name + count */}
                      <div className="flex-1 text-left min-w-0">
                        <p
                          className={cn(
                            "text-[14px] font-semibold font-satoshi truncate leading-tight",
                            isSelected
                              ? "text-[var(--accent-aqua)]"
                              : "text-[var(--text-primary)]"
                          )}
                        >
                          {option.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-tight">
                          {count === 0
                            ? "Sin citas hoy"
                            : count === 1
                            ? "1 cita hoy"
                            : `${count} citas hoy`}
                        </p>
                      </div>

                      {/* Selected checkmark */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          >
                            <Check className="w-4 h-4 text-[var(--accent-aqua)] flex-shrink-0" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
