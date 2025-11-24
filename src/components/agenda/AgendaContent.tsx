"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking, Staff } from "@/types/agenda";
import { AgendaHeader } from "@/components/calendar/AgendaHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ListView } from "@/components/calendar/ListView";
import { FloatingActionButton } from "@/components/calendar/FloatingActionButton";
import { BookingDetailPanel } from "@/components/calendar/BookingDetailPanel";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import { Timeline } from "./Timeline";
import { MiniBookingCard } from "./MiniBookingCard";
import { Card, Spinner, EmptyState } from "@/components/ui";

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
  heightAware: any;
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
}: AgendaContentProps) {
  // Función adaptadora memoizada
  const adaptBookingToMiniCard = useMemo(() =>
    (booking: Booking): MiniBookingCardData => ({
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
    }), []
  );

  // Calcular hourHeight dinámicamente según altura disponible
  const availableHeight = heightAware.availableHeight;
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut" as const,
      },
    },
  };

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
    <div className="flex-1 min-h-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key="agenda-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="h-full flex flex-col min-h-0 overflow-hidden"
        >
          {/* Header inteligente */}
          <div className="flex-shrink-0 mb-4">
            <AgendaHeader
              selectedDate={selectedDate}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              onDateChange={onDateChange}
              timeRange="8:00 – 20:00"
              onNotificationsClick={() => {}}
              onSearchClick={() => {}}
              onCalendarClick={() => {}}
              quickStats={undefined}
              searchOpen={false}
              searchTerm=""
              onSearchChange={() => {}}
              onSearchClose={() => {}}
              staffUtilization={[]}
              onStaffFilterChange={() => {}}
            />
          </div>

          {/* Contenido principal según vista */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-1 min-h-0 overflow-hidden"
          >
            {loading ? (
              <Card variant="default" density={density} className="h-full flex items-center justify-center border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]">
                <div className="text-center">
                  <Spinner size="lg" className="text-[var(--accent-aqua)]" />
                  <p
                    className="mt-4 text-lg font-medium"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Cargando agenda...
                  </p>
                </div>
              </Card>
            ) : bookings.length === 0 ? (
              <Card variant="default" density={density} className="h-full flex items-center justify-center border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]">
                <div className="text-center max-w-md mx-auto px-6">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-aqua)] p-1">
                    <div className="w-full h-full rounded-2xl bg-[var(--bg-primary)] flex items-center justify-center">
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
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                    No hay reservas
                  </h3>
                  <p className="text-[var(--text-secondary)] mb-6" style={{ fontFamily: "var(--font-body)" }}>
                    {viewMode === "day"
                      ? "No hay citas para este día. ¿Quieres crear una nueva reserva?"
                      : "No hay citas en este período."
                    }
                  </p>
                  {viewMode === "day" && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onNewBooking}
                      className={cn(
                        "px-6 py-3 rounded-[var(--radius-lg)] font-semibold transition-all duration-200",
                        "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] text-white border-0",
                        "shadow-lg hover:shadow-xl hover:shadow-[var(--accent-aqua)]/25"
                      )}
                    >
                      Nueva Reserva
                    </motion.button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="h-full flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 min-h-0"
                  >
                    {viewMode === "day" && (
                      <div className="h-full flex flex-col min-h-0 overflow-hidden">
                        {/* Vista Timeline (Desktop/Tablet) */}
                        <div className="hidden md:flex flex-1 min-h-0">
                          <div className="flex-1 min-h-0 overflow-y-auto" role="region" aria-label="Vista diaria de reservas">
                            <Timeline
                              startHour={8}
                              endHour={20}
                              density={density}
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
                                    {hourBookings.map((booking) => (
                                      <MiniBookingCard
                                        key={booking.id}
                                        booking={adaptBookingToMiniCard(booking)}
                                        density={density}
                                        onClick={() => onBookingClick(booking)}
                                      />
                                    ))}
                                  </div>
                                );
                              }}
                            </Timeline>
                          </div>
                        </div>

                        {/* Vista Lista (Mobile) */}
                        <div className="md:hidden flex-1 min-h-0 overflow-y-auto" role="region" aria-label="Lista de reservas del día">
                          <div className="space-y-3 p-4">
                            {bookings.map((booking) => (
                              <MiniBookingCard
                                key={booking.id}
                                booking={adaptBookingToMiniCard(booking)}
                                density={density}
                                onClick={() => onBookingClick(booking)}
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

          {/* Floating Action Button */}
          {viewMode === "day" && (
            <FloatingActionButton
              onClick={onNewBooking}
              className="fixed bottom-6 right-6 z-50"
              aria-label="Crear nueva reserva"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export { AgendaContent };
