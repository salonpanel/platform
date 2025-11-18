"use client";

import { format, addWeeks, subWeeks, startOfToday } from "date-fns";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Staff, BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";

interface AgendaSidebarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  filters: {
    payment: string[];
    status: string[];
    staff: string[];
    highlighted: boolean | null;
  };
  onFiltersChange: (filters: any) => void;
  staffList: Staff[];
  onClose?: () => void;
  showFreeSlots?: boolean;
  onShowFreeSlotsChange?: (show: boolean) => void;
}

export function AgendaSidebar({
  selectedDate,
  onDateSelect,
  filters,
  onFiltersChange,
  staffList,
  onClose,
  showFreeSlots = false,
  onShowFreeSlotsChange,
}: AgendaSidebarProps) {
  const setLocalFilters = (newFilters: any) => {
    onFiltersChange(newFilters);
  };

  const handleFilterChange = (
    category: "payment" | "status" | "staff" | "highlighted",
    value: string | boolean | null
  ) => {
    const updated = { ...filters };

    if (category === "highlighted") {
      updated.highlighted = value === filters.highlighted ? null : (value as boolean);
    } else {
      const array = updated[category] as string[];
      const index = array.indexOf(value as string);
      if (index >= 0) {
        array.splice(index, 1);
      } else {
        array.push(value as string);
      }
    }

    setLocalFilters(updated);
  };

  const clearFilters = () => {
    const cleared = {
      payment: [],
      status: [],
      staff: [],
      highlighted: null,
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate);
    const newDate = direction === "next" 
      ? addWeeks(currentDate, 1)
      : subWeeks(currentDate, 1);
    onDateSelect(format(newDate, "yyyy-MM-dd"));
  };

  const goToToday = () => {
    onDateSelect(format(startOfToday(), "yyyy-MM-dd"));
  };

  return (
    <div className="h-full overflow-y-auto space-y-6 scrollbar-hide">
      {onClose && (
        <div className="flex items-center justify-between pb-5 border-b border-white/5 mb-5">
          <h3 className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">Filtros</h3>
          <button
            onClick={onClose}
            className="text-[#d1d4dc] hover:text-white p-1.5 rounded-[10px] hover:bg-white/5 transition-all duration-150"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Saltos rápidos - Premium */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-[#3A6DFF]" />
          Saltos rápidos
        </h4>
        <div className="space-y-2">
          <button
            onClick={goToToday}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/5 rounded-[10px] transition-all duration-150 text-left font-['Plus_Jakarta_Sans']"
          >
            Hoy
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => navigateWeek("prev")}
              className="flex-1 px-3 py-2 text-xs font-medium text-[#d1d4dc] hover:text-white hover:bg-white/5 border border-white/5 rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
            >
              -1 semana
            </button>
            <button
              onClick={() => navigateWeek("next")}
              className="flex-1 px-3 py-2 text-xs font-medium text-[#d1d4dc] hover:text-white hover:bg-white/5 border border-white/5 rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
            >
              +1 semana
            </button>
          </div>
        </div>
      </div>

      {/* Mini calendario - Premium */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-[#4FE3C1]" />
          Calendario
        </h4>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateSelect(e.target.value)}
          className="w-full rounded-[10px] px-4 py-3 text-sm font-semibold text-white bg-white/5 border border-white/5 hover:border-[#3A6DFF]/30 focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
        />
      </div>

      {/* Filtros - Premium */}
      <div className="space-y-5">
        {/* Pagos */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[#A06BFF]" />
            Pagos
          </h4>
          <div className="space-y-2">
            {["paid", "unpaid"].map((option) => (
              <label
                key={option}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.payment.includes(option)}
                  onChange={() => handleFilterChange("payment", option)}
                  className="w-4 h-4 rounded-[8px] border-white/20 bg-white/3 text-[#3A6DFF] focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150"
                />
                <span className="text-sm text-[#d1d4dc] group-hover:text-white transition-colors duration-150 font-medium capitalize font-['Plus_Jakarta_Sans']">
                  {option === "paid" ? "Pagado" : "Sin pagar"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Estado de la cita */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[#FF6DA3]" />
            Estado de la cita
          </h4>
          <div className="space-y-2">
            {([
              "pending",
              "paid",
              "completed",
              "cancelled",
              "no_show",
              "hold",
            ] as BookingStatus[]).map((status) => (
              <label
                key={status}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.status.includes(status)}
                  onChange={() => handleFilterChange("status", status)}
                  className="w-4 h-4 rounded-[8px] border-white/20 bg-white/3 text-[#3A6DFF] focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150"
                />
                <span className="text-sm text-[#d1d4dc] group-hover:text-white transition-colors duration-150 font-medium font-['Plus_Jakarta_Sans']">
                  {BOOKING_STATUS_CONFIG[status].label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Empleado */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[#3A6DFF]" />
            Empleado
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.staff.includes("all")}
                onChange={() => handleFilterChange("staff", "all")}
                className="w-4 h-4 rounded-[8px] border-white/20 bg-white/3 text-[#3A6DFF] focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150"
              />
              <span className="text-sm text-[#d1d4dc] group-hover:text-white transition-colors duration-150 font-medium font-['Plus_Jakarta_Sans']">
                Todos
              </span>
            </label>
            {staffList.map((staff) => (
              <label
                key={staff.id}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.staff.includes(staff.id)}
                  onChange={() => handleFilterChange("staff", staff.id)}
                  className="w-4 h-4 rounded-[8px] border-white/20 bg-white/3 text-[#3A6DFF] focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150"
                />
                <span className="text-sm text-[#d1d4dc] group-hover:text-white transition-colors duration-150 font-medium font-['Plus_Jakarta_Sans']">
                  {staff.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Detalles */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[#4FE3C1]" />
            Detalles
          </h4>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.highlighted === true}
              onChange={() => handleFilterChange("highlighted", true)}
              className="w-4 h-4 rounded-[8px] border-white/20 bg-white/3 text-[#3A6DFF] focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150"
            />
            <span className="text-sm text-[#d1d4dc] group-hover:text-white transition-colors duration-150 font-medium font-['Plus_Jakarta_Sans']">
              Marcadas como destacadas
            </span>
          </label>
          {onShowFreeSlotsChange && (
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={showFreeSlots}
                onChange={(e) => onShowFreeSlotsChange(e.target.checked)}
                className="w-4 h-4 rounded-[8px] border-white/20 bg-white/3 text-[#3A6DFF] focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150"
              />
              <span className="text-sm text-[#d1d4dc] group-hover:text-white transition-colors duration-150 font-medium font-['Plus_Jakarta_Sans']">
                Mostrar solo huecos libres
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Leyenda - Premium */}
      <div className="pt-5 border-t border-white/5 space-y-3">
        <h4 className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans'] flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-[#4FE3C1]" />
          Leyenda de estados
        </h4>
        <div className="space-y-2">
          {([
            "hold",
            "pending",
            "paid",
            "completed",
            "cancelled",
            "no_show",
          ] as BookingStatus[]).map((status) => {
            const config = BOOKING_STATUS_CONFIG[status];
            return (
              <div key={status} className="flex items-center gap-3 p-2 rounded-[10px] hover:bg-white/3 transition-colors duration-150">
                <div
                  className="w-4 h-4 rounded border-l-[3px]"
                  style={{
                    backgroundColor: config.legendBg,
                    borderLeftColor: config.legendBorder.includes("/") 
                      ? config.legendBorder.split("/")[0] 
                      : config.legendBorder,
                    boxShadow: `0px 0px 6px ${config.legendColor}30`,
                  }}
                />
                <span className="text-xs text-white font-semibold font-['Plus_Jakarta_Sans']">
                  {config.label}
                </span>
              </div>
            );
          })}
          {/* Bloqueo (no es un estado de booking, pero se muestra en la leyenda) */}
          <div className="flex items-center gap-3 p-2 rounded-[10px] hover:bg-white/3 transition-colors duration-150">
            <div
              className="w-4 h-4 rounded border-l-[3px]"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                borderLeftColor: "rgba(255,255,255,0.1)",
                boxShadow: `0px 0px 6px rgba(156,163,175,0.3)`,
              }}
            />
            <span className="text-xs text-white font-semibold font-['Plus_Jakarta_Sans']">
              Bloqueo
            </span>
          </div>
        </div>
      </div>

      {/* Botones de acción - Premium */}
      <div className="pt-5 border-t border-white/5 space-y-2">
        <button
          onClick={() => {
            // Los filtros ya se aplican automáticamente al cambiar el estado
          }}
          className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] hover:shadow-[0px_4px_12px_rgba(58,109,255,0.3)] rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
        >
          Aplicar filtros
        </button>
        <button
          onClick={clearFilters}
          className="w-full px-4 py-2.5 text-sm font-medium text-[#d1d4dc] hover:text-white hover:bg-white/5 border border-white/5 rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
        >
          Limpiar todo
        </button>
      </div>
    </div>
  );
}
