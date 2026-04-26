import { useMemo, useCallback, useState, useEffect } from "react";
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
import { NoShowAlert } from "./NoShowAlert";
import { MobileStaffSwitcher } from "./MobileStaffSwitcher";
import { MobileDaySummary } from "./MobileDaySummary";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTouchSwipe } from "@/hooks/useTouchSwipe";
import { AppointmentCard } from "./AppointmentCard";
import { GlassCard, GlassEmptyState } from "@/components/ui/glass";
import { Users, Calendar, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MobileAgendaToolbarProps } from "@/components/agenda/AgendaQuickActions";

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
  /** En móvil, acciones de agenda en la barra superior de WeekView (junto al selector de staff) */
  mobileToolbar?: MobileAgendaToolbarProps | null;
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
  mobileToolbar = null,
}: AgendaContentProps) {
  // Phase 2: Mobile-first responsive viewport detection
  const isMobile = useMediaQuery("(max-width: 768px)");

  // En móvil siempre usamos la vista semanal (el selector de vista está oculto en móvil).
  const effectiveViewMode = isMobile ? "week" : viewMode;

  // Mobile staff selection.
  // null = "Todos" (válido en vista semana).
  // El fallback a staffList[0] ocurre en mobileActiveStaffId para vistas que no admiten null.
  const [mobileSelectedStaffId, setMobileSelectedStaffId] = useState<string | null>(null);

  // Resolve the active staff id on mobile — always a real staff id (never null on mobile)
  const mobileActiveStaffId = useMemo(() => {
    if (!isMobile) return mobileSelectedStaffId;
    // En móvil la vista efectiva es siempre "week" → Todos (null) es válido
    return mobileSelectedStaffId;
  }, [isMobile, mobileSelectedStaffId]);

  // Touch swipe for day navigation on mobile
  const { onTouchStart, onTouchEnd } = useTouchSwipe({
    onSwipeLeft: () => {
      if (viewMode === "day") {
        const next = new Date(selectedDate + "T00:00:00");
        next.setDate(next.getDate() + 1);
        onDateChange(next.toISOString().split("T")[0]);
      }
    },
    onSwipeRight: () => {
      if (viewMode === "day") {
        const prev = new Date(selectedDate + "T00:00:00");
        prev.setDate(prev.getDate() - 1);
        onDateChange(prev.toISOString().split("T")[0]);
      }
    },
    disabled: !isMobile || viewMode !== "day",
  });

  // On mobile: always filter to single staff (never multi-column)
  const mobileStaffList = useMemo(() => {
    if (!isMobile) return staffList;
    const activeId = mobileActiveStaffId;
    if (!activeId) return staffList.slice(0, 1); // fallback: first
    return staffList.filter((s) => s.id === activeId);
  }, [isMobile, mobileActiveStaffId, staffList]);

  const mobileBookings = useMemo(() => {
    if (!isMobile) return bookings;
    const activeId = mobileActiveStaffId;
    if (!activeId) return [];
    return bookings.filter((b) => b.staff_id === activeId);
  }, [isMobile, mobileActiveStaffId, bookings]);

  // Booking count per staff (for tab badges)
  const bookingCountsByStaff = useMemo(() => {
    const counts: Record<string, number> = {};
    staffList.forEach((s) => { counts[s.id] = 0; });
    bookings.forEach((b) => {
      if (b.staff_id && counts[b.staff_id] !== undefined) {
        counts[b.staff_id]++;
      }
    });
    return counts;
  }, [bookings, staffList]);

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
          <h3 className="mb-2 font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
            Error
          </h3>
          <p className="text-sm" style={{ fontFamily: "var(--font-sans)" }}>
            {error}
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="agenda-content"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
        >
          {/* Contenido principal según vista */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {loading && staffList.length === 0 ? (
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
                  className="flex h-full min-h-0 flex-1 flex-col"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={effectiveViewMode}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
                    >
                      {effectiveViewMode === "day" && (
                        staffList.length > 0 ? (
                          <div className="h-full flex flex-col min-h-0">
                            {/* Mobile: Staff switcher — Fresha-style arrow+sheet picker, replaces horizontal tabs */}
                            {isMobile && staffList.length > 1 && (
                              <div className="flex-shrink-0">
                                <MobileStaffSwitcher
                                  staffList={staffList}
                                  selectedStaffId={mobileActiveStaffId}
                                  onSelectStaff={(id) => setMobileSelectedStaffId(id)}
                                  bookingCounts={bookingCountsByStaff}
                                  includeAllOption={false}
                                />
                              </div>
                            )}

                            {/* Alertas no-show — siempre visible cuando hay retrasos */}
                            <NoShowAlert
                              bookings={isMobile ? mobileBookings : bookings}
                              tenantTimezone={tenantTimezone}
                              className="mx-3 mt-1"
                            />

                            {/* Zona de conflictos premium */}
                            {showConflicts && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex-shrink-0 mb-2"
                              >
                                <ConflictZone
                                  bookings={isMobile ? mobileBookings : bookings}
                                  tenantTimezone={tenantTimezone}
                                  className="mx-3"
                                />
                              </motion.div>
                            )}

                            {/* DayView — on mobile uses filtered staff/bookings for single-staff focus */}
                            <div className="flex-1 min-h-0">
                              <DayView
                                bookings={isMobile ? mobileBookings : bookings}
                                staffBlockings={staffBlockings}
                                staffList={isMobile ? mobileStaffList : staffList}
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

                            {/* Mobile: lista colapsable debajo del grid */}
                            {isMobile && (
                              <MobileDaySummary
                                bookings={isMobile && mobileSelectedStaffId ? mobileBookings : bookings}
                                timezone={tenantTimezone}
                                onBookingClick={onBookingClick}
                              />
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

                      {effectiveViewMode === "week" && (
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
                            mobileSelectedStaffId={mobileSelectedStaffId}
                            onMobileStaffChange={(id) => setMobileSelectedStaffId(id)}
                            bookingCounts={isMobile ? bookingCountsByStaff : undefined}
                            mobileToolbar={isMobile ? mobileToolbar ?? undefined : undefined}
                            onDateChange={onDateChange}
                            onNewBooking={onNewBooking}
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

                      {effectiveViewMode === "month" && (
                        <MonthView
                          bookings={bookings}
                          selectedDate={selectedDate}
                          onDateSelect={onDateChange}
                          onDayViewClick={(date) => {
                            onDateChange(date);
                            onViewModeChange("day");
                          }}
                          onBookingClick={onBookingClick}
                          onBookingContextMenu={onBookingContextMenu}
                          timezone={tenantTimezone}
                        />
                      )}

                      {effectiveViewMode === "list" && (
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

          {/* FAB nueva cita: solo desktop; en móvil: pulsación larga en el botón central de la barra (Agenda) */}
          {!isMobile && (
            <UiFab
              onClick={onNewBooking}
              label="Nueva cita"
              icon={<span className="text-lg font-semibold">+</span>}
              className="md:bottom-6"
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
