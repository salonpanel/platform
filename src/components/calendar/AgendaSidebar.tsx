"use client";

import { useState, useEffect } from "react";
import { format, addWeeks, subWeeks, startOfToday } from "date-fns";
import { Button } from "@/components/ui/Button";
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
    <div className="h-full overflow-y-auto space-y-6 scrollbar-hide">
      {/* Header - Only show in mobile drawer */}
      {isMobile && (
        <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.85)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[var(--accent-blue)]" />
            <h3 className={cn(
              "text-lg font-semibold",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
            )}>
              Filtros y Navegación
            </h3>
          </div>
          <button
            onClick={onClose || (() => {})}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[rgba(255,255,255,0.03)] active:scale-95"
            )}
            aria-label="Cerrar filtros"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Tablet collapse toggle */}
      {isTablet && !isCollapsed && (
        <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.85)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[var(--accent-blue)]" />
            <h3 className={cn(
              "text-lg font-semibold",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
            )}>
              Filtros
            </h3>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[rgba(255,255,255,0.03)] active:scale-95"
            )}
            aria-label="Contraer filtros"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Quick Navigation */}
      <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3">
        <div className="space-y-3">
          <h4 className={cn(
            "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
            "text-[var(--text-tertiary)] font-[var(--font-heading)]"
          )}>
            <Calendar className="h-3 w-3 text-[var(--accent-blue)]" />
            Navegación Rápida
          </h4>
          <div className="space-y-2">
            <button
              onClick={goToToday}
              className={cn(
                "w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 text-left",
                "text-[var(--text-primary)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]",
                "border border-white/5 font-[var(--font-body)]"
              )}
            >
              Hoy
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => navigateWeek("prev")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]",
                  "border border-white/5 font-[var(--font-body)]"
                )}
              >
                -1 semana
              </button>
              <button
                onClick={() => navigateWeek("next")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]",
                  "border border-white/5 font-[var(--font-body)]"
                )}
              >
                +1 semana
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Picker */}
      <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3">
        <div className="space-y-3">
          <h4 className={cn(
            "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
            "text-[var(--text-tertiary)] font-[var(--font-heading)]"
          )}>
            <Calendar className="h-3 w-3 text-[var(--accent-aqua)]" />
            Calendario
          </h4>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateSelect(e.target.value)}
            className={cn(
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200",
              "text-[var(--text-primary)] bg-[rgba(255,255,255,0.03)] border border-white/5",
              "hover:border-[var(--accent-blue)]/30 focus:border-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30",
              "font-[var(--font-body)]"
            )}
          />
        </div>
      </div>

      {/* Filter Sections */}
      <div className="space-y-5">
        {/* Payment Status */}
        <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-[var(--text-tertiary)] font-[var(--font-heading)]"
            )}>
              <CreditCard className="h-3 w-3 text-[var(--accent-purple)]" />
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
                      "w-4 h-4 rounded-lg border bg-[rgba(255,255,255,0.03)] text-[var(--accent-blue)]",
                      "border-white/5 focus:ring-2 focus:ring-[var(--accent-blue)/30] transition-all duration-200"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-medium capitalize transition-colors duration-200",
                    "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-[var(--font-body)]"
                  )}>
                    {option === "paid" ? "Pagado" : "Sin pagar"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Booking Status */}
        <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-[var(--text-tertiary)] font-[var(--font-heading)]"
            )}>
              <CheckCircle className="h-3 w-3 text-[var(--accent-pink)]" />
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
                      "w-4 h-4 rounded-lg border bg-[rgba(255,255,255,0.03)] text-[var(--accent-blue)]",
                      "border-white/5 focus:ring-2 focus:ring-[var(--accent-blue)/30] transition-all duration-200"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-[var(--font-body)]"
                  )}>
                    {BOOKING_STATUS_CONFIG[status].label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Filter - Removed to avoid duplication with AgendaFilters */}
        {/* Staff selection is handled in AgendaFilters header for better UX */}

        {/* Additional Options */}
        <div className="relative rounded-2xl border border-white/5 bg-[rgba(15,23,42,0.65)] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] px-4 py-3">
          <div className="space-y-3">
            <h4 className={cn(
              "text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
              "text-[var(--text-tertiary)] font-[var(--font-heading)]"
            )}>
              <div className="h-1 w-1 rounded-full bg-[var(--accent-aqua)]" />
              Detalles
            </h4>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.highlighted === true}
                onChange={() => handleFilterChange("highlighted", true)}
                className={cn(
                  "w-4 h-4 rounded-lg border bg-[rgba(255,255,255,0.03)] text-[var(--accent-blue)]",
                  "border-white/5 focus:ring-2 focus:ring-[var(--accent-blue)/30] transition-all duration-200"
                )}
              />
              <span className={cn(
                "text-sm font-medium transition-colors duration-200",
                "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-[var(--font-body)]"
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
                    "w-4 h-4 rounded-lg border bg-[rgba(255,255,255,0.03)] text-[var(--accent-blue)]",
                    "border-white/5 focus:ring-2 focus:ring-[var(--accent-blue)/30] transition-all duration-200"
                  )}
                />
                <span className={cn(
                  "text-sm font-medium transition-colors duration-200",
                  "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] font-[var(--font-body)]"
                )}>
                  Mostrar huecos libres
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Clear Filters */}
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full"
        >
          Limpiar todos los filtros
        </Button>
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
