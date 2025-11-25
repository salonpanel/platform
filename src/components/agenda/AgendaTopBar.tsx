"use client";

import { motion } from "framer-motion";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Bell, Filter, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaTopBarProps {
  selectedDate: string;
  viewMode: ViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  unreadCount?: number;
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
  unreadCount = 0,
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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl"
    >
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.08em] text-white/60">Agenda</p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-semibold text-white truncate">{formatDateDisplay()}</h1>
                <span className="text-sm text-white/60 hidden sm:inline">• Vista {viewModes.find((v) => v.key === viewMode)?.label}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigate("prev")}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Fecha anterior"
            >
              <ChevronLeft className="h-4 w-4 text-white/80" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToday}
              className="px-4 h-10 rounded-xl bg-gradient-to-r from-[#4FE3C1] to-[#3A6DFF] text-sm font-semibold text-[#0E0F11] shadow-[0_10px_30px_rgba(58,109,255,0.35)]"
            >
              Hoy
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigate("next")}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Fecha siguiente"
            >
              <ChevronRight className="h-4 w-4 text-white/80" />
            </motion.button>

            <div className="h-6 w-px bg-white/10 hidden md:block" />

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSearchClick}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 text-white/80" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNotificationsClick}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
              aria-label="Notificaciones"
            >
              <div className="relative">
                <Bell className="h-4 w-4 text-white/80" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-2 -right-2 min-w-[18px] px-1.5 h-5 rounded-full bg-[#FF6DA3] text-[11px] font-semibold text-white shadow-lg shadow-[#FF6DA3]/50 flex items-center justify-center"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </div>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onFiltersClick}
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center md:hidden"
              aria-label="Filtros"
            >
              <Filter className="h-4 w-4 text-white/80" />
            </motion.button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {viewModes.map((mode) => (
            <motion.button
              key={mode.key}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onViewModeChange(mode.key)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-sm font-medium transition-all border",
                viewMode === mode.key
                  ? "bg-white text-[#0E0F11] border-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                  : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
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
