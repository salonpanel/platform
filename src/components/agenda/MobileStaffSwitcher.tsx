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
  /** Fila única junto a iconos (altura ~32px), p. ej. cabecera móvil de agenda */
  density?: "default" | "toolbar";
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
  density = "default",
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

  const isToolbar = density === "toolbar";

  return (
    <>
      {/* Compact switcher bar */}
      <div
        className={cn(
          "min-w-0 w-full",
          !isToolbar && "px-3 py-2"
        )}
      >
        <div
          className={cn(
            "flex items-center border border-[var(--bf-border)] bg-[var(--bf-bg-elev)]",
            isToolbar
              ? "h-8 gap-0.5 rounded-[var(--r-md)] px-0.5 py-0"
              : "gap-1.5 rounded-[var(--r-xl)] shadow-[var(--bf-shadow-card)] px-2 py-2"
          )}
        >
        {/* Prev arrow */}
        <motion.button
          id="staff-prev-btn"
          whileTap={{ scale: 0.88 }}
          onClick={goToPrev}
          disabled={!canGoPrev}
          className={cn(
            "flex-shrink-0 flex items-center justify-center rounded-[var(--r-md)] transition-all duration-200",
            isToolbar ? "w-7 h-7" : "w-9 h-9 rounded-xl",
            canGoPrev
              ? "text-[var(--bf-ink-50)] active:bg-[var(--bf-surface)]"
              : "text-[var(--bf-ink-400)] opacity-40"
          )}
          aria-label="Barbero anterior"
        >
          <ChevronLeft className={isToolbar ? "w-4 h-4" : "w-5 h-5"} />
        </motion.button>

        {/* Center — tappable staff info */}
        <motion.button
          id="staff-name-picker-btn"
          whileTap={{ scale: 0.97 }}
          onClick={() => setSheetOpen(true)}
          className={cn(
            "flex-1 flex items-center justify-center min-w-0 rounded-[var(--r-md)] active:bg-white/5 hover:bg-white/[0.03] transition-all duration-150",
            isToolbar ? "gap-1 py-0 px-1" : "gap-2.5 py-1.5 px-2 rounded-xl"
          )}
          aria-label="Seleccionar barbero"
        >
          {/* Color dot or "all" icon */}
          {currentColor ? (
            <span
              className={cn(
                "rounded-full flex-shrink-0 ring-2 ring-black/20",
                isToolbar ? "w-2 h-2" : "w-3 h-3"
              )}
              style={{ backgroundColor: currentColor }}
            />
          ) : (
            <Users className={cn("text-[var(--bf-primary)] flex-shrink-0", isToolbar ? "w-3 h-3" : "w-3.5 h-3.5")} />
          )}

          {/* Name */}
          <span
            className={cn(
              "font-semibold text-[var(--bf-ink-50)] truncate leading-tight",
              isToolbar ? "text-[11px]" : "text-[13px]"
            )}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {current?.name ?? "—"}
          </span>

          {/* Booking count badge */}
          {currentCount > 0 && (
            <span
              className={cn(
                "flex-shrink-0 inline-flex items-center justify-center rounded-full font-bold bg-[rgba(79,161,216,0.15)] text-[var(--bf-primary)] leading-none",
                isToolbar ? "min-w-[16px] h-4 px-1 text-[9px]" : "min-w-[20px] h-5 px-1.5 text-[10px]"
              )}
            >
              {currentCount}
            </span>
          )}

          {/* Chevron down hint */}
          <span className={cn("text-[var(--bf-ink-400)] leading-none flex-shrink-0", isToolbar ? "text-[10px]" : "text-xs")}>▾</span>
        </motion.button>

        {/* Next arrow */}
        <motion.button
          id="staff-next-btn"
          whileTap={{ scale: 0.88 }}
          onClick={goToNext}
          disabled={!canGoNext}
          className={cn(
            "flex-shrink-0 flex items-center justify-center rounded-[var(--r-md)] transition-all duration-200",
            isToolbar ? "w-7 h-7" : "w-9 h-9 rounded-xl",
            canGoNext
              ? "text-[var(--bf-ink-50)] active:bg-[var(--bf-surface)]"
              : "text-[var(--bf-ink-400)] opacity-40"
          )}
          aria-label="Siguiente barbero"
        >
          <ChevronRight className={isToolbar ? "w-4 h-4" : "w-5 h-5"} />
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
              className="fixed bottom-0 left-0 right-0 z-[56] rounded-t-3xl bg-[var(--bf-surface)] border-t border-[var(--bf-border)] nav-inset-bottom"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--bf-ink-400)]/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--bf-border)]">
                <h3 className="text-base font-semibold text-[var(--bf-ink-50)]" style={{ fontFamily: "var(--font-sans)" }}>
                  Selecciona un barbero
                </h3>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="p-2 -mr-1 rounded-[var(--r-md)] text-[var(--bf-ink-400)] hover:bg-[var(--bf-bg-elev)] transition-all duration-200"
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
                          ? "bg-[rgba(79,161,216,0.10)] border border-[rgba(79,161,216,0.30)]"
                          : "bg-[var(--bf-bg-elev)] border border-transparent active:bg-[var(--bf-surface)]"
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
                                backgroundColor: "rgba(79,161,216,0.1)",
                                color: "var(--bf-primary)",
                                border: "1.5px solid rgba(79,161,216,0.25)",
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
                            "text-[14px] font-semibold  truncate leading-tight",
                            isSelected
                              ? "text-[var(--bf-primary)]"
                              : "text-[var(--bf-ink-50)]"
                          )}
                          style={{ fontFamily: "var(--font-sans)" }}
                        >
                          {option.name}
                        </p>
                        <p className="text-[11px] text-[var(--bf-ink-400)] mt-0.5 leading-tight">
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
                            <Check className="w-4 h-4 text-[var(--bf-primary)] flex-shrink-0" />
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
