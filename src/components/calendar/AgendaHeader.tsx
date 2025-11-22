"use client";

import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Settings, Bell, Search, Filter, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SearchPanel } from "./SearchPanel";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { theme } from "@/theme/ui";

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
  // Parsear fecha desde selectedDate = "yyyy-MM-dd" usando parseISO para robustez
  const date = parseISO(selectedDate);
  
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

  return (
    <div className="w-full">
      {/* Premium Header with GlassCard */}
      <GlassCard variant="elevated" padding="lg" className="w-full">
        <div className="flex flex-col gap-4">
          {/* Primera fila: Navegación y acciones */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Navegación de fechas */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={handlePrevious}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150",
                  "text-secondary hover:text-primary hover:bg-glass"
                )}
                aria-label="Fecha anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                onClick={handleToday}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-150",
                  "text-primary hover:bg-glass font-sans"
                )}
              >
                Hoy
              </button>

              <button
                onClick={handleNext}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150",
                  "text-secondary hover:text-primary hover:bg-glass"
                )}
                aria-label="Fecha siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Selector de calendario */}
              <button
                onClick={onCalendarClick}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150 ml-1",
                  "text-secondary hover:text-primary hover:bg-glass"
                )}
                aria-label="Seleccionar fecha"
              >
                <CalendarIcon className="h-5 w-5" />
              </button>

              {/* Fecha actual - Premium badge */}
              <motion.div
                className={cn(
                  "ml-3 px-4 py-2 rounded-xl backdrop-blur-sm min-w-0",
                  "bg-accent-blue/10 border border-accent-blue/25"
                )}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15 }}
              >
                <div className={cn(
                  "text-sm font-semibold truncate tracking-tight",
                  "text-primary font-sans"
                )}>
                  {getDateLabel()}
                </div>
                {timeRange && viewMode === "day" && (
                  <div className={cn(
                    "text-xs font-mono mt-0.5 opacity-80",
                    "text-secondary"
                  )}>
                    {timeRange}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Acciones integradas */}
            <div className="flex items-center gap-2">
              {showFiltersButton && (
                <button
                  onClick={onFiltersClick}
                  className={cn(
                    "lg:hidden p-2 rounded-xl transition-all duration-150",
                    "text-secondary hover:text-primary hover:bg-glass"
                  )}
                  aria-label="Filtros"
                >
                  <Filter className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onSearchClick}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150",
                  "text-secondary hover:text-primary hover:bg-glass"
                )}
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                onClick={onNotificationsClick}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150 relative",
                  "text-secondary hover:text-primary hover:bg-glass"
                )}
                aria-label="Notificaciones"
              >
                <Bell className="h-5 w-5" />
                <span className={cn(
                  "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2",
                  "bg-status-cancelled border-primary"
                )} />
              </button>
              <button
                onClick={() => router.push("/panel/ajustes")}
                className={cn(
                  "p-2 rounded-xl transition-all duration-150",
                  "text-secondary hover:text-primary hover:bg-glass"
                )}
                aria-label="Ajustes"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Segunda fila: Selector de vista y quick stats */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                "text-tertiary font-sans"
              )}>
                Vista
              </span>
              <div className={cn(
                "flex items-center gap-1 rounded-2xl p-1",
                "bg-glass border border-border-default"
              )}>
                {viewModes.map((mode) => (
                  <motion.button
                    key={mode.value}
                    onClick={() => onViewModeChange(mode.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-150",
                      "font-sans",
                      viewMode === mode.value ? "text-primary" : "text-secondary hover:text-primary"
                    )}
                  >
                    {viewMode === mode.value && (
                      <motion.span
                        layoutId="viewModeHighlight"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent-blue to-accent-aqua shadow-accent-blue/30"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{mode.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Quick Stats y Utilización */}
            <div className="flex items-center gap-3 flex-wrap">
              {quickStats && (
                <div className="flex items-center gap-3 text-xs font-sans">
                  {quickStats.rangeLabel && (
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                      "bg-glass border border-border-default"
                    )}>
                      <span className="text-tertiary">Rango:</span>
                      <span className="text-primary font-semibold">{quickStats.rangeLabel}</span>
                    </div>
                  )}
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                    "bg-glass border border-border-default"
                  )}>
                    <span className="text-tertiary">Citas:</span>
                    <span className="text-primary font-semibold">{quickStats.totalBookings}</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                    "bg-glass border border-border-default"
                  )}>
                    <span className="text-tertiary">Tiempo:</span>
                    <span className="text-primary font-semibold">{quickStats.totalHours}h</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl",
                    "bg-glass border border-border-default"
                  )}>
                    <span className="text-tertiary">Total:</span>
                    <span className="text-primary font-semibold">{(quickStats.totalAmount / 100).toFixed(2)} €</span>
                  </div>
                </div>
              )}
              
              {/* Chips de utilización por staff */}
              {staffUtilization && staffUtilization.length > 0 && onStaffFilterChange && (
                <div className="flex items-center gap-2 flex-wrap">
                  {staffUtilization.map((staff) => {
                    // Color según % de utilización
                    const getUtilizationColor = (util: number) => {
                      if (util < 40) {
                        return "bg-accent-blue/10 border-accent-blue/25 text-accent-blue hover:bg-accent-blue/15";
                      } else if (util < 80) {
                        return "bg-accent-aqua/10 border-accent-aqua/25 text-accent-aqua hover:bg-accent-aqua/15";
                      } else {
                        return "bg-status-pending/10 border-status-pending/25 text-status-pending hover:bg-status-pending/15";
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
                          "font-sans",
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
