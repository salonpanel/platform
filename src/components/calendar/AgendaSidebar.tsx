"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, addWeeks, subWeeks, startOfToday, addDays, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  X,
  Filter,
  CreditCard,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  CalendarDays,
  Sparkles,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { AgendaModal } from "./AgendaModal";
import { useResponsive } from "@/hooks/useResponsive";

// Type for filters
interface AgendaFiltersState {
  payment: string[];
  status: string[];
  staff: string[];
  highlighted: boolean | null;
}

interface AgendaSidebarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  filters: AgendaFiltersState;
  onFiltersChange: (filters: AgendaFiltersState) => void;
  onClose?: () => void;
  isOpen?: boolean;
  onOpen?: () => void;
}

// Premium filter chip component
function FilterChip({
  label,
  isActive,
  onClick,
  icon,
  color = "aqua"
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: "aqua" | "purple" | "blue" | "pink" | "amber" | "red" | "green" | "gray";
}) {
  const colorClasses = {
    aqua: "bg-[#4FE3C1]/10 border-[#4FE3C1]/30 text-[#4FE3C1]",
    purple: "bg-[#A06BFF]/10 border-[#A06BFF]/30 text-[#A06BFF]",
    blue: "bg-[#3A6DFF]/10 border-[#3A6DFF]/30 text-[#3A6DFF]",
    pink: "bg-[#FF6DA3]/10 border-[#FF6DA3]/30 text-[#FF6DA3]",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    green: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    gray: "bg-white/5 border-white/10 text-white/60",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200",
        isActive
          ? colorClasses[color]
          : "bg-white/[0.02] border-white/8 text-white/50 hover:bg-white/[0.04] hover:border-white/12 hover:text-white/70"
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </motion.button>
  );
}

// Section header component
function SectionHeader({
  icon,
  title,
  badge
}: {
  icon: React.ReactNode;
  title: string;
  badge?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-white/[0.04]">
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
          {title}
        </span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#4FE3C1]/20 text-[#4FE3C1]">
          {badge}
        </span>
      )}
    </div>
  );
}

// Premium divider
function PremiumDivider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}

// Status color mapping
const statusColors: Record<BookingStatus, "aqua" | "purple" | "blue" | "pink" | "amber" | "red" | "green" | "gray"> = {
  pending: "amber",
  paid: "green",
  completed: "aqua",
  cancelled: "red",
  no_show: "gray",
  hold: "purple",
};

// Sidebar content as a separate component
interface SidebarContentProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  filters: AgendaFiltersState;
  onFilterChange: (category: "payment" | "status" | "staff" | "highlighted", value: string | boolean | null) => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
  isMobile: boolean;
  onClose?: () => void;
}

