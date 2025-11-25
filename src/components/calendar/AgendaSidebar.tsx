"use client";

import { useState, useEffect } from "react";
import { format, addWeeks, subWeeks, startOfToday } from "date-fns";
import { UiButton } from "@/components/ui/apple-ui-kit";
import { X, Filter, Calendar, CreditCard, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Staff, BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { AgendaModal } from "./AgendaModal";
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
  // New props for external mobile drawer control
  isOpen?: boolean;
  onOpen?: () => void;
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
  // New props for external mobile drawer control
  isOpen: externalIsOpen,
  onOpen: externalOnOpen,
}: AgendaSidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Use external control if provided, otherwise internal state
  const isDrawerOpen = externalIsOpen !== undefined ? externalIsOpen : showMobileDrawer;
  const handleDrawerClose = externalIsOpen !== undefined ? onClose : () => setShowMobileDrawer(false);
  const handleDrawerOpen = externalOnOpen || (() => setShowMobileDrawer(true));

  // Internal responsive detection using CSS media queries
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 640px)');
    const tabletQuery = window.matchMedia('(min-width: 641px) and (max-width: 1024px)');
    
    const handleMobileChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setShowMobileDrawer(false); // Reset drawer state when entering mobile
      }
    };
    
    const handleTabletChange = (e: MediaQueryListEvent) => {
      setIsTablet(e.matches);
      if (!e.matches) {
        setIsCollapsed(false); // Reset collapse when leaving tablet
      }
    };
    
    // Set initial values
    setIsMobile(mobileQuery.matches);
    setIsTablet(tabletQuery.matches);
    
    // Listen for changes
    mobileQuery.addEventListener('change', handleMobileChange);
    tabletQuery.addEventListener('change', handleTabletChange);
    
    return () => {
      mobileQuery.removeEventListener('change', handleMobileChange);
      tabletQuery.removeEventListener('change', handleTabletChange);
    };
  }, []);

  const handleMobileToggle = () => {
    setShowMobileDrawer(!showMobileDrawer);
  };
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


  // Main sidebar content component
  const SidebarContent = () => (
    <div className="space-y-4">
      {/* Header - Only show in mobile drawer */}
      {isMobile && (
        <div className="flex items-center justify-between rounded-2xl bg-[rgba(15,23,42,0.85)] px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[var(--accent-blue)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
              Filtros y Navegación
            </h3>
          </div>
          <button
            onClick={onClose || (() => {})}
            className="p-2 rounded-xl transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.04)] active:scale-95"
            aria-label="Cerrar filtros"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Tablet collapse toggle */}
      {isTablet && !isCollapsed && (
        <div className="flex items-center justify-between rounded-2xl bg-[rgba(15,23,42,0.85)] px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[var(--accent-blue)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
              Filtros
            </h3>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 rounded-xl transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.04)] active:scale-95"
            aria-label="Contraer filtros"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="rounded-3xl bg-[rgba(15,23,42,0.7)]/90 px-5 py-6 backdrop-blur-2xl shadow-[0_18px_45px_rgba(0,0,0,0.35)] border border-white/5">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--accent-blue)]" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
                Agenda y filtros
              </h4>
            </div>
            <UiButton
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Limpiar
            </UiButton>
          </div>

          <div className="space-y-6 text-[var(--text-secondary)]">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Navegación</p>
              <div className="flex flex-col gap-3">
                <UiButton
                  variant="secondary"
                  size="sm"
                  onClick={goToToday}
                  className="justify-start"
                >
                  Hoy
                </UiButton>
                <div className="grid grid-cols-2 gap-2">
                  <UiButton
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateWeek("prev")}
                  >
                    -1 semana
                  </UiButton>
                  <UiButton
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateWeek("next")}
                  >
                    +1 semana
                  </UiButton>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                  <label className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Fecha</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onDateSelect(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/5 bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/25"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)] flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
                Pagos
              </p>
              <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
                {["paid", "unpaid"].map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-white/3"
                  >
                    <input
                      type="checkbox"
                      checked={filters.payment.includes(option)}
                      onChange={() => handleFilterChange("payment", option)}
                      className="w-4 h-4 rounded-lg border border-white/20 bg-[rgba(255,255,255,0.05)] text-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)/30]"
                    />
                    <span className="font-medium capitalize text-[var(--text-secondary)]">
                      {option === "paid" ? "Pagado" : "Sin pagar"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)] flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-[var(--accent-pink)]" />
                Estado de la cita
              </p>
              <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
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
                    className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-white/3"
                  >
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={() => handleFilterChange("status", status)}
                      className="w-4 h-4 rounded-lg border border-white/20 bg-[rgba(255,255,255,0.05)] text-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)/30]"
                    />
                    <span className="font-medium text-[var(--text-secondary)]">
                      {BOOKING_STATUS_CONFIG[status].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Detalles</p>
              <div className="grid gap-2 text-sm">
                <label className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-white/3">
                  <input
                    type="checkbox"
                    checked={filters.highlighted === true}
                    onChange={() => handleFilterChange("highlighted", true)}
                    className="w-4 h-4 rounded-lg border border-white/20 bg-[rgba(255,255,255,0.05)] text-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)/30]"
                  />
                  <span className="font-medium text-[var(--text-secondary)]">Marcadas como destacadas</span>
                </label>
                {onShowFreeSlotsChange && (
                  <label className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-white/3">
                    <input
                      type="checkbox"
                      checked={showFreeSlots}
                      onChange={(e) => onShowFreeSlotsChange(e.target.checked)}
                      className="w-4 h-4 rounded-lg border border-white/20 bg-[rgba(255,255,255,0.05)] text-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)/30]"
                    />
                    <span className="font-medium text-[var(--text-secondary)]">Mostrar huecos libres</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <UiButton
              variant="secondary"
              size="sm"
              onClick={clearFilters}
              className="w-full"
            >
              Limpiar todos los filtros
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile drawer using AgendaModal - no wrapper div to prevent flex space
  if (isMobile) {
    return (
      <>
        {/* Mobile toggle button - shown when drawer is closed */}
        {!isDrawerOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDrawerOpen}
            className={cn(
              "fixed bottom-4 right-4 z-40 p-3 rounded-xl shadow-lg",
              "bg-[rgba(15,23,42,0.85)] border border-white/5",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "backdrop-blur-xl transition-all duration-200"
            )}
            aria-label="Mostrar filtros"
          >
            <Filter className="h-5 w-5" />
          </motion.button>
        )}
        
        <AgendaModal
          isOpen={isDrawerOpen}
          onClose={handleDrawerClose || (() => {})}
          title="Filtros y Navegación"
          variant="drawer"
          showMobileDrawer={true}
          drawerPosition="right"
          size="lg"
          context={{
            type: "service",
            data: { filters }
          }}
        >
          <SidebarContent />
        </AgendaModal>
      </>
    );
  }

  // Desktop/Tablet sidebar - only render wrapper div on desktop/tablet
  return (
    <div className={cn(
      "hidden md:block h-full transition-all duration-300",
      isTablet && isCollapsed ? "w-12" : "w-80"
    )}>
      {/* Tablet collapsed toggle */}
      {isTablet && isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-12 h-full flex flex-col items-center py-4"
        >
          <button
            onClick={() => setIsCollapsed(false)}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[rgba(255,255,255,0.03)] active:scale-95"
            )}
            aria-label="Expandir filtros"
          >
            <Filter className="h-5 w-5" />
          </button>
        </motion.div>
      )}
      
      {/* Full sidebar content */}
      {(!isTablet || !isCollapsed) && (
        <motion.div
          initial={{ opacity: 0, x: isTablet ? -20 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <SidebarContent />
        </motion.div>
      )}
    </div>
  );
}
