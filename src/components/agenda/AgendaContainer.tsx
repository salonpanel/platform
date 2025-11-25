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
}: AgendaContainerProps) {
  const { success, error: showError, warning, info, achievement } = useNotificationActions();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Marcar que ya no es carga inicial después de primer render
  useEffect(() => {
    if (!loading && staffList.length > 0) {
      setIsInitialLoad(false);
    }
  }, [loading, staffList.length]);

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

  // UI state for sidebar (mobile drawer behavior)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider position="top-right" maxNotifications={3}>
      <div className="h-full flex flex-col">
        {/* Fixed Header Section - SIN animación en carga inicial */}
        <div className="flex-shrink-0 space-y-4">
          <AgendaTopBar
            selectedDate={selectedDate}
            viewMode={viewMode}
            onDateChange={onDateChange}
            onViewModeChange={onViewModeChange}
            onSearchClick={onSearchToggle}
            onNotificationsClick={onNotificationsToggle}
            unreadNotifications={unreadNotifications}
            onFiltersClick={() => setSidebarOpen(true)}
          />

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
        </div>

        {/* Scrollable Content Section */}
        <div className="flex-1 min-h-0 mt-4">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 h-full">
            {/* Main calendar area */}
            <div className="flex flex-col h-full overflow-hidden">
              {/* Day summary stats */}
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
              </div>
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:flex flex-col h-full overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <AgendaSidebar
                  selectedDate={selectedDate}
                  onDateSelect={onDateChange}
                  filters={filters}
                  onFiltersChange={setFilters}
                  isOpen={sidebarOpen}
                  onOpen={() => setSidebarOpen(true)}
                  onClose={() => setSidebarOpen(false)}
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}
