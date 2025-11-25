"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking, Staff } from "@/types/agenda";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ListView } from "@/components/calendar/ListView";
import { UiFab } from "@/components/ui/apple-ui-kit";
import { BookingDetailPanel } from "@/components/calendar/BookingDetailPanel";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import { DraggableBookingCard } from "./DraggableBookingCard";
import { ConflictZone } from "./ConflictZone";
import { PremiumLoader } from "./PremiumLoader";
import { PremiumSkeleton } from "./PremiumSkeleton";
import { UiPillTabs } from "@/components/ui/apple-ui-kit";
import { Timeline } from "./Timeline";
import { BookingCard } from "./BookingCard";
import { Card } from "@/components/ui/Card";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaContentProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  bookings: Booking[];
  staffList: Staff[];
  loading: boolean;
  error: string | null;
  tenantTimezone: string;
  onBookingClick: (booking: Booking) => void;
  onNewBooking: () => void;
  density: "default" | "compact" | "ultra-compact";
  timeFormatter: Intl.DateTimeFormat;
  heightAware?: any;
  // Nuevas props para interactividad premium
  onBookingDrag?: (bookingId: string, newTime: string, newStaffId?: string) => void;
  onBookingResize?: (bookingId: string, newEndTime: string) => void;
  enableDragDrop?: boolean;
  showConflicts?: boolean;
  // Phase 2: Mobile responsive notification access
  notificationActions?: {
    info: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
  };
}

interface MiniBookingCardData {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
  customer?: {
    name: string;
    email?: string;
    phone?: string | null;
  };
  service?: { name: string; duration_min: number; price_cents?: number };
  staff?: { name: string };
}

/**
 * AgendaContent - Contenido dinámico premium
 * Maneja todos los modos de vista con transiciones suaves y optimización
 */
