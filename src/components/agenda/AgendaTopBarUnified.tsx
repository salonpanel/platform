"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Search, Bell, Calendar, ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Staff } from "@/types/agenda";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaTopBarUnifiedProps {
  selectedDate: string;
  viewMode: ViewMode;
  onDateChange: (date: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onNotificationsClick: () => void;
  unreadNotifications?: number;
  
  // Filtros integrados
  staffList: Staff[];
  selectedStaffId: string | null;
  onStaffChange: (staffId: string | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  
  // Filtros de estado
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  
  // Filtros de pago
  selectedPaymentStates: string[];
  onPaymentStatesChange: (states: string[]) => void;
  
  // Filtros de servicio
  services: Array<{ id: string; name: string }>;
  selectedServiceIds: string[];
  onServiceIdsChange: (ids: string[]) => void;
}

/**
 * AgendaTopBarUnified - Barra superior todo-en-uno
 * Integra navegación, vista, búsqueda y TODOS los filtros en una sola barra compacta
 */
export function AgendaTopBarUnified({
  selectedDate,
  viewMode,
  onDateChange,
  onViewModeChange,
  onNotificationsClick,
  unreadNotifications = 0,
  staffList,
  selectedStaffId,
  onStaffChange,
  searchTerm,
  onSearchChange,
  selectedStatuses,
  onStatusesChange,
  selectedPaymentStates,
  onPaymentStatesChange,
  services,
  selectedServiceIds,
  onServiceIdsChange,
}: AgendaTopBarUnifiedProps) {
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const viewModes: { key: ViewMode; label: string }[] = [
    { key: "day", label: "Día" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "list", label: "Lista" },
  ];

  const statusOptions = [
    { value: "pending", label: "Pendiente" },
    { value: "confirmed", label: "Confirmado" },
    { value: "completed", label: "Completado" },
    { value: "cancelled", label: "Cancelado" },
    { value: "no_show", label: "No Show" },
  ];

  const paymentOptions = [
    { value: "paid", label: "Pagado" },
    { value: "unpaid", label: "No pagado" },
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
    return format(date, "d MMM yyyy", { locale: es });
  };

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusesChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusesChange([...selectedStatuses, status]);
    }
  };

  const togglePayment = (payment: string) => {
    if (selectedPaymentStates.includes(payment)) {
      onPaymentStatesChange(selectedPaymentStates.filter(p => p !== payment));
    } else {
      onPaymentStatesChange([...selectedPaymentStates, payment]);
    }
  };

  const toggleService = (serviceId: string) => {
    if (selectedServiceIds.includes(serviceId)) {
      onServiceIdsChange(selectedServiceIds.filter(s => s !== serviceId));
    } else {
      onServiceIdsChange([...selectedServiceIds, serviceId]);
    }
  };

  const activeFiltersCount = selectedStatuses.length + selectedPaymentStates.length + selectedServiceIds.length + (selectedStaffId ? 1 : 0);

  return (
    <div className="rounded-2xl bg-[var(--glass-bg-default)] border border-[var(--glass-border)] backdrop-blur-md">
      <div className="px-6 py-4">
        {/* Primera fila: Fecha, navegación y acciones */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Fecha clickeable */}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-3 min-w-0 group"
          >
            <div className="h-10 w-10 rounded-xl bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-[var(--accent-blue)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 group-hover:text-[var(--accent-blue)] transition-colors">
                {formatDateDisplay()}
                <ChevronDown className="h-4 w-4" />
              </h1>
            </div>
          </button>

          {/* Navegación y acciones */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigate("prev")}
              className="h-9 w-9 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg-hover)] transition-all flex items-center justify-center"
            >
              <ChevronLeft className="h-4 w-4 text-[var(--text-primary)]" />
            </button>
            <button
              onClick={handleToday}
              className="px-4 h-9 rounded-lg bg-gradient-to-r from-[#4FE3C1] to-[#3A6DFF] text-sm font-semibold text-[#0E0F11]"
            >
              Hoy
            </button>
            <button
              onClick={() => handleNavigate("next")}
              className="h-9 w-9 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg-hover)] transition-all flex items-center justify-center"
            >
              <ChevronRight className="h-4 w-4 text-[var(--text-primary)]" />
            </button>

            <div className="h-6 w-px bg-[var(--glass-border)] hidden md:block mx-1" />

            <button
              onClick={onNotificationsClick}
              className="relative h-9 w-9 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] hover:bg-[var(--glass-bg-hover)] transition-all flex items-center justify-center"
            >
              <Bell className="h-4 w-4 text-[var(--text-primary)]" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full bg-gradient-to-r from-[#4FE3C1] to-[#3A6DFF] text-[10px] font-bold text-[#0E0F11] flex items-center justify-center">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Segunda fila: Vistas */}
        <div className="flex items-center gap-2 mb-4">
          {viewModes.map((mode) => (
            <button
              key={mode.key}
              onClick={() => onViewModeChange(mode.key)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                viewMode === mode.key
                  ? "bg-[var(--accent-blue)] text-white"
                  : "bg-[var(--glass-bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Tercera fila: Búsqueda y Filtros */}
        <div className="flex items-center gap-2">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar cliente, servicio o staff..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--glass-bg-subtle)] border border-[var(--glass-border)] focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] text-sm transition-all"
            />
          </div>

          {/* Filtro Personal */}
          <FilterDropdown
            label="Personal"
            count={selectedStaffId ? 1 : 0}
            isOpen={showStaffDropdown}
            onToggle={() => setShowStaffDropdown(!showStaffDropdown)}
          >
            <div className="py-2">
              <button
                onClick={() => { onStaffChange(null); setShowStaffDropdown(false); }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-[var(--glass-bg-subtle)] rounded transition-colors flex items-center justify-between",
                  !selectedStaffId && "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                )}
              >
                <span>Todos</span>
                {!selectedStaffId && <Check className="h-4 w-4" />}
              </button>
              {staffList.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => { onStaffChange(staff.id); setShowStaffDropdown(false); }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-[var(--glass-bg-subtle)] rounded transition-colors flex items-center justify-between",
                    selectedStaffId === staff.id && "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                  )}
                >
                  <span>{staff.name}</span>
                  {selectedStaffId === staff.id && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </FilterDropdown>

          {/* Filtro Estado */}
          <FilterDropdown
            label="Estado"
            count={selectedStatuses.length}
            isOpen={showStatusDropdown}
            onToggle={() => setShowStatusDropdown(!showStatusDropdown)}
          >
            <div className="py-2">
              {statusOptions.map((status) => (
                <button
                  key={status.value}
                  onClick={() => toggleStatus(status.value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-[var(--glass-bg-subtle)] rounded transition-colors flex items-center justify-between",
                    selectedStatuses.includes(status.value) && "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                  )}
                >
                  <span>{status.label}</span>
                  {selectedStatuses.includes(status.value) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </FilterDropdown>

          {/* Filtro Pago */}
          <FilterDropdown
            label="Pago"
            count={selectedPaymentStates.length}
            isOpen={showPaymentDropdown}
            onToggle={() => setShowPaymentDropdown(!showPaymentDropdown)}
          >
            <div className="py-2">
              {paymentOptions.map((payment) => (
                <button
                  key={payment.value}
                  onClick={() => togglePayment(payment.value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-[var(--glass-bg-subtle)] rounded transition-colors flex items-center justify-between",
                    selectedPaymentStates.includes(payment.value) && "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                  )}
                >
                  <span>{payment.label}</span>
                  {selectedPaymentStates.includes(payment.value) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </FilterDropdown>

          {/* Filtro Servicio */}
          <FilterDropdown
            label="Servicio"
            count={selectedServiceIds.length}
            isOpen={showServiceDropdown}
            onToggle={() => setShowServiceDropdown(!showServiceDropdown)}
          >
            <div className="py-2 max-h-64 overflow-y-auto">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => toggleService(service.id)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-[var(--glass-bg-subtle)] rounded transition-colors flex items-center justify-between",
                    selectedServiceIds.includes(service.id) && "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                  )}
                >
                  <span>{service.name}</span>
                  {selectedServiceIds.includes(service.id) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </FilterDropdown>

          {/* Limpiar filtros */}
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                onStaffChange(null);
                onStatusesChange([]);
                onPaymentStatesChange([]);
                onServiceIdsChange([]);
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--glass-bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Limpiar ({activeFiltersCount})</span>
              <span className="sm:hidden">{activeFiltersCount}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para dropdowns de filtros
function FilterDropdown({
  label,
  count,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={cn(
          "px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
          count > 0
            ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
            : "bg-[var(--glass-bg-subtle)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:bg-[var(--glass-bg-hover)]"
        )}
      >
        <span>{label}</span>
        {count > 0 && (
          <span className="h-5 min-w-[1.25rem] px-1.5 rounded-full bg-[var(--accent-blue)] text-white text-xs font-bold flex items-center justify-center">
            {count}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 w-56 bg-[var(--glass-bg-default)] border border-[var(--glass-border)] rounded-lg shadow-[var(--shadow-premium)] backdrop-blur-md z-50"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
