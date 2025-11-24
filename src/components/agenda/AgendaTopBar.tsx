"use client";

import { motion } from "framer-motion";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Bell, Filter, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { UiButton } from "@/components/ui/apple-ui-kit";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaTopBarProps {
  selectedDate: string;
  viewMode: ViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  onFiltersClick?: () => void;
}

/**
 * AgendaTopBar - Sticky top header with Apple-like design
 * Contains date navigation, view mode tabs, and action buttons
 */
export function AgendaTopBar({
  selectedDate,
  viewMode,
  onDateChange,
  onViewModeChange,
  onSearchClick,
  onNotificationsClick,
  onFiltersClick,
}: AgendaTopBarProps) {
  const viewModes: { key: ViewMode; label: string }[] = [
    { key: "day", label: "Día" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "list", label: "Lista" },
  ];

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
        return format(date, "EEEE, d 'de' MMMM", { locale: { localize: { day: (day: number) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][day] || '', month: (month: number) => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][month] || '' } } as any });
      case "week":
        return `Semana del ${format(date, "d MMM", { locale: { localize: { month: (month: number) => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][month] || '' } } as any })}`;
      case "month":
        return format(date, "MMMM yyyy", { locale: { localize: { month: (month: number) => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month] || '' } } as any });
      case "list":
        return format(date, "EEEE, d 'de' MMMM", { locale: { localize: { day: (day: number) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][day] || '', month: (month: number) => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][month] || '' } } as any });
      default:
        return "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[rgba(10,15,20,0.85)] backdrop-blur-xl"
    >
      <div className="px-4 py-2.5">
        {/* Top Row: Date Navigation - Espaciado más compacto */}
        <div className="flex items-center justify-between gap-3 mb-2">
          {/* Date Controls */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigate("prev")}
              className="p-1.5 rounded-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200 flex-shrink-0"
              aria-label="Fecha anterior"
            >
              <ChevronLeft className="h-4 w-4 text-[rgba(255,255,255,0.7)]" />
            </motion.button>

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Calendar className="h-4 w-4 text-[rgba(255,255,255,0.5)] flex-shrink-0" />
              <span className="text-sm font-semibold text-white truncate">
                {formatDateDisplay()}
              </span>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigate("next")}
              className="p-1.5 rounded-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200 flex-shrink-0"
              aria-label="Fecha siguiente"
            >
              <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.7)]" />
            </motion.button>
          </div>

          {/* Today Button + Actions - Más compactos */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-medium rounded-[10px] bg-[rgba(79,227,193,0.15)] border border-[rgba(79,227,193,0.3)] text-[#4FE3C1] hover:bg-[rgba(79,227,193,0.25)] transition-all duration-200"
            >
              Hoy
            </motion.button>

            {/* Mobile Filters Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onFiltersClick}
              className="md:hidden p-1.5 rounded-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
              aria-label="Filtros"
            >
              <Filter className="h-4 w-4 text-[rgba(255,255,255,0.7)]" />
            </motion.button>

            {/* Search Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSearchClick}
              className="p-1.5 rounded-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 text-[rgba(255,255,255,0.7)]" />
            </motion.button>

            {/* Notifications Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNotificationsClick}
              className="p-1.5 rounded-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4 text-[rgba(255,255,255,0.7)]" />
            </motion.button>
          </div>
        </div>

        {/* Bottom Row: View Mode Tabs - Más integrados */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {viewModes.map((mode) => (
            <motion.button
              key={mode.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onViewModeChange(mode.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-[8px] transition-all duration-200 whitespace-nowrap flex-shrink-0",
                viewMode === mode.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.8)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white"
              )}
            >
              {mode.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