export function AgendaContent({
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  bookings,
  staffList,
  loading,
  error,
  tenantTimezone,
  onBookingClick,
  onNewBooking,
  density,
  timeFormatter,
  heightAware,
  // Nuevas props para interactividad premium
  onBookingDrag,
  onBookingResize,
  enableDragDrop = true,
  showConflicts = true,
  // Phase 2: Mobile responsive notification access
  notificationActions,
}: AgendaContentProps) {
  // Estados de carga contextuales
  const [dragLoading, setDragLoading] = useState(false);
  const [resizeLoading, setResizeLoading] = useState(false);

  // Phase 2: Mobile-first responsive viewport detection
  const isMobileRef = useRef(false);
  const autoSwitchRef = useRef(false);

  // Responsive density system - automatic based on screen size
  const getResponsiveDensity = useCallback(() => {
    if (typeof window === 'undefined') return density;

    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

    if (isMobile) {
      // Mobile: Higher density, tighter spacing
      return "ultra-compact" as const;
    } else if (isTablet) {
      // Tablet: Medium density
      return "compact" as const;
    } else {
      // Desktop: Spacious density
      return "default" as const;
    }
  }, []);

  const [responsiveDensity, setResponsiveDensity] = useState(getResponsiveDensity);

  // Viewport detection with infinite loop prevention, SSR safety, and performance optimization
  useEffect(() => {
    // Phase 3: Defensive check for SSR compatibility
    if (typeof window === 'undefined') return;
    
    let resizeTimeout: number; // Use number for browser setTimeout compatibility
    
    const checkViewport = () => {
      const isMobile = window.innerWidth < 768;
      const wasMobile = isMobileRef.current;
      isMobileRef.current = isMobile;

      // Auto-fallback Week view to Day view on mobile (only if not already auto-switched)
      if (isMobile && !wasMobile && viewMode === 'week' && !autoSwitchRef.current) {
        autoSwitchRef.current = true;
        onViewModeChange('day');
        // Show toast notification for first auto-switch
        notificationActions?.info(
          "Switched to Day view", 
          "Week view is optimized for larger screens"
        );
      }

      // Update responsive density
      setResponsiveDensity(getResponsiveDensity());
    };

    // Debounced resize handler to prevent performance issues
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(checkViewport, 150) as unknown as number; // Type casting for compatibility
    };

    checkViewport();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [viewMode, onViewModeChange]); // Remove notificationActions to prevent re-renders

  // Calcular hourHeight dinámicamente según altura disponible
  const availableHeight = heightAware?.availableHeight || 600; // Fallback for SSR/safety
  const workingHours = 12; // 8:00 a 20:00 = 12 horas laborables
  const headerHeight = 180; // Optimizado: filtros + título + staff selector
  const availableForTimeline = Math.max(400, availableHeight - headerHeight);
  const calculatedHourHeight = Math.max(
    60, // Mínimo 60px para buena legibilidad
    Math.floor(availableForTimeline / workingHours)
  );
  const hourHeight = density === "ultra-compact"
    ? Math.min(50, calculatedHourHeight)
    : density === "compact"
    ? Math.min(70, calculatedHourHeight)
    : Math.min(90, calculatedHourHeight);

  const handleBookingDrag = useCallback(async (bookingId: string, newTime: string, newStaffId?: string) => {
    if (onBookingDrag) {
      setDragLoading(true);
      try {
        await onBookingDrag(bookingId, newTime, newStaffId);
      } finally {
        setDragLoading(false);
      }
    }
  }, [onBookingDrag]);

  const handleBookingResize = useCallback(async (bookingId: string, newEndTime: string) => {
    if (onBookingResize) {
      setResizeLoading(true);
      try {
        await onBookingResize(bookingId, newEndTime);
      } finally {
        setResizeLoading(false);
      }
    }
  }, [onBookingResize]);

  // Track previous view mode for transitions
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>(viewMode);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Update previous view mode when view mode changes
  useEffect(() => {
    if (viewMode !== previousViewMode) {
      setPreviousViewMode(viewMode);
      setIsTransitioning(true);
      // Reset transition flag after animation
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [viewMode, previousViewMode]);

  // Apple-style view transitions based on view type combinations
  const getViewTransition = (fromView: ViewMode, toView: ViewMode) => {
    // Day ↔ Week: slide horizontal (200ms)
    if ((fromView === 'day' && toView === 'week') || (fromView === 'week' && toView === 'day')) {
      return {
        initial: { opacity: 0, x: fromView === 'day' ? -20 : 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: fromView === 'day' ? 20 : -20 },
        transition: { duration: 0.2, ease: [0.22, 0.61, 0.36, 1] as any }
      };
    }

    // Week ↔ Month: fade + scale smooth
    if ((fromView === 'week' && toView === 'month') || (fromView === 'month' && toView === 'week')) {
      return {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.05 },
        transition: { duration: 0.25, ease: [0.22, 0.61, 0.36, 1] as any }
      };
    }

    // Month ↔ List: dissolve smooth
    if ((fromView === 'month' && toView === 'list') || (fromView === 'list' && toView === 'month')) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2, ease: "easeInOut" as any }
      };
    }

    // Default transition for other combinations
    return {
      initial: { opacity: 0, x: 10 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -10 },
      transition: { duration: 0.15, ease: "easeOut" as any }
    };
  };

  const viewTransition = getViewTransition(previousViewMode, viewMode);

  // Layout según densidad
  const sectionPadding = density === "ultra-compact" ? "compact" : density === "compact" ? "sm" : "md";

  if (error) {
    return (
      <Card variant="default" className="border-[var(--color-danger)]/50 bg-[var(--color-danger-glass)]">
        <div className="text-[var(--color-danger)]">
          <h3 className="mb-2 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Error
          </h3>
          <p className="text-sm" style={{ fontFamily: "var(--font-body)" }}>
            {error}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <AnimatePresence mode="wait">
        <motion.div
          key="agenda-content"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="h-full flex flex-col min-h-0"
        >
          {/* Contenido principal según vista */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-1 min-h-0 overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <PremiumSkeleton
                  type="agenda-grid"
                  density={density}
                  className="w-full max-w-4xl"
                />
              </div>
            ) : bookings.length === 0 ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <motion.div
                      animate={{
                        rotate: [0, 10, -10, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      📅
                    </motion.div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
                    No hay reservas
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    {viewMode === "day"
                      ? "No hay citas programadas para este día."
                      : "No hay citas en este período."
                    }
                  </p>
                  {viewMode === "day" && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onNewBooking}
                      className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl"
                    >
                      Nueva Reserva
                    </motion.button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewMode}
                    {...viewTransition}
                    className="flex-1 min-h-0"
                  >
                    {viewMode === "day" && (
                      <div className="h-full flex flex-col min-h-0">
                        {/* Zona de conflictos premium */}
                        {showConflicts && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex-shrink-0 mb-2"
                          >
                            <ConflictZone
                              bookings={bookings}
                              tenantTimezone={tenantTimezone}
                              className="mx-3"
                            />
                          </motion.div>
                        )}

                        {/* Vista Timeline (Desktop/Tablet) */}
                        <div className="hidden md:flex flex-1 min-h-0">
                          <div className="relative flex-1 min-h-0 overflow-y-auto pr-2 scrollbar-hide" role="region" aria-label="Vista diaria de reservas">
                            <Timeline
                              startHour={8}
                              endHour={20}
                              density={responsiveDensity}
                              hourHeight={hourHeight}
                            >
                              {(hour) => {
                                const hourBookings = bookings.filter((booking) => {
                                  const bookingDate = new Date(booking.starts_at);
                                  const bookingHour = bookingDate.getHours();
                                  return bookingHour === hour;
                                });

                                if (hourBookings.length === 0) return null;

                                return (
                                  <div className="space-y-2" role="group" aria-label={`Reservas de las ${hour}:00`}>
                                    {hourBookings.map((booking) => {
                                      // Calcular posición del booking
                                      const getBookingPosition = (booking: Booking) => {
                                        const start = new Date(booking.starts_at);
                                        const end = new Date(booking.ends_at);

                                        // Calcular minutos desde las 8:00
                                        const startMinutes = (start.getHours() - 8) * 60 + start.getMinutes();
                                        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

                                        const top = `${(startMinutes / 60) * hourHeight}px`;
                                        const height = `${Math.max(50, (durationMinutes / 60) * hourHeight)}px`;

                                        return { top, height };
                                      };

                                      const position = getBookingPosition(booking);

                                      return enableDragDrop ? (
                                        <DraggableBookingCard
                                          key={booking.id}
                                          booking={{
                                            id: booking.id,
                                            starts_at: booking.starts_at,
                                            ends_at: booking.ends_at,
                                            status: booking.status,
                                            customer: booking.customer ? {
                                              name: booking.customer.name,
                                              email: booking.customer.email || undefined,
                                              phone: booking.customer.phone
                                            } : undefined,
                                            service: booking.service ? {
                                              name: booking.service.name,
                                              duration_min: booking.service.duration_min,
                                              price_cents: booking.service.price_cents
                                            } : undefined,
                                            staff: booking.staff ? {
                                              name: booking.staff.name
                                            } : undefined
                                          }}
                                          position={position}
                                          density={density}
                                          onDragEnd={handleBookingDrag}
                                          onResizeEnd={handleBookingResize}
                                          onClick={() => onBookingClick(booking)}
                                          dragConstraints={{
                                            top: 0,
                                            bottom: 12 * hourHeight, // 12 horas máximo
                                          }}
                                          snapToGrid={true}
                                        />
                                      ) : (
                                        <div
                                          key={booking.id}
                                          style={{
                                            position: "absolute",
                                            left: "8px",
                                            right: "8px",
                                            top: position.top,
                                            height: position.height,
                                            minHeight: "50px",
                                          }}
                                        >
                                          <BookingCard
                                            booking={booking}
                                            timezone={tenantTimezone}
                                            variant="day"
                                            onClick={() => onBookingClick(booking)}
                                            canDrag={enableDragDrop}
                                            canResize={enableDragDrop}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }}
                            </Timeline>
                          </div>
                        </div>

                        {/* Vista Lista (Mobile) */}
                        <div className="md:hidden flex-1 min-h-0" role="region" aria-label="Lista de reservas del día">
                          <div className="space-y-3 p-4">
                            {bookings.map((booking) => (
                              <BookingCard
                                key={booking.id}
                                booking={booking}
                                timezone={tenantTimezone}
                                variant="list"
                                onClick={() => onBookingClick(booking)}
                                canDrag={enableDragDrop}
                                canResize={enableDragDrop}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {viewMode === "week" && (
                      <WeekView
                        bookings={bookings}
                        staffList={staffList}
                        selectedDate={selectedDate}
                        timezone={tenantTimezone}
                        onBookingClick={onBookingClick}
                      />
                    )}

                    {viewMode === "month" && (
                      <MonthView
                        bookings={bookings}
                        selectedDate={selectedDate}
                        onDateSelect={onDateChange}
                        onBookingClick={onBookingClick}
                        timezone={tenantTimezone}
                      />
                    )}

                    {viewMode === "list" && (
                      <ListView
                        bookings={bookings}
                        selectedDate={selectedDate}
                        viewMode="list"
                        timezone={tenantTimezone}
                        onBookingClick={onBookingClick}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Apple-style FAB */}
          {viewMode === "day" && (
            <UiFab
              onClick={onNewBooking}
              label="Nueva cita"
              icon={<span className="text-lg font-semibold">+</span>}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Overlays de carga premium */}
      <AnimatePresence>
        {dragLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm flex items-center justify-center"
          >
            <PremiumLoader
              type="saving"
              message="Actualizando horario..."
              variant="spinner"
              className="shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resizeLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm flex items-center justify-center"
          >
            <PremiumLoader
              type="optimizing"
              message="Ajustando duración..."
              variant="progress"
              className="shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
