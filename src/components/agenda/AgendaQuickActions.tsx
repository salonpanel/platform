"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, SlidersHorizontal, Star, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";

export interface AgendaToolbarFiltersState {
  payment: string[];
  status: string[];
  staff: string[];
  highlighted: boolean | null;
}

export interface MobileAgendaToolbarProps {
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  unreadNotifications: number;
  filters: AgendaToolbarFiltersState;
  onFiltersChange: (filters: AgendaToolbarFiltersState) => void;
  quickStats?: {
    totalBookings: number;
    totalHours: number;
    totalAmount: number;
    rangeLabel?: string;
  } | null;
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "text-[var(--bf-warn)]",
  confirmed: "text-[var(--bf-primary)]",
  paid: "text-[var(--bf-success)]",
  completed: "text-[var(--bf-primary)]",
  cancelled: "text-[var(--bf-danger)]",
  no_show: "text-[var(--bf-ink-400)]",
  hold: "text-[var(--bf-primary)]",
};

interface AgendaQuickActionsProps {
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  unreadNotifications?: number;
  filters: AgendaToolbarFiltersState;
  onFiltersChange?: (filters: AgendaToolbarFiltersState) => void;
  /** Alineación del panel de filtros desplegable */
  filterMenuSide?: "left" | "right";
  className?: string;
}

export function AgendaQuickActions({
  onSearchClick,
  onNotificationsClick,
  unreadNotifications = 0,
  filters,
  onFiltersChange,
  filterMenuSide = "right",
  className,
}: AgendaQuickActionsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleStatusToggle = (status: string) => {
    if (!onFiltersChange) return;
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handleHighlightedToggle = () => {
    if (!onFiltersChange) return;
    onFiltersChange({ ...filters, highlighted: filters.highlighted ? null : true });
  };

  const handleClearFilters = () => {
    if (onFiltersChange) {
      onFiltersChange({ payment: [], status: [], staff: [], highlighted: null });
    }
    setShowFilters(false);
  };

  const activeFiltersCount = filters.status.length + (filters.highlighted ? 1 : 0);

  return (
    <div className={cn("flex items-center gap-1 flex-shrink-0", className)}>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onSearchClick}
        className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
        aria-label="Buscar"
        type="button"
      >
        <Search className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onNotificationsClick}
        className="relative h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
        aria-label="Notificaciones"
        type="button"
      >
        <Bell className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
        {unreadNotifications > 0 && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-[var(--bf-primary)] text-[9px] font-bold text-[var(--bf-ink)] flex items-center justify-center shadow-[var(--bf-shadow-glow)]"
          >
            {unreadNotifications > 9 ? "9+" : unreadNotifications}
          </motion.span>
        )}
      </motion.button>

      <div ref={filtersRef} className="relative flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "h-8 w-8 rounded-[var(--r-md)] border flex items-center justify-center relative transition-all",
            activeFiltersCount > 0
              ? "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-primary)]"
              : "border-[var(--bf-border)] bg-[var(--bf-bg-elev)] text-[var(--bf-ink-400)] hover:bg-[var(--bf-surface)] hover:text-[var(--bf-ink-200)]"
          )}
          aria-label="Filtros"
          type="button"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-[var(--bf-primary)] text-[var(--bf-ink)] text-[9px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </motion.button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className={cn(
                "absolute top-full mt-2 z-[80] w-52 rounded-[var(--r-md)] bg-[var(--bf-surface)] border border-[var(--bf-border)] shadow-[var(--bf-shadow-card)] overflow-hidden",
                filterMenuSide === "right" ? "right-0" : "left-0"
              )}
            >
              <div className="p-3 space-y-3">
                <div>
                  <p
                    className="text-[10px] font-semibold text-[var(--bf-ink-400)] uppercase tracking-wider mb-1.5 px-1"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Estado
                  </p>
                  <div className="space-y-0.5">
                    {(
                      [
                        "pending",
                        "confirmed",
                        "paid",
                        "completed",
                        "cancelled",
                        "no_show",
                      ] as BookingStatus[]
                    ).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusToggle(status)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all",
                          filters.status.includes(status)
                            ? "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-50)]"
                            : "text-[var(--bf-ink-400)] hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-200)]"
                        )}
                      >
                        <span className={cn(STATUS_COLORS[status], "font-medium")}>
                          {BOOKING_STATUS_CONFIG[status].label}
                        </span>
                        {filters.status.includes(status) && (
                          <CheckCircle className="h-3.5 w-3.5 text-[var(--bf-primary)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--bf-border)] pt-2">
                  <button
                    type="button"
                    onClick={handleHighlightedToggle}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all",
                      filters.highlighted
                        ? "bg-[rgba(224,96,114,0.12)] text-[var(--bf-danger)]"
                        : "text-[var(--bf-ink-400)] hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-200)]"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Star className="h-3.5 w-3.5" />
                      Destacadas
                    </span>
                    {filters.highlighted && <CheckCircle className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {activeFiltersCount > 0 && (
                  <div className="border-t border-[var(--bf-border)] pt-2">
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[var(--r-sm)] text-xs text-[var(--bf-ink-400)] hover:text-[var(--bf-danger)] hover:bg-[rgba(224,96,114,0.10)] transition-all"
                    >
                      <X className="h-3 w-3" />
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
