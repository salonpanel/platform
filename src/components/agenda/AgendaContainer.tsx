"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Booking, Staff } from "@/types/agenda";
import { AgendaTopBar } from "@/components/agenda/AgendaTopBar";
import { AgendaContextBar } from "@/components/agenda/AgendaContextBar";
import { AgendaContent } from "@/components/agenda/AgendaContent";
import { AgendaSidebar } from "@/components/calendar/AgendaSidebar";
import { NotificationProvider, useNotificationActions } from "./NotificationSystem";

// Types for the data coming from useAgendaData hook
interface QuickStats {
  totalBookings: number;
  totalHours: number;
  totalAmount: number;
  rangeLabel?: string;
}

interface StaffUtilization {
  staffId: string;
  staffName: string;
  utilization: number;
}

interface ActiveFilter {
  id: string;
  label: string;
  onRemove: () => void;
}

interface AgendaContainerProps {
  // Data from useAgendaData hook
  loading: boolean;
  error: string | null;
  staffList: Staff[];
  bookings: Booking[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filters: any;
  setFilters: (filters: any) => void;
  activeFiltersCount: number;
  filteredBookings: Booking[];
  visibleStaff: Staff[];
  quickStats: QuickStats | undefined;
  staffUtilization: StaffUtilization[];
  refreshDaySnapshots: () => void;

  // Core state from page.tsx
  tenantId: string | null;
  tenantTimezone: string;
  selectedDate: string;
  selectedStaffId: string | null;
  viewMode: "day" | "week" | "month" | "list";

  // Callbacks from page.tsx
  onDateChange: (dateStr: string) => void;
  onViewModeChange: (mode: "day" | "week" | "month" | "list") => void;
  onStaffChange: (staffId: string | null) => void;
  onBookingClick: (booking: Booking) => void;
  onNewBooking: () => void;
  onBookingDrag?: (bookingId: string, newTime: string, newStaffId?: string) => Promise<void>;
  onBookingResize?: (bookingId: string, newEndTime: string) => Promise<void>;

  // UI state
  searchOpen: boolean;
  onSearchToggle: () => void;
  onSearchClose: () => void;
  selectedBooking: Booking | null;
  newBookingOpen: boolean;

  // Options
  density?: "default" | "compact" | "ultra-compact";
  enableDragDrop?: boolean;
  showConflicts?: boolean;
}

/**
 * AgendaContainer - Premium 3-zone layout optimizado
 * ZONE 1: AgendaTopBar (sticky header con glassmorphism)
 * ZONE 2: AgendaContextBar (KPIs + filtros de staff)
 * ZONE 3: Agenda Canvas (contenido principal del calendario)
 */
export function AgendaContainer({
  loading,
  error,
  staffList,
  bookings,
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  activeFiltersCount,
  filteredBookings,
  visibleStaff,
  quickStats,
  staffUtilization,
  refreshDaySnapshots,
  tenantId,
  tenantTimezone,
  selectedDate,
  selectedStaffId,
  viewMode,
  onDateChange,
  onViewModeChange,
  onStaffChange,
  onBookingClick,
  onNewBooking,
  onBookingDrag,
  onBookingResize,
  searchOpen,
  onSearchToggle,
  onSearchClose,
  selectedBooking,
  newBookingOpen,
  density = "default",
  enableDragDrop = true,
  showConflicts = true,
}: AgendaContainerProps) {
  const { success, error: showError, warning, info, achievement } = useNotificationActions();

  // Formateadores memoizados
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: tenantTimezone,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [tenantTimezone]
  );

  // Callbacks for UI interactions
  const handleResetFilters = useCallback(() => {
    onDateChange(format(new Date(), "yyyy-MM-dd"));
    onStaffChange(null);
    setSearchTerm("");
  }, [onDateChange, onStaffChange, setSearchTerm]);

