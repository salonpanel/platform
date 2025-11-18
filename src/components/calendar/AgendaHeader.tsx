"use client";

import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Settings, Bell, Search, Filter, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SearchPanel } from "./SearchPanel";

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
      {/* Premium Header con glassmorphism */}
      <div className="bg-[#15171A] rounded-2xl border border-white/5 backdrop-blur-md shadow-[0px_4px_20px_rgba(0,0,0,0.15)] px-5 py-4">
        <div className="flex flex-col gap-4">
          {/* Primera fila: Navegación y acciones */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Navegación de fechas */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={handlePrevious}
                className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
                aria-label="Fecha anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                onClick={handleToday}
                className="px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
              >
                Hoy
              </button>

              <button
                onClick={handleNext}
                className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
                aria-label="Fecha siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Selector de calendario */}
              <button
                onClick={onCalendarClick}
                className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150 ml-1"
                aria-label="Seleccionar fecha"
              >
                <CalendarIcon className="h-5 w-5" />
              </button>

              {/* Fecha actual - Premium badge */}
              <motion.div
                className="ml-3 px-4 py-2 rounded-[14px] bg-[rgba(58,109,255,0.12)] border border-[rgba(58,109,255,0.25)] backdrop-blur-sm min-w-0"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15 }}
              >
                <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] tracking-tight truncate">
                  {getDateLabel()}
                </div>
                {timeRange && viewMode === "day" && (
                  <div className="text-[10px] text-[#d1d4dc] font-mono mt-0.5 opacity-80">
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
                  className="lg:hidden p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
                  aria-label="Filtros"
                >
                  <Filter className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onSearchClick}
                className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                onClick={onNotificationsClick}
                className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150 relative"
                aria-label="Notificaciones"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full border-2 border-[#15171A]" />
              </button>
              <button
                onClick={() => router.push("/panel/ajustes")}
                className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
                aria-label="Ajustes"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Segunda fila: Selector de vista y quick stats */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">Vista</span>
              <div className="flex items-center gap-1 rounded-2xl p-1 bg-white/3 border border-white/5 relative overflow-hidden">
                {viewModes.map((mode) => (
                  <motion.button
                    key={mode.value}
                    onClick={() => onViewModeChange(mode.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative px-4 py-2 text-xs font-semibold font-['Plus_Jakarta_Sans'] rounded-xl transition-all duration-150",
                      viewMode === mode.value ? "text-white" : "text-[#d1d4dc] hover:text-white"
                    )}
                  >
                    {viewMode === mode.value && (
                      <motion.span
                        layoutId="viewModeHighlight"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] shadow-[0px_2px_8px_rgba(58,109,255,0.3)]"
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
                <div className="flex items-center gap-3 text-xs font-['Plus_Jakarta_Sans']">
                  {quickStats.rangeLabel && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-white/3 border border-white/5">
                      <span className="text-[#9ca3af]">Rango:</span>
                      <span className="text-white font-semibold">{quickStats.rangeLabel}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-white/3 border border-white/5">
                    <span className="text-[#9ca3af]">Citas:</span>
                    <span className="text-white font-semibold">{quickStats.totalBookings}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-white/3 border border-white/5">
                    <span className="text-[#9ca3af]">Tiempo:</span>
                    <span className="text-white font-semibold">{quickStats.totalHours}h</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-white/3 border border-white/5">
                    <span className="text-[#9ca3af]">Total:</span>
                    <span className="text-white font-semibold">{(quickStats.totalAmount / 100).toFixed(2)} €</span>
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
                        return "bg-[rgba(58,109,255,0.12)] border-[#3A6DFF]/30 text-[#3A6DFF] hover:bg-[rgba(58,109,255,0.18)]";
                      } else if (util < 80) {
                        return "bg-[rgba(79,227,193,0.12)] border-[#4FE3C1]/30 text-[#4FE3C1] hover:bg-[rgba(79,227,193,0.18)]";
                      } else {
                        return "bg-[rgba(255,193,7,0.12)] border-[#FFC107]/30 text-[#FFC107] hover:bg-[rgba(255,193,7,0.18)]";
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-[10px] border text-xs font-semibold transition-all cursor-pointer font-['Plus_Jakarta_Sans'] ${getUtilizationColor(staff.utilization)}`}
                        title={`Filtrar por ${staff.staffName} (${staff.utilization}% utilizado)`}
                        aria-label={`Filtrar por ${staff.staffName}, ${staff.utilization}% utilizado`}
                      >
                        <div className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {getInitials(staff.staffName)}
                        </div>
                        <span className="truncate max-w-[80px]">{staff.staffName}</span>
                        <span className="font-mono flex-shrink-0">{staff.utilization}%</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
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
