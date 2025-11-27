"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Booking, Staff, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { AgendaTopBar } from "@/components/agenda/AgendaTopBar";
import { AgendaContextBar } from "@/components/agenda/AgendaContextBar";
import { AgendaContent } from "@/components/agenda/AgendaContent";
import { NotificationProvider, useNotificationActions } from "./NotificationSystem";
import { AgendaFilters } from "./AgendaFilters";

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
  staffBlockings: StaffBlocking[];
  staffSchedules: StaffSchedule[];
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
  onNotificationsToggle: () => void;
  unreadNotifications?: number;

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

  // Interaction layer
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
  staffBlockings,
  staffSchedules,
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
  onNotificationsToggle,
  unreadNotifications = 0,
  searchOpen,
  onSearchToggle,
  onSearchClose,
  selectedBooking,
  newBookingOpen,
  density = "default",
  enableDragDrop = true,
  showConflicts = true,
  onPopoverShow,
  onBookingContextMenu,
  slotPopover,
  onSlotPopoverClose,
  onSlotNewBooking,
  onSlotBlock,
  onSlotAbsence,
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
  }, [onDateChange, onStaffChange]);

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
          "No se pudo actualizar el horario. Inténtalo de nuevo."
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

  return (
    <NotificationProvider position="top-right" maxNotifications={3}>
      <div className="h-full flex flex-col">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <AgendaTopBar
              selectedDate={selectedDate}
              viewMode={viewMode}
              onDateChange={onDateChange}
              onViewModeChange={onViewModeChange}
              onSearchClick={onSearchToggle}
              onNotificationsClick={onNotificationsToggle}
              unreadNotifications={unreadNotifications}
              staffList={staffList}
              selectedStaffIds={selectedStaffId ? [selectedStaffId] : []}
              onStaffFilterChange={(staffIds) => onStaffChange(staffIds.length > 0 ? staffIds[0] : null)}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: 0.04 }}
          >
            <AgendaFilters
              staffList={staffList}
              selectedStaffId={selectedStaffId}
              onStaffChange={onStaffChange}
              searchOpen={searchOpen}
              searchTerm={searchTerm}
              onSearchToggle={onSearchToggle}
              onSearchChange={setSearchTerm}
              onSearchClose={onSearchClose}
              activeFilters={activeFilters}
              onResetFilters={handleResetFilters}
            />
          </motion.div>
        </div>

        {/* Scrollable Content Section - Full width without sidebar */}
        <div className="flex-1 min-h-0 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Day summary stats - compact bar above calendar */}
            <div className="flex-shrink-0">
              <AgendaContextBar quickStats={quickStats} />
            </div>
            
            {/* Scrollable calendar content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AgendaContent
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                bookings={filteredBookings}
                staffList={visibleStaff}
                staffBlockings={staffBlockings}
                staffSchedules={staffSchedules}
                loading={loading}
                error={error}
                tenantTimezone={tenantTimezone}
                onBookingClick={onBookingClick}
                onNewBooking={onNewBooking}
                density={density}
                onBookingDrag={handleBookingDrag}
                onBookingResize={handleBookingResize}
                showConflicts={showConflicts}
                onPopoverShow={onPopoverShow}
                onBookingContextMenu={onBookingContextMenu}
                slotPopover={slotPopover}
                onSlotPopoverClose={onSlotPopoverClose}
                onSlotNewBooking={onSlotNewBooking}
                onSlotBlock={onSlotBlock}
                onSlotAbsence={onSlotAbsence}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </NotificationProvider>
  );
}
