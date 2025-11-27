"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking, Staff, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ListView } from "@/components/calendar/ListView";
import { UiFab } from "@/components/ui/apple-ui-kit";
import { PremiumLoader } from "./PremiumLoader";
import { PremiumSkeleton } from "./PremiumSkeleton";
import { DayView } from "./views/DayView";
import { ConflictZone } from "./ConflictZone";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { AppointmentCard } from "./AppointmentCard";
import { Card } from "@/components/ui/Card";

type ViewMode = "day" | "week" | "month" | "list";

interface AgendaContentProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  bookings: Booking[];
  staffList: Staff[];
  staffBlockings: StaffBlocking[];
  staffSchedules: StaffSchedule[];
  loading: boolean;
  error: string | null;
  tenantTimezone: string;
  onBookingClick: (booking: Booking) => void;
  onNewBooking: () => void;
  density: "default" | "compact" | "ultra-compact";
  // Nuevas props para interactividad premium
  onBookingDrag?: (bookingId: string, newTime: string, newStaffId?: string) => void;
  onBookingResize?: (bookingId: string, newEndTime: string) => void;
  showConflicts?: boolean;
  onPopoverShow?: (position: { x: number; y: number }, slot?: { staffId: string; date: string; time: string }, booking?: Booking) => void;
  onBookingContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
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
  staffBlockings,
  staffSchedules,
  loading,
  error,
  tenantTimezone,
  onBookingClick,
  onNewBooking,
  density,
  // Nuevas props para interactividad premium
  onBookingDrag,
  onBookingResize,
  showConflicts = true,
  onPopoverShow,
  onBookingContextMenu,
}: AgendaContentProps) {
  // Phase 2: Mobile-first responsive viewport detection
  const isMobile = useMediaQuery("(max-width: 768px)");

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
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
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

                        {!isMobile && (
                          <DayView
                            bookings={bookings}
                            staffBlockings={staffBlockings}
                            staffList={staffList}
                            staffSchedules={staffSchedules}
                            selectedDate={selectedDate}
                            timezone={tenantTimezone}
                            onBookingClick={onBookingClick}
                            onSlotClick={(e, staffId, timeSlot) => onNewBooking()}
                            onBookingMove={onBookingDrag ? (bookingId, newStaffId, newStartTime, newEndTime) => onBookingDrag(bookingId, newStartTime, newStaffId) : undefined}
                            onBookingResize={onBookingResize}
                            onPopoverShow={onPopoverShow}
                            onBookingContextMenu={onBookingContextMenu}
                          />
                        )}

                        {isMobile && (
                          <div className="flex-1 min-h-0" role="region" aria-label="Lista de reservas del día">
                            <div className="space-y-3 p-4">
                              {bookings.map((booking) => (
                                <AppointmentCard
                                  key={booking.id}
                                  booking={booking}
                                  timezone={tenantTimezone}
                                  variant="list"
                                  onClick={() => onBookingClick(booking)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
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
    </div>
  );
}
