"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
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
 * AgendaContainer - Premium 3-zone layout
 * ZONE 1: AgendaTopBar (sticky header)
 * ZONE 2: AgendaContextBar (KPIs + filters)
 * ZONE 3: Agenda Canvas (calendar content)
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

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: tenantTimezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
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
      <div className="h-full bg-slate-950">
        <div className="h-full flex flex-col min-h-0">
          {/* ZONE 1: TOP APP HEADER (sticky) */}
          <AgendaTopBar
            selectedDate={selectedDate}
            viewMode={viewMode}
            onDateChange={onDateChange}
            onViewModeChange={onViewModeChange}
            onSearchClick={onSearchToggle}
            onNotificationsClick={() => {}} // TODO: Implement notifications
            onFiltersClick={() => setSidebarOpen(true)} // Mobile filters drawer
          />

          {/* ZONE 2: CONTEXT TOOLBAR (KPIs + filters) */}
          <AgendaContextBar
            quickStats={quickStats}
            staffUtilization={staffUtilization}
            staffList={staffList}
            selectedStaffId={selectedStaffId}
            onStaffChange={onStaffChange}
            viewMode={viewMode}
          />

          {/* Main Content Area with Sidebar */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Responsive Sidebar - Drawer in mobile, collapsible in tablet, fixed in desktop */}
            <AgendaSidebar
              selectedDate={selectedDate}
              onDateSelect={onDateChange}
              filters={filters}
              onFiltersChange={setFilters}
              staffList={staffList}
              showFreeSlots={false}
              onShowFreeSlotsChange={() => {}}
              // Mobile drawer control
              isOpen={sidebarOpen}
              onOpen={() => setSidebarOpen(true)}
              onClose={() => setSidebarOpen(false)}
            />

            {/* ZONE 3: AGENDA CANVAS (main scrollable area) */}
            <div className="flex-1 min-h-0 overflow-hidden">
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
                // Props premium para interactividad
                onBookingDrag={handleBookingDrag}
                onBookingResize={handleBookingResize}
                enableDragDrop={enableDragDrop}
                showConflicts={showConflicts}
                // Phase 2: Mobile responsive notification access
                notificationActions={{ info, warning }}
              />
            </div>
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}
