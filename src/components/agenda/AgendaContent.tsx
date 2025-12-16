import { useMemo, useCallback } from "react";
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
import { GlassCard, GlassEmptyState } from "@/components/ui/glass";
import { Users, Calendar, Filter } from "lucide-react";
import { useRouter } from "next/navigation";

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
  slotPopover?: {
    open: boolean;
    position: { x: number; y: number };
    slot: { staffId: string; date: string; time: string };
  } | null;
  onSlotPopoverClose?: () => void;
  onSlotNewBooking?: (slot: { staffId: string; date: string; time: string }) => void;
  onSlotBlock?: (slot: { staffId: string; date: string; time: string }) => void;
  onSlotAbsence?: (slot: { staffId: string; date: string; time: string }) => void;
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
  slotPopover,
  onSlotPopoverClose,
  onSlotNewBooking,
  onSlotBlock,
  onSlotAbsence,
}: AgendaContentProps) {
  // Phase 2: Mobile-first responsive viewport detection
  const isMobile = useMediaQuery("(max-width: 768px)");

  // G.3.1: Memoize handler adapter to prevent re-renders of DayView
  const handleBookingMove = useCallback((bookingId: string, newStaffId: string | undefined, newStartTime: string, newEndTime: string) => {
    if (onBookingDrag) {
      onBookingDrag(bookingId, newStartTime, newStaffId);
    }
  }, [onBookingDrag]);

  if (error) {
    return (
      <GlassCard className="border-[var(--color-danger)]/50 bg-[var(--color-danger-glass)]">
        <div className="text-[var(--color-danger)]">
          <h3 className="mb-2 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Error
          </h3>
          <p className="text-sm" style={{ fontFamily: "var(--font-body)" }}>
            {error}
          </p>
        </div>
      </GlassCard>
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
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex-1 min-h-0 overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading-skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  className="flex items-center justify-center min-h-[400px]"
                >
                  <PremiumSkeleton
                    type="agenda-grid"
                    density={density}
                    className="w-full max-w-4xl"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="content-loaded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-full flex flex-col"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={viewMode}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="flex-1 min-h-0"
                    >
                      {viewMode === "day" && (
                        staffList.length > 0 ? (
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

                            {/* Siempre mostramos DayView para que se vean horas y franjas, también en móvil */}
                            <div className="flex-1 min-h-0">
                              <DayView
                                bookings={bookings}
                                staffBlockings={staffBlockings}
                                staffList={staffList}
                                staffSchedules={staffSchedules}
                                selectedDate={selectedDate}
                                timezone={tenantTimezone}
                                onBookingClick={onBookingClick}
                                onSlotClick={undefined}
                                onBookingMove={onBookingDrag ? (bookingId, newStaffId, newStartTime, newEndTime) => onBookingDrag(bookingId, newStartTime, newStaffId) : undefined}
                                onBookingResize={onBookingResize}
                                onPopoverShow={onPopoverShow}
                                onBookingContextMenu={onBookingContextMenu}
                                slotPopover={slotPopover}
                                onSlotPopoverClose={onSlotPopoverClose}
                                onSlotNewBooking={onSlotNewBooking}
                                onSlotBlock={onSlotBlock}
                                onSlotAbsence={onSlotAbsence}
                              />
                            </div>

                            {/* En móvil mantenemos la lista como vista complementaria bajo el timeline */}
                            {isMobile && bookings.length > 0 && (
                              <div className="flex-shrink-0 border-t border-white/5 bg-[#0B0C10]" role="region" aria-label="Lista de reservas del día">
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
                        ) : (
                          <div className="h-full flex items-center justify-center p-8">
                            <GlassEmptyState
                              icon={Users}
                              title="Sin miembros del equipo"
                              description="No hay estilistas seleccionados o configurados. Revisa los filtros o añade personal."
                              variant="default"
                            />
                          </div>
                        )
                      )}

                      {viewMode === "week" && (
                        staffList.length > 0 ? (
                          <WeekView
                            bookings={bookings}
                            staffList={staffList}
                            selectedDate={selectedDate}
                            timezone={tenantTimezone}
                            onBookingClick={onBookingClick}
                            onPopoverShow={onPopoverShow}
                            onBookingContextMenu={onBookingContextMenu}
                            staffSchedules={staffSchedules}
                            staffBlockings={staffBlockings}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center p-8">
                            <GlassEmptyState
                              icon={Users}
                              title="Sin miembros del equipo"
                              description="No hay estilistas seleccionados para ver la semana."
                              variant="default"
                            />
                          </div>
                        )
                      )}

                      {viewMode === "month" && (
                        <MonthView
                          bookings={bookings}
                          selectedDate={selectedDate}
                          onDateSelect={onDateChange}
                          onBookingClick={onBookingClick}
                          onBookingContextMenu={onBookingContextMenu}
                          timezone={tenantTimezone}
                        />
                      )}

                      {viewMode === "list" && (
                        bookings.length > 0 ? (
                          <ListView
                            bookings={bookings}
                            selectedDate={selectedDate}
                            viewMode="list"
                            timezone={tenantTimezone}
                            onBookingClick={onBookingClick}
                            onBookingContextMenu={onBookingContextMenu}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center p-8">
                            <GlassEmptyState
                              icon={Filter}
                              title="Sin citas encontradas"
                              description="No hay reservas que coincidan con los filtros o la fecha seleccionada."
                              variant="default"
                            />
                          </div>
                        )
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Apple-style FAB - Always visible on mobile for quick actions */}
          <UiFab
            onClick={onNewBooking}
            label="Nueva cita"
            icon={<span className="text-lg font-semibold">+</span>}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
