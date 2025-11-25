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
    <div className="p-4 space-y-4">
      {/* Header - Only show in mobile drawer */}
      {isMobile && (
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#4FE3C1]" />
            <h3 className="text-base font-semibold text-white">Filtros</h3>
          </div>
          <button
            onClick={onClose || (() => {})}
            className="p-1.5 rounded-lg transition-colors text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Cerrar filtros"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Date Navigation */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-white/40">Navegación</p>
        <div className="space-y-2">
          <UiButton
            variant="secondary"
            size="sm"
            onClick={goToToday}
            className="w-full justify-center text-sm"
          >
            Hoy
          </UiButton>
          <div className="grid grid-cols-2 gap-2">
            <UiButton
              variant="ghost"
              size="sm"
              onClick={() => navigateWeek("prev")}
              className="text-xs"
            >
              -1 semana
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              onClick={() => navigateWeek("next")}
              className="text-xs"
            >
              +1 semana
            </UiButton>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateSelect(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:border-white/20 focus:border-[#4FE3C1]/50 focus:outline-none focus:ring-1 focus:ring-[#4FE3C1]/30"
          />
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Payment Filters */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-white/40 flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" />
          Pagos
        </p>
        <div className="space-y-1">
          {["paid", "unpaid"].map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              <input
                type="checkbox"
                checked={filters.payment.includes(option)}
                onChange={() => handleFilterChange("payment", option)}
                className="w-3.5 h-3.5 rounded border border-white/30 bg-transparent text-[#4FE3C1] focus:ring-1 focus:ring-[#4FE3C1]/30"
              />
              <span>{option === "paid" ? "Pagado" : "Sin pagar"}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Status Filters */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-white/40 flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3" />
          Estado
        </p>
        <div className="space-y-1">
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
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              <input
                type="checkbox"
                checked={filters.status.includes(status)}
                onChange={() => handleFilterChange("status", status)}
                className="w-3.5 h-3.5 rounded border border-white/30 bg-transparent text-[#4FE3C1] focus:ring-1 focus:ring-[#4FE3C1]/30"
              />
              <span>{BOOKING_STATUS_CONFIG[status].label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Details Filters */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-white/40">Detalles</p>
        <div className="space-y-1">
          <label className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={filters.highlighted === true}
              onChange={() => handleFilterChange("highlighted", true)}
              className="w-3.5 h-3.5 rounded border border-white/30 bg-transparent text-[#4FE3C1] focus:ring-1 focus:ring-[#4FE3C1]/30"
            />
            <span>Destacadas</span>
          </label>
        </div>
      </div>

      {/* Clear Button */}
      <button
        onClick={clearFilters}
        className="w-full mt-2 py-2 text-xs font-medium text-white/50 hover:text-white/80 transition-colors"
      >
        Limpiar filtros
      </button>
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
