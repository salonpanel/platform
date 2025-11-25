"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Bell, Filter, Calendar, ChevronDown, X, RotateCcw, Star, Users, CheckCircle } from "lucide-react";
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
  filters?: AgendaFiltersState;
  onFiltersChange?: (filters: AgendaFiltersState) => void;
}

// Dropdown component for filters
function FilterDropdown({
  label,
  icon,
  children,
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
          isOpen || (badge && badge > 0)
            ? "bg-white/10 text-white border-white/20"
            : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
        )}
      >
        {icon}
        <span>{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#4FE3C1] text-[#0E0F11]">
            {badge}
          </span>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 z-50 min-w-[200px] rounded-xl bg-[#1A1B1F] border border-white/10 shadow-xl overflow-hidden"
          >
            <div className="p-2 max-h-[400px] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * AgendaTopBar - Compact header with all filters integrated
 * Contains date navigation, view mode tabs, filters, and action buttons
 */
export function AgendaTopBar({
  selectedDate,
  viewMode,
  onDateChange,
  onViewModeChange,
  onSearchClick,
  onNotificationsClick,
  unreadNotifications = 0,
  onFiltersClick,
  staffList = [],
  selectedStaffIds = [],
  onStaffFilterChange,
  filters = { payment: [], status: [], staff: [], highlighted: null },
  onFiltersChange,
}: AgendaTopBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const viewModes: { key: ViewMode; label: string }[] = [
    { key: "day", label: "Día" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "list", label: "Lista" },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigate = (direction: "prev" | "next") => {
    const date = parseISO(selectedDate);
    let newDate: Date;

    switch (viewMode) {
      case "day":
        newDate = direction === "prev" ? subDays(date, 1) : addDays(date, 1);
        break;
      case "week":
        newDate = direction === "prev" ? subWeeks(date, 1) : addWeeks(date, 1);
        break;
      case "month":
        newDate = direction === "prev" ? subMonths(date, 1) : addMonths(date, 1);
        break;
      case "list":
        newDate = direction === "prev" ? subDays(date, 1) : addDays(date, 1);
        break;
      default:
        newDate = date;
    }

    onDateChange(format(newDate, "yyyy-MM-dd"));
  };

  const handleToday = () => {
    onDateChange(format(new Date(), "yyyy-MM-dd"));
  };

  const formatDateDisplay = () => {
    const date = parseISO(selectedDate);
    switch (viewMode) {
      case "day":
        return format(date, "d 'de' MMMM", { locale: { localize: { month: (month: number) => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][month] || '' } } as any });
      case "week":
        return `Semana del ${format(date, "d MMM", { locale: { localize: { month: (month: number) => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][month] || '' } } as any })}`;
      case "month":
        return format(date, "MMMM yyyy", { locale: { localize: { month: (month: number) => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month] || '' } } as any });
      case "list":
        return format(date, "d 'de' MMMM", { locale: { localize: { month: (month: number) => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][month] || '' } } as any });
      default:
        return "";
    }
  };

  const handleStaffToggle = (staffId: string) => {
    if (!onStaffFilterChange) return;
    const newSelection = selectedStaffIds.includes(staffId)
      ? selectedStaffIds.filter(id => id !== staffId)
      : [...selectedStaffIds, staffId];
    onStaffFilterChange(newSelection);
  };

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

  const activeFiltersCount = selectedStaffIds.length + filters.status.length + (filters.highlighted ? 1 : 0);

  const handleClearFilters = () => {
    if (onStaffFilterChange) onStaffFilterChange([]);
    if (onFiltersChange) onFiltersChange({ payment: [], status: [], staff: [], highlighted: null });
  };

  const statusColors: Record<BookingStatus, string> = {
    pending: "text-amber-400",
    paid: "text-emerald-400",
    completed: "text-[#4FE3C1]",
    cancelled: "text-red-400",
    no_show: "text-white/40",
    hold: "text-[#A06BFF]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl"
    >
      <div className="px-6 py-4 flex flex-col gap-3">
        {/* Main row: Title, Date Navigation, Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title and date - more compact */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner flex-shrink-0">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">{formatDateDisplay()}</h1>
            </div>
          </div>

          {/* Date navigation + Calendar picker + Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigate("prev")}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Fecha anterior"
            >
              <ChevronLeft className="h-4 w-4 text-white/80" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToday}
              className="px-3 h-9 rounded-xl bg-gradient-to-r from-[#4FE3C1] to-[#3A6DFF] text-sm font-semibold text-[#0E0F11] shadow-[0_10px_30px_rgba(58,109,255,0.35)]"
            >
              Hoy
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigate("next")}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Fecha siguiente"
            >
              <ChevronRight className="h-4 w-4 text-white/80" />
            </motion.button>

            {/* Calendar picker */}
            <div ref={datePickerRef} className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                aria-label="Seleccionar fecha"
              >
                <Calendar className="h-4 w-4 text-white/80" />
              </motion.button>
              
              <AnimatePresence>
                {showDatePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 right-0 z-50 rounded-xl bg-[#1A1B1F] border border-white/10 shadow-xl p-3"
                  >
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        onDateChange(e.target.value);
                        setShowDatePicker(false);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4FE3C1]/50 focus:outline-none focus:ring-2 focus:ring-[#4FE3C1]/20"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 w-px bg-white/10 hidden md:block" />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSearchClick}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 text-white/80" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNotificationsClick}
              className="relative h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4 text-white/80" />
              {unreadNotifications > 0 && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  className="absolute -top-1 -right-1 h-5 min-w-[1.1rem] px-1 rounded-full bg-gradient-to-r from-[#4FE3C1] to-[#3A6DFF] text-[10px] font-semibold text-[#0E0F11] shadow-[0_6px_16px_rgba(58,109,255,0.4)] flex items-center justify-center"
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>

        {/* View modes + Filters row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* View mode buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {viewModes.map((mode) => (
              <motion.button
                key={mode.key}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onViewModeChange(mode.key)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm font-medium transition-all border",
                  viewMode === mode.key
                    ? "bg-white text-[#0E0F11] border-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                    : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                )}
              >
                {mode.label}
              </motion.button>
            ))}
          </div>

          {/* Filter dropdowns */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Staff filter */}
            {staffList.length > 0 && (
              <FilterDropdown 
                label="Barberos" 
                icon={<Users className="h-4 w-4" />}
                badge={selectedStaffIds.length}
              >
                <div className="space-y-1">
                  <button
                    onClick={() => onStaffFilterChange && onStaffFilterChange([])}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                      selectedStaffIds.length === 0
                        ? "bg-[#4FE3C1]/20 text-[#4FE3C1] font-medium"
                        : "text-white/70 hover:bg-white/5"
                    )}
                  >
                    Todos los barberos
                  </button>
                  {staffList.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => handleStaffToggle(staff.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                        selectedStaffIds.includes(staff.id)
                          ? "bg-[#4FE3C1]/20 text-[#4FE3C1] font-medium"
                          : "text-white/70 hover:bg-white/5"
                      )}
                    >
                      <span>{staff.name}</span>
                      {selectedStaffIds.includes(staff.id) && (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              </FilterDropdown>
            )}

            {/* Status filter */}
            <FilterDropdown 
              label="Estado" 
              icon={<CheckCircle className="h-4 w-4" />}
              badge={filters.status.length}
            >
              <div className="space-y-1">
                {([
                  "pending",
                  "paid",
                  "completed",
                  "cancelled",
                  "no_show",
                  "hold",
                ] as BookingStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusToggle(status)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between",
                      filters.status.includes(status)
                        ? "bg-[#4FE3C1]/20 text-[#4FE3C1] font-medium"
                        : "text-white/70 hover:bg-white/5"
                    )}
                  >
                    <span className={filters.status.includes(status) ? "" : statusColors[status]}>
                      {BOOKING_STATUS_CONFIG[status].label}
                    </span>
                    {filters.status.includes(status) && (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </FilterDropdown>

            {/* Special filters */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleHighlightedToggle}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
                filters.highlighted
                  ? "bg-[#FF6DA3]/20 text-[#FF6DA3] border-[#FF6DA3]/30"
                  : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
              )}
            >
              <Star className="h-4 w-4" />
              <span>Destacadas</span>
            </motion.button>

            {/* Clear filters */}
            {activeFiltersCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border bg-white/5 text-white/70 border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpiar</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