function SidebarContentComponent({
  selectedDate,
  onDateSelect,
  filters,
  onFilterChange,
  onClearFilters,
  activeFiltersCount,
  isMobile,
  onClose,
}: SidebarContentProps) {
  // Format selected date for display
  const formattedDate = useMemo(() => {
    const date = new Date(selectedDate);
    return {
      day: format(date, "d", { locale: es }),
      weekday: format(date, "EEEE", { locale: es }),
      month: format(date, "MMMM", { locale: es }),
      year: format(date, "yyyy", { locale: es }),
      isToday: format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    };
  }, [selectedDate]);

  const navigateWeek = useCallback((direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate);
    const newDate = direction === "next"
      ? addWeeks(currentDate, 1)
      : subWeeks(currentDate, 1);
    onDateSelect(format(newDate, "yyyy-MM-dd"));
  }, [selectedDate, onDateSelect]);

  const navigateDay = useCallback((direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate);
    const newDate = direction === "next"
      ? addDays(currentDate, 1)
      : subDays(currentDate, 1);
    onDateSelect(format(newDate, "yyyy-MM-dd"));
  }, [selectedDate, onDateSelect]);

  const goToToday = useCallback(() => {
    onDateSelect(format(startOfToday(), "yyyy-MM-dd"));
  }, [onDateSelect]);

  return (
    <div className="p-5 space-y-1">
      {/* Header - Mobile & Desktop */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#4FE3C1]/20 to-[#3A6DFF]/20 border border-[#4FE3C1]/20">
              <Filter className="h-4 w-4 text-[#4FE3C1]" />
            </div>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-[#4FE3C1] text-[#0E0F11]">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Filtros</h3>
            <p className="text-[11px] text-white/40">Personaliza tu vista</p>
          </div>
        </div>
        {isMobile && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose || (() => { })}
            className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
            aria-label="Cerrar filtros"
          >
            <X className="h-4 w-4" />
          </motion.button>
        )}
      </motion.div>

      {/* Date Navigation - Premium Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-4"
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#4FE3C1]/5 via-transparent to-[#A06BFF]/5 pointer-events-none" />

        <div className="relative">
          <SectionHeader
            icon={<CalendarDays className="h-3.5 w-3.5 text-[#4FE3C1]" />}
            title="Fecha"
          />

          {/* Current date display */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-3xl font-bold text-white">{formattedDate.day}</span>
              {formattedDate.isToday && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#4FE3C1]/20 text-[#4FE3C1] border border-[#4FE3C1]/30">
                  Hoy
                </span>
              )}
            </div>
            <p className="text-sm text-white/60 capitalize">
              {formattedDate.weekday}, {formattedDate.month} {formattedDate.year}
            </p>
          </div>

          {/* Quick navigation */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigateDay("prev")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/60 hover:bg-white/[0.08] hover:text-white transition-all duration-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Ayer</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={goToToday}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200",
                formattedDate.isToday
                  ? "bg-[#4FE3C1]/20 border-[#4FE3C1]/30 text-[#4FE3C1]"
                  : "bg-gradient-to-r from-[#4FE3C1]/10 to-[#3A6DFF]/10 border-[#4FE3C1]/20 text-white hover:from-[#4FE3C1]/20 hover:to-[#3A6DFF]/20"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Hoy
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigateDay("next")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white/60 hover:bg-white/[0.08] hover:text-white transition-all duration-200"
            >
              <span className="text-xs font-medium">Mañana</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.button>
          </div>

          {/* Week navigation */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigateWeek("prev")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/6 text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all duration-200 text-xs"
            >
              <ChevronLeft className="h-3 w-3" />
              Semana anterior
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigateWeek("next")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/6 text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all duration-200 text-xs"
            >
              Semana siguiente
              <ChevronRight className="h-3 w-3" />
            </motion.button>
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateSelect(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white transition-all duration-200 hover:border-white/20 focus:border-[#4FE3C1]/50 focus:outline-none focus:ring-2 focus:ring-[#4FE3C1]/20 cursor-pointer"
          />
        </div>
      </motion.div>

      <PremiumDivider />

      {/* Payment Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SectionHeader
          icon={<CreditCard className="h-3.5 w-3.5 text-[#A06BFF]" />}
          title="Pagos"
          badge={filters.payment.length}
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Pagado"
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            isActive={filters.payment.includes("paid")}
            onClick={() => onFilterChange("payment", "paid")}
            color="green"
          />
          <FilterChip
            label="Pendiente"
            icon={<Clock className="h-3.5 w-3.5" />}
            isActive={filters.payment.includes("unpaid")}
            onClick={() => onFilterChange("payment", "unpaid")}
            color="amber"
          />
        </div>
      </motion.div>

      <PremiumDivider />

      {/* Status Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <SectionHeader
          icon={<CheckCircle className="h-3.5 w-3.5 text-[#3A6DFF]" />}
          title="Estado de citas"
          badge={filters.status.length}
        />
        <div className="flex flex-wrap gap-2">
          {([
            "pending",
            "paid",
            "completed",
            "cancelled",
            "no_show",
            "hold",
          ] as BookingStatus[]).map((status) => (
            <FilterChip
              key={status}
              label={BOOKING_STATUS_CONFIG[status].label}
              isActive={filters.status.includes(status)}
              onClick={() => onFilterChange("status", status)}
              color={statusColors[status]}
            />
          ))}
        </div>
      </motion.div>

      <PremiumDivider />

      {/* Special Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SectionHeader
          icon={<Sparkles className="h-3.5 w-3.5 text-[#FF6DA3]" />}
          title="Especiales"
          badge={filters.highlighted ? 1 : 0}
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Destacadas"
            icon={<Star className="h-3.5 w-3.5" />}
            isActive={filters.highlighted === true}
            onClick={() => onFilterChange("highlighted", true)}
            color="pink"
          />
        </div>
      </motion.div>

      {/* Clear Filters Button */}
      <AnimatePresence>
        {activeFiltersCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pt-4"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClearFilters}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] border border-white/8 text-white/60 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all duration-200 text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar todos los filtros
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AgendaSidebar({
  selectedDate,
  onDateSelect,
  filters,
  onFiltersChange,
  onClose,
  isOpen: externalIsOpen,
  onOpen: externalOnOpen,
}: AgendaSidebarProps) {
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);



  // Responsive detection using standardized hook
  const { isMobile, isTablet } = useResponsive();

  // Reset states when changing modes
  useEffect(() => {
    if (!isMobile) setShowMobileDrawer(false);
    if (!isTablet) setIsCollapsed(false);
  }, [isMobile, isTablet]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.staff?.length) count++;
    if (filters.status?.length) count++;
    if (filters.payment?.length) count++;
    if (filters.highlighted) count++;
    return count;
  }, [filters]);

  const isDrawerOpen = externalIsOpen !== undefined ? externalIsOpen : showMobileDrawer;
  const handleDrawerClose = externalIsOpen !== undefined ? onClose : () => setShowMobileDrawer(false);
  const handleDrawerOpen = externalOnOpen || (() => setShowMobileDrawer(true));

  const handleFilterChange = useCallback((
    category: "payment" | "status" | "staff" | "highlighted",
    value: string | boolean | null
  ) => {
    const updated = { ...filters };

    if (category === "highlighted") {
      updated.highlighted = value === filters.highlighted ? null : (value as boolean);
    } else {
      const array = [...updated[category]];
      const index = array.indexOf(value as string);
      if (index >= 0) {
        array.splice(index, 1);
      } else {
        array.push(value as string);
      }
      updated[category] = array;
    }

    onFiltersChange(updated);
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange({
      payment: [],
      status: [],
      staff: [],
      highlighted: null,
    });
  }, [onFiltersChange]);

  // Shared content props
  const contentProps: SidebarContentProps = {
    selectedDate,
    onDateSelect,
    filters,
    onFilterChange: handleFilterChange,
    onClearFilters: clearFilters,
    activeFiltersCount,
    isMobile,
    onClose,
  };

  // Mobile drawer using AgendaModal
  if (isMobile) {
    return (
      <>
        {/* Premium mobile toggle button - shown when drawer is closed */}
        {!isDrawerOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDrawerOpen}
            className={cn(
              "fixed bottom-6 right-6 z-40 p-4 rounded-2xl",
              "bg-gradient-to-br from-[#4FE3C1]/90 to-[#3A6DFF]/90",
              "text-white shadow-lg shadow-[#4FE3C1]/25",
              "backdrop-blur-xl transition-all duration-300",
              "border border-white/20"
            )}
            aria-label="Mostrar filtros"
          >
            <div className="relative">
              <Filter className="h-5 w-5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full bg-white text-[#0E0F11]">
                  {activeFiltersCount}
                </span>
              )}
            </div>
          </motion.button>
        )}

        <AgendaModal
          isOpen={isDrawerOpen}
          onClose={handleDrawerClose || (() => { })}
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
          <SidebarContentComponent {...contentProps} />
        </AgendaModal>
      </>
    );
  }

  // Desktop/Tablet sidebar - premium glass design
  return (
    <div className={cn(
      "hidden md:block h-full transition-all duration-300",
      isTablet && isCollapsed ? "w-14" : "w-full"
    )}>
      {/* Tablet collapsed toggle */}
      {isTablet && isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-14 h-full flex flex-col items-center py-5 bg-white/[0.02] rounded-xl border border-white/6"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCollapsed(false)}
            className={cn(
              "p-3 rounded-xl transition-all duration-200",
              "bg-gradient-to-br from-[#4FE3C1]/10 to-[#3A6DFF]/10",
              "border border-[#4FE3C1]/20",
              "text-[#4FE3C1] hover:text-white",
              "hover:from-[#4FE3C1]/20 hover:to-[#3A6DFF]/20"
            )}
            aria-label="Expandir filtros"
          >
            <div className="relative">
              <Filter className="h-5 w-5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-[#4FE3C1] text-[#0E0F11]">
                  {activeFiltersCount}
                </span>
              )}
            </div>
          </motion.button>
        </motion.div>
      )}

      {/* Full sidebar content with premium styling */}
      {(!isTablet || !isCollapsed) && (
        <motion.div
          initial={{ opacity: 0, x: isTablet ? -20 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="h-full"
        >
          <SidebarContentComponent {...contentProps} />
        </motion.div>
      )}
    </div>
  );
}
