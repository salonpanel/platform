"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Bell, Star, CheckCircle, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Staff, BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { useState, useRef, useEffect } from "react";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaFiltersState {
  payment: string[];
  status: string[];
  staff: string[];
  highlighted: boolean | null;
}

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
  // Staff props kept for backwards compat but Barberos dropdown removed from UI
  staffList?: Staff[];
  selectedStaffIds?: string[];
  onStaffFilterChange?: (staffIds: string[]) => void;
  filters?: AgendaFiltersState;
  onFiltersChange?: (filters: AgendaFiltersState) => void;
  quickStats?: QuickStats | null;
}

const VIEW_MODES: { key: ViewMode; label: string; short: string }[] = [
  { key: "day",   label: "Día",    short: "Día"  },
  { key: "week",  label: "Semana", short: "Sem"  },
  { key: "month", label: "Mes",    short: "Mes"  },
  { key: "list",  label: "Lista",  short: "Lista"},
];

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:   "text-[var(--bf-warn)]",
  confirmed: "text-[var(--bf-primary)]",
  paid:      "text-[var(--bf-success)]",
  completed: "text-[var(--bf-primary)]",
  cancelled: "text-[var(--bf-danger)]",
  no_show:   "text-[var(--bf-ink-400)]",
  hold:      "text-[var(--bf-primary)]",
};

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
  const [showFilters, setShowFilters] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setShowFilters(false);
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) setShowViewMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNavigate = (dir: "prev" | "next") => {
    const date = parseISO(selectedDate);
    const ops = {
      day:   { prev: subDays,    next: addDays    },
      week:  { prev: subWeeks,   next: addWeeks   },
      month: { prev: subMonths,  next: addMonths  },
      list:  { prev: subDays,    next: addDays    },
    };
    onDateChange(format(ops[viewMode][dir](date, 1), "yyyy-MM-dd"));
  };

  const handleToday = () => onDateChange(format(new Date(), "yyyy-MM-dd"));

  const formatDateDisplay = () => {
    const date = parseISO(selectedDate);
    const MONTHS_LONG  = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const WEEKDAYS     = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

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

  const formatMobileHeaderLabel = () => {
    const date = parseISO(selectedDate);
    const MONTHS_LONG  = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    // In week view, the day strip already shows the range; keep the header minimal.
    if (viewMode === "week") {
      const month = MONTHS_LONG[date.getMonth()];
      return `${month.charAt(0).toUpperCase() + month.slice(1)} ${date.getFullYear()}`;
    }
    return formatDateDisplay();
  };

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");

  const handleStatusToggle = (status: string) => {
    if (!onFiltersChange) return;
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handleHighlightedToggle = () => {
    if (!onFiltersChange) return;
    onFiltersChange({ ...filters, highlighted: filters.highlighted ? null : true });
  };

  const handleClearFilters = () => {
    if (onFiltersChange) onFiltersChange({ payment: [], status: [], staff: [], highlighted: null });
    setShowFilters(false);
  };

  const activeFiltersCount = filters.status.length + (filters.highlighted ? 1 : 0);

  const hasStats = quickStats && quickStats.totalBookings > 0;
  const statsLine = hasStats
    ? [
        `${quickStats.totalBookings} citas`,
        quickStats.totalHours > 0 ? `${quickStats.totalHours}h` : null,
        quickStats.totalAmount > 0 ? `${Math.round(quickStats.totalAmount / 100)}€` : null,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="px-3 sm:px-4 py-2 sm:py-2.5">
        {/* MOBILE HEADER (2 rows, no overlaps) */}
        <div className="sm:hidden flex flex-col gap-2">
          {/* Row 1: Date/context + quick actions */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            {/* Date display + stats */}
            <div className="min-w-0 flex-1">
              <div ref={datePickerRef} className="relative min-w-0">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex flex-col items-start min-w-0 group text-left"
                  aria-label="Seleccionar fecha"
                >
                  <span
                    className={cn(
                      "text-sm font-semibold leading-tight truncate group-hover:text-white/80 transition-colors",
                      isToday ? "text-white" : "text-white/90"
                    )}
                  >
                    {formatMobileHeaderLabel()}
                  </span>
                  {statsLine && (
                    <span className="text-[11px] text-white/35 font-medium leading-tight mt-0.5 truncate max-w-[18rem]">
                      {statsLine}
                    </span>
                  )}
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

          {/* Quick actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={onSearchClick}
                className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
                aria-label="Buscar"
              >
                <Search className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={onNotificationsClick}
                className="relative h-8 w-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
                aria-label="Notificaciones"
              >
                <Bell className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
                {unreadNotifications > 0 && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-gradient-to-r from-[#4FA1D8] to-[#4FA1D8] text-[9px] font-bold text-[#0E0F11] flex items-center justify-center shadow-[0_4px_12px_rgba(79,161,216,0.4)]"
                  >
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </motion.span>
                )}
              </motion.button>

              {/* Filters */}
              <div ref={filtersRef} className="relative flex-shrink-0">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "h-8 w-8 rounded-xl border flex items-center justify-center relative transition-all",
                    activeFiltersCount > 0
                      ? "bg-[#4FA1D8]/15 border-[#4FA1D8]/30 text-[#4FA1D8]"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  )}
                  aria-label="Filtros"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-[#4FA1D8] text-[#0E0F11] text-[9px] font-bold flex items-center justify-center">
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
                      className="absolute top-full mt-2 right-0 z-[80] w-52 rounded-[var(--r-md)] bg-[var(--bf-surface)] border border-[var(--bf-border)] shadow-[var(--bf-shadow-card)] overflow-hidden"
                    >
                      <div className="p-3 space-y-3">
                        {/* Status filters */}
                        <div>
                          <p className="text-[10px] font-semibold text-[var(--bf-ink-400)] uppercase tracking-wider mb-1.5 px-1" style={{ fontFamily: "var(--font-mono)" }}>Estado</p>
                          <div className="space-y-0.5">
                            {(["pending","confirmed","paid","completed","cancelled","no_show"] as BookingStatus[]).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleStatusToggle(status)}
                                className={cn(
                                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all",
                                  filters.status.includes(status)
                                    ? "bg-white/10 text-white"
                                    : "text-white/60 hover:bg-white/5 hover:text-white"
                                )}
                              >
                                <span className={cn(STATUS_COLORS[status], "font-medium")}>
                                  {BOOKING_STATUS_CONFIG[status].label}
                                </span>
                                {filters.status.includes(status) && (
                                  <CheckCircle className="h-3.5 w-3.5 text-[#4FA1D8]" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Highlighted filter */}
                        <div className="border-t border-white/5 pt-2">
                          <button
                            onClick={handleHighlightedToggle}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all",
                              filters.highlighted
                                ? "bg-[#E06072]/15 text-[#E06072]"
                                : "text-white/60 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <Star className="h-3.5 w-3.5" />
                              Destacadas
                            </span>
                            {filters.highlighted && <CheckCircle className="h-3.5 w-3.5" />}
                          </button>
                        </div>

                        {/* Clear button */}
                        {activeFiltersCount > 0 && (
                          <div className="border-t border-[var(--bf-border)] pt-2">
                            <button
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
          </div>

          {/* Row 2: date navigation + view mode */}
          <div className="flex items-center justify-between gap-2">
            {/* Date navigation */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => handleNavigate("prev")}
                className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
                aria-label="Fecha anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
              </motion.button>

              <motion.button
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
                whileTap={{ scale: 0.94 }}
                onClick={() => handleNavigate("next")}
                className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
                aria-label="Fecha siguiente"
              >
                <ChevronRight className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
              </motion.button>
            </div>

            {/* View: dropdown */}
            <div ref={viewMenuRef} className="relative flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => setShowViewMenu((v) => !v)}
                className="h-8 px-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold text-white/80"
                aria-label="Cambiar vista"
                aria-expanded={showViewMenu}
              >
                <span className="text-white/60">Vista</span>
                <span className="text-white">{VIEW_MODES.find((m) => m.key === viewMode)?.short ?? "—"}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-white/60 transition-transform", showViewMenu && "rotate-180")} />
              </motion.button>

              <AnimatePresence>
                {showViewMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full mt-2 right-0 z-[80] w-40 rounded-[var(--r-md)] bg-[var(--bf-surface)] border border-[var(--bf-border)] shadow-[var(--bf-shadow-card)] overflow-hidden"
                  >
                    <div className="p-1">
                      {VIEW_MODES.map((mode) => (
                        <button
                          key={mode.key}
                          onClick={() => {
                            onViewModeChange(mode.key);
                            setShowViewMenu(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                            viewMode === mode.key
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* DESKTOP/TABLET HEADER (existing layout) */}
        <div className="hidden sm:flex sm:items-center gap-2">

          {/* Date display + stats */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div ref={datePickerRef} className="relative flex items-center gap-2 min-w-0">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex flex-col items-start min-w-0 group text-left"
                aria-label="Seleccionar fecha"
              >
                <span
                  className={cn(
                    "text-sm font-semibold leading-tight truncate group-hover:text-white/80 transition-colors",
                    isToday ? "text-white" : "text-white/90"
                  )}
                >
                  <span className="truncate">{formatDateDisplay()}</span>
                  {statsLine && (
                    <span className="text-[11px] text-white/35 font-medium leading-tight ml-2 truncate hidden sm:inline">
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
                    className="absolute top-full mt-2 left-0 z-[80] rounded-xl bg-[#1A1B1F] border border-white/10 shadow-2xl p-3"
                  >
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        onDateChange(e.target.value);
                        setShowDatePicker(false);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4FA1D8]/50 focus:outline-none focus:ring-2 focus:ring-[#4FA1D8]/20"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => handleNavigate("prev")}
              className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
              aria-label="Fecha anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
            </motion.button>

            <motion.button
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
              whileTap={{ scale: 0.94 }}
              onClick={() => handleNavigate("next")}
              className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
              aria-label="Fecha siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
            </motion.button>
          </div>

          {/* Actions: search + bell */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={onSearchClick}
              className="h-8 w-8 rounded-[var(--r-md)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] hover:bg-[var(--bf-surface)] transition-colors flex items-center justify-center"
              aria-label="Buscar"
            >
              <Search className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={onNotificationsClick}
              className="relative h-8 w-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="Notificaciones"
            >
              <Bell className="h-3.5 w-3.5 text-[var(--bf-ink-400)]" />
              {unreadNotifications > 0 && (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-gradient-to-r from-[#4FA1D8] to-[#4FA1D8] text-[9px] font-bold text-[#0E0F11] flex items-center justify-center shadow-[0_4px_12px_rgba(79,161,216,0.4)]"
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </motion.span>
              )}
            </motion.button>
          </div>

          {/* View mode segmented control */}
          <div className="flex items-center rounded-[var(--r-full)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] p-0.5 gap-0.5 flex-shrink-0">
            {VIEW_MODES.map((mode) => (
              <motion.button
                key={mode.key}
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

          {/* Filters button with combined dropdown */}
          <div ref={filtersRef} className="relative flex-shrink-0">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-8 w-8 rounded-xl border flex items-center justify-center relative transition-all",
              activeFiltersCount > 0
                ? "bg-[#4FA1D8]/15 border-[#4FA1D8]/30 text-[#4FA1D8]"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            )}
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 rounded-full bg-[#4FA1D8] text-[#0E0F11] text-[9px] font-bold flex items-center justify-center">
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
                className="absolute top-full mt-2 right-0 z-[80] w-52 rounded-[var(--r-md)] bg-[var(--bf-surface)] border border-[var(--bf-border)] shadow-[var(--bf-shadow-card)] overflow-hidden"
              >
                <div className="p-3 space-y-3">
                  {/* Status filters */}
                  <div>
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 px-1">Estado</p>
                    <div className="space-y-0.5">
                      {(["pending","confirmed","paid","completed","cancelled","no_show"] as BookingStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusToggle(status)}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all",
                            filters.status.includes(status)
                              ? "bg-white/10 text-white"
                              : "text-white/60 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <span className={cn(STATUS_COLORS[status], "font-medium")}>
                            {BOOKING_STATUS_CONFIG[status].label}
                          </span>
                          {filters.status.includes(status) && (
                            <CheckCircle className="h-3.5 w-3.5 text-[#4FA1D8]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Highlighted filter */}
                  <div className="border-t border-white/5 pt-2">
                    <button
                      onClick={handleHighlightedToggle}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all",
                        filters.highlighted
                          ? "bg-[#E06072]/15 text-[#E06072]"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <Star className="h-3.5 w-3.5" />
                        Destacadas
                      </span>
                      {filters.highlighted && <CheckCircle className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Clear button */}
                  {activeFiltersCount > 0 && (
                    <div className="border-t border-white/5 pt-2">
                      <button
                        onClick={handleClearFilters}
                        className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-[var(--bf-danger)] hover:bg-[rgba(224,96,114,0.10)] transition-all"
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
      </div>
    </motion.div>
  );
}
