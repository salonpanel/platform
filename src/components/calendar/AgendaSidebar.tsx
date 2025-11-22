"use client";

import { format, addWeeks, subWeeks, startOfToday } from "date-fns";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Staff, BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { theme } from "@/theme/ui";

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
        <GlassCard variant="inset" padding="md" className="flex items-center justify-between">
          <h3 className={cn(
            "text-lg font-semibold",
            "text-primary font-sans"
          )}>
            Filtros
          </h3>
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-xl transition-all duration-150",
              "text-secondary hover:text-primary hover:bg-glass"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </GlassCard>
      )}

      {/* Saltos rápidos - Premium */}
      <GlassCard variant="default" padding="md">
        <div className="space-y-3">
          <h4 className={cn(
            "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
            "text-tertiary font-sans"
          )}>
            <div className="h-1 w-1 rounded-full bg-accent-blue" />
            Saltos rápidos
          </h4>
          <div className="space-y-2">
            <button
              onClick={goToToday}
              className={cn(
                "w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 text-left",
                "text-primary bg-glass hover:bg-glass border border-border-default font-sans"
              )}
            >
              Hoy
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => navigateWeek("prev")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150",
                  "text-secondary hover:text-primary hover:bg-glass border border-border-default font-sans"
                )}
              >
                -1 semana
              </button>
              <button
                onClick={() => navigateWeek("next")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150",
                  "text-secondary hover:text-primary hover:bg-glass border border-border-default font-sans"
                )}
              >
                +1 semana
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Mini calendario - Premium */}
      <GlassCard variant="default" padding="md">
        <div className="space-y-3">
          <h4 className={cn(
            "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
            "text-tertiary font-sans"
          )}>
            <div className="h-1 w-1 rounded-full bg-accent-aqua" />
            Calendario
          </h4>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateSelect(e.target.value)}
            className={cn(
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150",
              "text-primary bg-glass border border-border-default",
              "hover:border-accent-blue/30 focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/30",
              "font-sans"
            )}
          />
        </div>
      </GlassCard>

      {/* Filtros - Premium */}
      <div className="space-y-5">
        {/* Pagos */}
        <GlassCard variant="default" padding="md">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-tertiary font-sans"
            )}>
              <div className="h-1 w-1 rounded-full bg-accent-purple" />
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
                    className={cn(
                      "w-4 h-4 rounded-lg border bg-glass text-accent-blue",
                      "border-border-default focus:ring-2 focus:ring-accent-blue/30 transition-all duration-150"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-medium capitalize transition-colors duration-150",
                    "text-secondary group-hover:text-primary font-sans"
                  )}>
                    {option === "paid" ? "Pagado" : "Sin pagar"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Estado de la cita */}
        <GlassCard variant="default" padding="md">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-tertiary font-sans"
            )}>
              <div className="h-1 w-1 rounded-full bg-accent-pink" />
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
                    className={cn(
                      "w-4 h-4 rounded-lg border bg-glass text-accent-blue",
                      "border-border-default focus:ring-2 focus:ring-accent-blue/30 transition-all duration-150"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    "text-secondary group-hover:text-primary font-sans"
                  )}>
                    {BOOKING_STATUS_CONFIG[status].label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Empleado */}
        <GlassCard variant="default" padding="md">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-tertiary font-sans"
            )}>
              <div className="h-1 w-1 rounded-full bg-accent-blue" />
              Empleado
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.staff.includes("all")}
                  onChange={() => handleFilterChange("staff", "all")}
                  className={cn(
                    "w-4 h-4 rounded-lg border bg-glass text-accent-blue",
                    "border-border-default focus:ring-2 focus:ring-accent-blue/30 transition-all duration-150"
                  )}
                />
                <span className={cn(
                  "text-sm font-medium transition-colors duration-150",
                  "text-secondary group-hover:text-primary font-sans"
                )}>
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
                    className={cn(
                      "w-4 h-4 rounded-lg border bg-glass text-accent-blue",
                      "border-border-default focus:ring-2 focus:ring-accent-blue/30 transition-all duration-150"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    "text-secondary group-hover:text-primary font-sans"
                  )}>
                    {staff.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Detalles */}
        <GlassCard variant="default" padding="md">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-tertiary font-sans"
            )}>
              <div className="h-1 w-1 rounded-full bg-accent-aqua" />
              Detalles
            </h4>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.highlighted === true}
                onChange={() => handleFilterChange("highlighted", true)}
                className={cn(
                  "w-4 h-4 rounded-lg border bg-glass text-accent-blue",
                  "border-border-default focus:ring-2 focus:ring-accent-blue/30 transition-all duration-150"
                )}
              />
              <span className={cn(
                "text-sm font-medium transition-colors duration-150",
                "text-secondary group-hover:text-primary font-sans"
              )}>
                Marcadas como destacadas
              </span>
            </label>
            {onShowFreeSlotsChange && (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={showFreeSlots}
                  onChange={(e) => onShowFreeSlotsChange(e.target.checked)}
                  className={cn(
                    "w-4 h-4 rounded-lg border bg-glass text-accent-blue",
                    "border-border-default focus:ring-2 focus:ring-accent-blue/30 transition-all duration-150"
                  )}
                />
                <span className={cn(
                  "text-sm font-medium transition-colors duration-150",
                  "text-secondary group-hover:text-primary font-sans"
                )}>
                  Mostrar solo huecos libres
                </span>
              </label>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Leyenda - Premium */}
      <GlassCard variant="default" padding="md">
        <div className="space-y-3">
          <h4 className={cn(
            "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
            "text-tertiary font-sans"
          )}>
            <div className="h-1 w-1 rounded-full bg-accent-aqua" />
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
                <div key={status} className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors duration-150",
                  "hover:bg-glass"
                )}>
                  <div
                    className="w-4 h-4 rounded border-l-4"
                    style={{
                      backgroundColor: config.legendBg,
                      borderLeftColor: config.legendBorder.includes("/") 
                        ? config.legendBorder.split("/")[0] 
                        : config.legendBorder,
                      boxShadow: `0px 0px 6px ${config.legendColor}30`,
                    }}
                  />
                  <span className={cn(
                    "text-xs font-semibold",
                    "text-primary font-sans"
                  )}>
                    {config.label}
                  </span>
                </div>
              );
            })}
            {/* Bloqueo (no es un estado de booking, pero se muestra en la leyenda) */}
            <div className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-colors duration-150",
              "hover:bg-glass"
            )}>
              <div
                className="w-4 h-4 rounded border-l-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderLeftColor: "rgba(255,255,255,0.1)",
                  boxShadow: `0px 0px 6px rgba(156,163,175,0.3)`,
                }}
              />
              <span className={cn(
                "text-xs font-semibold",
                "text-primary font-sans"
              )}>
                Bloqueo
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Botones de acción - Premium */}
      <div className="pt-5 space-y-2">
        <button
          onClick={() => {
            // Los filtros ya se aplican automáticamente al cambiar el estado
          }}
          className={cn(
            "w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150",
            "text-primary bg-gradient-to-r from-accent-blue to-accent-aqua shadow-accent-blue/30 hover:shadow-accent-blue/50",
            "font-sans"
          )}
        >
          Aplicar filtros
        </button>
        <button
          onClick={clearFilters}
          className={cn(
            "w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-150",
            "text-secondary hover:text-primary hover:bg-glass border border-border-default",
            "font-sans"
          )}
        >
          Limpiar todo
        </button>
      </div>
    </div>
  );
}
