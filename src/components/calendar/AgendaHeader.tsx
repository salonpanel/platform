"use client";

import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isSameDay } from "date-fns";
import { Settings, Bell, Search, Filter, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SearchPanel } from "./SearchPanel";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { theme } from "@/theme/ui";
import { useState } from "react";
import { useResponsive } from "@/hooks/useResponsive";
import { GlassButton } from "@/components/ui/glass/GlassButton";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaHeaderProps {
  selectedDate: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onDateChange: (date: string) => void;
  timeRange?: string;
  onNotificationsClick: () => void;
  onSearchClick: () => void;
  onFiltersClick?: () => void;
  onCalendarClick?: () => void;
  showFiltersButton?: boolean;
  quickStats?: {
    totalBookings: number;
    totalHours: number;
    totalAmount: number;
    rangeLabel?: string;
  };
  searchOpen?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onSearchClose?: () => void;
  searchResultCount?: number;
  searchTotalCount?: number;
  staffUtilization?: Array<{
    staffId: string;
    staffName: string;
    utilization: number;
  }>;
  onStaffFilterChange?: (staffId: string) => void;
}

export function AgendaHeader({
  selectedDate,
  viewMode,
  onViewModeChange,
  onDateChange,
  timeRange = "9:00 – 19:00",
  onNotificationsClick,
  onSearchClick,
  onFiltersClick,
  onCalendarClick,
  showFiltersButton = false,
  quickStats,
  searchOpen = false,
  searchTerm = "",
  onSearchChange,
  onSearchClose,
  searchResultCount,
  searchTotalCount,
  staffUtilization,
  onStaffFilterChange,
}: AgendaHeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  // Parsear fecha desde selectedDate = "yyyy-MM-dd" usando parseISO para robustez
  const date = parseISO(selectedDate);
  const isToday = isSameDay(date, new Date());

  const getDateLabel = () => {
    switch (viewMode) {
      case "day":
        return format(date, "EEEE, d 'de' MMMM");
      case "week":
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return `${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM yyyy")}`;
      case "month":
        return format(date, "MMMM yyyy");
      case "list":
        return format(date, "EEEE, d 'de' MMMM");
      default:
        return format(date, "EEEE, d 'de' MMMM");
    }
  };

  const handlePrevious = () => {
    let newDate: Date;
    switch (viewMode) {
      case "day":
        newDate = subDays(date, 1);
        break;
      case "week":
        newDate = subWeeks(date, 1);
        break;
      case "month":
        newDate = subMonths(date, 1);
        break;
      default:
        newDate = subDays(date, 1);
    }
    onDateChange(format(newDate, "yyyy-MM-dd"));
  };

  const handleNext = () => {
    let newDate: Date;
    switch (viewMode) {
      case "day":
        newDate = addDays(date, 1);
        break;
      case "week":
        newDate = addWeeks(date, 1);
        break;
      case "month":
        newDate = addMonths(date, 1);
        break;
      default:
        newDate = addDays(date, 1);
    }
    onDateChange(format(newDate, "yyyy-MM-dd"));
  };

  const handleToday = () => {
    onDateChange(format(new Date(), "yyyy-MM-dd"));
  };

  const viewModes: { value: ViewMode; label: string }[] = [
    { value: "day", label: "Día" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "list", label: "Lista" },
  ];

  /* 
    PHASE C: SIMPLIFIED MOBILE HEADER logic
    We use useResponsive to conditionally render a much simpler header on mobile.
  */
  const { isMobile } = useResponsive();

  /* --------------------------------------------------------------------------------
   * MOBILE VIEW (Simplified)
   * -------------------------------------------------------------------------------- */
  if (isMobile) {
    return (
      <div className="w-full">
        <GlassCard variant="elevated" padding="md" className="w-full">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Menu & Date (Compact) */}
            <div className="flex items-center gap-3">
              <GlassButton
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                variant="ghost"
                size="icon"
                className="-ml-2 text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </GlassButton>

              <button
                onClick={handleToday}
                className="flex flex-col text-left active:opacity-70 transition-opacity"
                aria-label="Volver a hoy"
              >
                <span className="text-sm font-bold text-[var(--bf-ink-50)] font-[var(--font-sans)] leading-none">
                  {format(date, "d MMM")}
                </span>
                <span className="text-[10px] text-[var(--bf-ink-400)] uppercase tracking-wider font-semibold">
                  {format(date, "EEEE")}
                </span>
              </button>
            </div>

            {/* Right: Actions (New Booking + Search) */}
            <div className="flex items-center gap-1">
              <GlassButton
                onClick={onSearchClick}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </GlassButton>
              {/* Primary Action Button (Add) could be added here if not handled by FAB */}
            </div>
          </div>

          {/* Collapsible Mobile Menu for Secondary Controls */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden border-t border-[var(--bf-border)] mt-3 pt-3"
              >
                {/* View Selector */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
                  {viewModes.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => {
                        onViewModeChange(mode.value);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors",
                        viewMode === mode.value
                          ? "bg-[rgba(79,161,216,0.10)] text-[var(--bf-primary)] border border-[rgba(79,161,216,0.25)]"
                          : "bg-[var(--glass-bg-subtle)] text-[var(--bf-ink-300)] border border-transparent"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Secondary Actions Row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <GlassButton onClick={handlePrevious} variant="secondary" size="icon" className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </GlassButton>
                    <GlassButton onClick={handleToday} variant="secondary" size="sm" className="h-8 text-xs">
                      Hoy
                    </GlassButton>
                    <GlassButton onClick={handleNext} variant="secondary" size="icon" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </GlassButton>
                  </div>

                  <GlassButton
                    onClick={onNotificationsClick}
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs gap-2"
                  >
                    <Bell className="h-4 w-4" />
                    <span>Avisos</span>
                  </GlassButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Search Panel Overlay */}
        {searchOpen && onSearchChange && onSearchClose && (
          <div className="mt-2">
            <SearchPanel
              isOpen={searchOpen}
              onClose={onSearchClose}
              searchTerm={searchTerm || ""}
              onSearchChange={onSearchChange}
              resultCount={searchResultCount}
              totalCount={searchTotalCount}
            />
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------------------------------------------------------
   * DESKTOP/TABLET VIEW (Existing Premium Header)
   * -------------------------------------------------------------------------------- */
  return (
    <div className="w-full">
      {/* Premium Header with GlassCard - Mobile First */}
      <GlassCard variant="elevated" padding="lg" className="w-full">
        <div className="flex flex-col gap-4">
          {/* Date Navigation (Centered on mobile, left-aligned on desktop) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Date Navigation Controls */}
            <div className="flex items-center justify-center sm:justify-start gap-2 min-w-0 flex-1">
              <GlassButton
                onClick={handlePrevious}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Fecha anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </GlassButton>

              <GlassButton
                onClick={isToday ? undefined : handleToday}
                variant="secondary"
                size="sm"
                className={cn(
                  "font-[var(--font-sans)] transition-opacity duration-150",
                  isToday && "opacity-40 cursor-default pointer-events-none"
                )}
                aria-current={isToday ? "date" : undefined}
                aria-label={isToday ? "Ya estás en hoy" : "Ir a hoy"}
              >
                Hoy
              </GlassButton>

              <GlassButton
                onClick={handleNext}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Fecha siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </GlassButton>

              {/* Calendar Picker */}
              <GlassButton
                onClick={onCalendarClick}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Seleccionar fecha"
              >
                <CalendarIcon className="h-5 w-5" />
              </GlassButton>

              {/* Date Badge - Premium styling */}
              <motion.div
                className={cn(
                  "ml-0 sm:ml-3 px-4 py-2.5 rounded-xl backdrop-blur-md min-w-0 flex-1 sm:flex-initial",
                  "bg-gradient-to-r from-[rgba(79,161,216,0.08)] to-[rgba(79,161,216,0.06)]",
                  "border border-[rgba(79,161,216,0.25)] shadow-[var(--bf-shadow-card)]"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn(
                  "text-sm font-semibold truncate tracking-tight text-center sm:text-left",
                  "text-[var(--bf-ink-50)] font-[var(--font-sans)]"
                )}>
                  {getDateLabel()}
                </div>
                {timeRange && viewMode === "day" && (
                  <div className={cn(
                    "text-xs font-mono mt-0.5 opacity-80 text-center sm:text-left",
                    "text-[var(--bf-ink-300)] font-[var(--font-sans)]"
                  )}>
                    {timeRange}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Mobile Menu Toggle */}
            <GlassButton
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="ghost"
              size="icon"
              className="sm:hidden text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </GlassButton>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-2">
              {showFiltersButton && (
                <GlassButton
                  onClick={onFiltersClick}
                  variant="ghost"
                  size="icon"
                  className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                  aria-label="Filtros"
                >
                  <Filter className="h-5 w-5" />
                </GlassButton>
              )}
              <GlassButton
                onClick={onSearchClick}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </GlassButton>
              <GlassButton
                onClick={onNotificationsClick}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] relative"
                aria-label="Notificaciones"
              >
                <Bell className="h-5 w-5" />
                <span className={cn(
                  "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2",
                  "bg-[var(--bf-danger)] border-[var(--bf-bg)]"
                )} />
              </GlassButton>
              <GlassButton
                onClick={() => router.push("/panel/ajustes")}
                variant="ghost"
                size="icon"
                className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                aria-label="Ajustes"
              >
                <Settings className="h-5 w-5" />
              </GlassButton>
            </div>
          </div>

          {/* Mobile Actions Drawer */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="sm:hidden overflow-hidden"
              >
                <div className="flex items-center justify-center gap-3 py-2 border-t border-[var(--bf-border)]">
                  {/* Actions in drawer */}
                  {showFiltersButton && (
                    <GlassButton
                      onClick={onFiltersClick}
                      variant="ghost"
                      size="icon"
                      className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                      aria-label="Filtros"
                    >
                      <Filter className="h-5 w-5" />
                    </GlassButton>
                  )}
                  <GlassButton onClick={onSearchClick} variant="ghost" size="icon" className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"><Search className="h-5 w-5" /></GlassButton>
                  <GlassButton onClick={onNotificationsClick} variant="ghost" size="icon" className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] relative">
                    <Bell className="h-5 w-5" />
                    <span className={cn(
                      "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2",
                      "bg-[var(--bf-danger)] border-[var(--bf-bg)]"
                    )} />
                  </GlassButton>
                  <GlassButton onClick={() => router.push("/panel/ajustes")} variant="ghost" size="icon" className="text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"><Settings className="h-5 w-5" /></GlassButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile-First: View Mode Selector (Full-width on mobile) */}
          <div className="flex flex-col gap-4">
            {/* View Mode Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                <span className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  "text-[var(--bf-ink-400)] font-[var(--font-sans)]"
                )}>
                  Vista
                </span>
                <div className={cn(
                  "flex items-center gap-1 rounded-2xl p-1 flex-1 sm:flex-initial",
                  "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                )}>
                  {viewModes.map((mode) => (
                    <motion.button
                      key={mode.value}
                      onClick={() => onViewModeChange(mode.value)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "relative flex-1 sm:flex-initial px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-200",
                        "font-[var(--font-sans)]",
                        viewMode === mode.value
                          ? "text-[var(--bf-ink-50)]"
                          : "text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]"
                      )}
                    >
                      {viewMode === mode.value && (
                        <motion.span
                          layoutId="viewModeHighlight"
                          className={cn(
                            "absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--bf-success)] to-[var(--bf-primary)]",
                            "shadow-[var(--bf-shadow-card)]"
                          )}
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{mode.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Mobile Stats Toggle */}
              {quickStats && (
                <button
                  onClick={() => setStatsExpanded(!statsExpanded)}
                  className={cn(
                    "sm:hidden flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
                    "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]",
                    "text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)]",
                    "active:scale-95"
                  )}
                  aria-expanded={statsExpanded}
                  aria-controls="stats-section"
                >
                  <span className="text-xs font-semibold font-[var(--font-sans)]">
                    Estadísticas
                  </span>
                  <motion.div
                    animate={{ rotate: statsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                </button>
              )}
            </div>

            {/* Collapsible Stats Section - Always visible on desktop, collapsible on mobile */}
            <div
              id="stats-section"
              className={cn(
                "overflow-hidden",
                "sm:block" // Always visible on desktop
              )}
            >
              <AnimatePresence>
                {(statsExpanded || !quickStats) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="sm:block" // Override animation on desktop
                  >
                    <div className="hidden sm:block"> {/* Desktop: Always show */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Quick Stats */}
                        {quickStats && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs font-[var(--font-sans)]">
                            {quickStats.rangeLabel && (
                              <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                                "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                              )}>
                                <span className="text-[var(--bf-ink-400)]">Rango:</span>
                                <span className="text-[var(--bf-ink-50)] font-semibold">{quickStats.rangeLabel}</span>
                              </div>
                            )}
                            <div className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                              "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                            )}>
                              <span className="text-[var(--bf-ink-400)]">Citas:</span>
                              <span className="text-[var(--bf-ink-50)] font-semibold">{quickStats.totalBookings}</span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                              "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                            )}>
                              <span className="text-[var(--bf-ink-400)]">Tiempo:</span>
                              <span className="text-[var(--bf-ink-50)] font-semibold">{quickStats.totalHours}h</span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                              "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                            )}>
                              <span className="text-[var(--bf-ink-400)]">Total:</span>
                              <span className="text-[var(--bf-ink-50)] font-semibold">{(quickStats.totalAmount / 100).toFixed(2)} €</span>
                            </div>
                          </div>
                        )}

                        {/* Staff Utilization Chips */}
                        {staffUtilization && staffUtilization.length > 0 && onStaffFilterChange && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {staffUtilization.map((staff) => {
                              // Color según % de utilización
                              const getUtilizationColor = (util: number) => {
                                if (util < 40) {
                                  return "bg-[rgba(79,161,216,0.10)] border-[rgba(79,161,216,0.25)] text-[var(--bf-primary)] hover:bg-[rgba(79,161,216,0.18)]";
                                } else if (util < 80) {
                                  return "bg-[rgba(79,161,216,0.10)] border-[rgba(79,161,216,0.25)] text-[var(--bf-primary)] hover:bg-[rgba(79,161,216,0.18)]";
                                } else {
                                  return "bg-[var(--bf-warn)]/10 border-[var(--bf-warn)]/25 text-[var(--bf-warn)] hover:bg-[var(--bf-warn)]/15";
                                }
                              };

                              // Obtener iniciales del nombre
                              const getInitials = (name: string) => {
                                const parts = name.trim().split(" ");
                                if (parts.length >= 2) {
                                  return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
                                }
                                return name.slice(0, 2).toUpperCase();
                              };

                              return (
                                <motion.button
                                  key={staff.staffId}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => onStaffFilterChange(staff.staffId)}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                                    "font-[var(--font-sans)]",
                                    getUtilizationColor(staff.utilization)
                                  )}
                                  title={`Filtrar por ${staff.staffName} (${staff.utilization}% utilizado)`}
                                  aria-label={`Filtrar por ${staff.staffName}, ${staff.utilization}% utilizado`}
                                >
                                  <div className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {getInitials(staff.staffName)}
                                  </div>
                                  <span className="truncate max-w-20">{staff.staffName}</span>
                                  <span className="font-mono flex-shrink-0">{staff.utilization}%</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile: Collapsible content */}
                    <div className="sm:hidden">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Quick Stats */}
                        {quickStats && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs font-[var(--font-sans)]">
                            {quickStats.rangeLabel && (
                              <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                                "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                              )}>
                                <span className="text-[var(--bf-ink-400)]">Rango:</span>
                                <span className="text-[var(--bf-ink-50)] font-semibold">{quickStats.rangeLabel}</span>
                              </div>
                            )}
                            <div className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                              "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                            )}>
                              <span className="text-[var(--bf-ink-400)]">Citas:</span>
                              <span className="text-[var(--bf-ink-50)] font-semibold">{quickStats.totalBookings}</span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                              "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                            )}>
                              <span className="text-[var(--bf-ink-400)]">Tiempo:</span>
                              <span className="text-[var(--bf-ink-50)] font-semibold">{quickStats.totalHours}h</span>
                            </div>
                            <div className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                              "bg-[var(--bf-bg-elev)] border border-[var(--bf-border)]"
                            )}>
                              <span className="text-[var(--bf-ink-400)]">Total:</span>
                              <span className="text-[var(--bf-ink-50)] font-semibold">{(quickStats.totalAmount / 100).toFixed(2)} €</span>
                            </div>
                          </div>
                        )}

                        {/* Staff Utilization Chips */}
                        {staffUtilization && staffUtilization.length > 0 && onStaffFilterChange && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {staffUtilization.map((staff) => {
                              // Color según % de utilización
                              const getUtilizationColor = (util: number) => {
                                if (util < 40) {
                                  return "bg-[rgba(79,161,216,0.10)] border-[rgba(79,161,216,0.25)] text-[var(--bf-primary)] hover:bg-[rgba(79,161,216,0.18)]";
                                } else if (util < 80) {
                                  return "bg-[rgba(79,161,216,0.10)] border-[rgba(79,161,216,0.25)] text-[var(--bf-primary)] hover:bg-[rgba(79,161,216,0.18)]";
                                } else {
                                  return "bg-[var(--bf-warn)]/10 border-[var(--bf-warn)]/25 text-[var(--bf-warn)] hover:bg-[var(--bf-warn)]/15";
                                }
                              };

                              // Obtener iniciales del nombre
                              const getInitials = (name: string) => {
                                const parts = name.trim().split(" ");
                                if (parts.length >= 2) {
                                  return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
                                }
                                return name.slice(0, 2).toUpperCase();
                              };

                              return (
                                <motion.button
                                  key={staff.staffId}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => onStaffFilterChange(staff.staffId)}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                                    "font-[var(--font-sans)]",
                                    getUtilizationColor(staff.utilization)
                                  )}
                                  title={`Filtrar por ${staff.staffName} (${staff.utilization}% utilizado)`}
                                  aria-label={`Filtrar por ${staff.staffName}, ${staff.utilization}% utilizado`}
                                >
                                  <div className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {getInitials(staff.staffName)}
                                  </div>
                                  <span className="truncate max-w-20">{staff.staffName}</span>
                                  <span className="font-mono flex-shrink-0">{staff.utilization}%</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Search Panel */}
      {searchOpen && onSearchChange && onSearchClose && (
        <div className="relative mt-2">
          <SearchPanel
            isOpen={searchOpen}
            onClose={onSearchClose}
            searchTerm={searchTerm || ""}
            onSearchChange={onSearchChange}
            resultCount={searchResultCount}
            totalCount={searchTotalCount}
          />
        </div>
      )}
    </div>
  );
}
