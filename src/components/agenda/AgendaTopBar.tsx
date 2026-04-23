"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Staff } from "@/types/agenda";
import { useState, useRef, useEffect } from "react";
import { AgendaQuickActions, type AgendaToolbarFiltersState } from "@/components/agenda/AgendaQuickActions";

type ViewMode = "day" | "week" | "month" | "list";

interface QuickStats {
  totalBookings: number;
  totalHours: number;
  totalAmount: number;
  rangeLabel?: string;
}

interface AgendaTopBarProps {
  selectedDate: string;
  viewMode: ViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  unreadNotifications?: number;
  onFiltersClick?: () => void;
  staffList?: Staff[];
  selectedStaffIds?: string[];
  onStaffFilterChange?: (staffIds: string[]) => void;
  filters?: AgendaToolbarFiltersState;
  onFiltersChange?: (filters: AgendaToolbarFiltersState) => void;
  quickStats?: QuickStats | null;
}

const VIEW_MODES: { key: ViewMode; label: string; short: string }[] = [
  { key: "day", label: "Día", short: "Día" },
  { key: "week", label: "Semana", short: "Sem" },
  { key: "month", label: "Mes", short: "Mes" },
  { key: "list", label: "Lista", short: "Lista" },
];

export function AgendaTopBar({
  selectedDate,
  viewMode,
  onDateChange,
  onViewModeChange,
  onSearchClick,
  onNotificationsClick,
  unreadNotifications = 0,
  filters = { payment: [], status: [], staff: [], highlighted: null },
  onFiltersChange,
  quickStats,
}: AgendaTopBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNavigate = (dir: "prev" | "next") => {
    const date = parseISO(selectedDate);
    const ops = {
      day: { prev: subDays, next: addDays },
      week: { prev: subWeeks, next: addWeeks },
      month: { prev: subMonths, next: addMonths },
      list: { prev: subDays, next: addDays },
    };
    onDateChange(format(ops[viewMode][dir](date, 1), "yyyy-MM-dd"));
  };

  const handleToday = () => onDateChange(format(new Date(), "yyyy-MM-dd"));

  const formatDateDisplay = () => {
    const date = parseISO(selectedDate);
    const MONTHS_LONG = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    switch (viewMode) {
      case "day":
        return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
      case "week":
        return `Semana del ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
      case "month":
        return `${MONTHS_LONG[date.getMonth()].charAt(0).toUpperCase() + MONTHS_LONG[date.getMonth()].slice(1)} ${date.getFullYear()}`;
      case "list":
        return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
      default:
        return "";
    }
  };

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  const hasStats = quickStats && quickStats.totalBookings > 0;
  const statsLine = hasStats
    ? [
        `${quickStats.totalBookings} citas`,
        quickStats.totalHours > 0 ? `${quickStats.totalHours}h` : null,
        quickStats.totalAmount > 0 ? `${Math.round(quickStats.totalAmount / 100)}€` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <motion.div
      className="hidden sm:block"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="px-3 sm:px-4 py-2 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[10rem]">
            <div ref={datePickerRef} className="relative flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex flex-col items-start min-w-0 group text-left"
                aria-label="Seleccionar fecha"
              >
                <span
                  className={cn(
                    "text-sm font-semibold leading-tight truncate group-hover:text-[var(--bf-ink-200)] transition-colors",
                    isToday ? "text-[var(--bf-ink-50)]" : "text-[var(--bf-ink-100)]"
                  )}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <span className="truncate">{formatDateDisplay()}</span>
                  {statsLine && (
                    <span className="text-[11px] text-[var(--bf-ink-400)] font-medium leading-tight ml-2 truncate hidden sm:inline">
                      {statsLine}
                    </span>
                  )}
                </span>
              </button>

              <AnimatePresence>
                {showDatePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-2 left-0 z-[80] rounded-[var(--r-md)] bg-[var(--bf-surface)] border border-[var(--bf-border)] shadow-[var(--bf-shadow-card)] p-3"
                  >
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        onDateChange(e.target.value);
                        setShowDatePicker(false);
                      }}
                      className="rounded-[var(--r-md)] border border-[var(--bf-border-2)] bg-[var(--bf-bg-elev)] px-3 py-2 text-sm text-[var(--bf-ink-50)] focus:border-[var(--bf-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(79,161,216,0.2)]"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleNavigate("prev")}
              className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
              aria-label="Fecha anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={handleToday}
              className={cn(
                "px-2.5 h-8 rounded-[var(--r-md)] text-xs font-semibold transition-all",
                isToday
                  ? "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-300)] border border-[var(--bf-border)]"
                  : "bg-[var(--bf-primary)] text-[var(--bf-ink)] shadow-[var(--bf-shadow-glow)]"
              )}
            >
              Hoy
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleNavigate("next")}
              className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
              aria-label="Fecha siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
            </motion.button>
          </div>

          <AgendaQuickActions
            onSearchClick={onSearchClick}
            onNotificationsClick={onNotificationsClick}
            unreadNotifications={unreadNotifications}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />

          <div className="flex items-center rounded-[var(--r-full)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] p-0.5 gap-0.5 flex-shrink-0">
            {VIEW_MODES.map((mode) => (
              <motion.button
                key={mode.key}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onViewModeChange(mode.key)}
                className={cn(
                  "px-2.5 py-1 rounded-[10px] text-xs font-medium transition-all duration-150",
                  viewMode === mode.key
                    ? "bg-[var(--bf-ink-50)] text-[var(--bf-ink)]"
                    : "text-[var(--bf-ink-400)] hover:text-[var(--bf-ink-100)]"
                )}
              >
                {mode.short}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