  // Handlers para drag & drop premium (using props from page.tsx)
  const handleBookingDrag = useCallback(async (bookingId: string, newTime: string, newStaffId?: string) => {
    if (onBookingDrag) {
      try {
        await onBookingDrag(bookingId, newTime, newStaffId);
        success(
          "Cita movida correctamente",
          `La cita se ha reprogramado para ${new Date(newTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
          {
            label: "Ver en calendario",
            onClick: () => {
              onViewModeChange("day");
              onDateChange(new Date(newTime).toISOString().split('T')[0]);
            }
          }
        );
      } catch (error) {
        console.error('❌ Error updating booking position:', error);
        showError(
          "Error al mover la cita",
          "No se pudo actualizar el horario. Inténtalo de nuevo.",
          {
            label: "Reintentar",
            onClick: () => handleBookingDrag(bookingId, newTime, newStaffId)
          }
        );
      }
    }
  }, [onBookingDrag, success, showError, onViewModeChange, onDateChange]);

  const handleBookingResize = useCallback(async (bookingId: string, newEndTime: string) => {
    if (onBookingResize) {
      try {
        await onBookingResize(bookingId, newEndTime);
        success(
          "Duración actualizada",
          "La duración de la cita se ha ajustado correctamente"
        );
      } catch (error) {
        console.error('❌ Error updating booking duration:', error);
        showError(
          "Error al ajustar duración",
          "No se pudo actualizar la duración. Inténtalo de nuevo."
        );
      }
    }
  }, [onBookingResize, success, showError]);

  // Filtros aplicados actualmente
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const filters: ActiveFilter[] = [];
    if (selectedStaffId) {
      const staff = staffList.find((s) => s.id === selectedStaffId);
      if (staff) {
        filters.push({
          id: "staff",
          label: `Staff: ${staff.name}`,
          onRemove: () => onStaffChange(null),
        });
      }
    }
    return filters;
  }, [selectedStaffId, staffList, onStaffChange]);

  // UI state for sidebar (mobile drawer behavior)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider position="top-right" maxNotifications={3}>
      <div className="min-h-screen bg-[#0E0F11] text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(58,109,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(79,227,193,0.08),transparent_30%)]" />

        <main className="relative z-10 max-w-7xl mx-auto px-4 lg:px-10 py-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          >
            <AgendaTopBar
              selectedDate={selectedDate}
              viewMode={viewMode}
              onDateChange={onDateChange}
              onViewModeChange={onViewModeChange}
              onSearchClick={onSearchToggle}
              onNotificationsClick={() => {}}
              onFiltersClick={() => setSidebarOpen(true)}
            />
          </motion.div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.05 }}
                className="rounded-2xl border border-white/8 bg-[#15171A]/80 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              >
                <AgendaContextBar
                  quickStats={quickStats}
                  staffUtilization={staffUtilization}
                  staffList={staffList}
                  selectedStaffId={selectedStaffId}
                  onStaffChange={onStaffChange}
                  viewMode={viewMode}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.08 }}
                className="rounded-2xl border border-white/8 bg-[#15171A]/90 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]"
              >
                <AgendaContent
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange}
                  selectedDate={selectedDate}
                  onDateChange={onDateChange}
                  bookings={filteredBookings}
                  staffList={visibleStaff}
                  loading={loading}
                  error={error}
                  tenantTimezone={tenantTimezone}
                  onBookingClick={onBookingClick}
                  onNewBooking={onNewBooking}
                  density={density}
                  timeFormatter={timeFormatter}
                  onBookingDrag={handleBookingDrag}
                  onBookingResize={handleBookingResize}
                  enableDragDrop={enableDragDrop}
                  showConflicts={showConflicts}
                  notificationActions={{ info, warning }}
                />
              </motion.div>
            </div>

            <motion.aside
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.12 }}
              className="space-y-4 lg:sticky lg:top-8"
            >
              <div className="rounded-2xl border border-white/8 bg-[#15171A]/85 backdrop-blur-xl shadow-[0_12px_50px_rgba(0,0,0,0.4)]">
                <AgendaSidebar
                  selectedDate={selectedDate}
                  onDateSelect={onDateChange}
                  filters={filters}
                  onFiltersChange={setFilters}
                  staffList={staffList}
                  showFreeSlots={false}
                  onShowFreeSlotsChange={() => {}}
                  isOpen={sidebarOpen}
                  onOpen={() => setSidebarOpen(true)}
                  onClose={() => setSidebarOpen(false)}
                />
              </div>
            </motion.aside>
          </div>
        </main>
      </div>
    </NotificationProvider>
  );
}
