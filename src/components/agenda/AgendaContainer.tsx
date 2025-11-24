"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
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
      {/* Fondo principal con gradiente sutil */}
      <div className="h-full bg-gradient-to-br from-[#0A0F14] via-[#0E1419] to-[#12181F] relative overflow-hidden">
        {/* Overlay de profundidad con glassmorphism */}
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(58,109,255,0.015)] via-transparent to-[rgba(79,227,193,0.008)] pointer-events-none" />
        
        {/* Estructura principal sin solapamientos */}
        <div className="h-full flex flex-col relative z-10">
          {/* NIVEL 1: TOPBAR STICKY - Máxima prominencia visual */}
          <div className="sticky top-0 z-50 backdrop-blur-xl bg-[rgba(10,15,20,0.92)] border-b border-[rgba(255,255,255,0.06)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <AgendaTopBar
              selectedDate={selectedDate}
              viewMode={viewMode}
              onDateChange={onDateChange}
              onViewModeChange={onViewModeChange}
              onSearchClick={onSearchToggle}
              onNotificationsClick={() => {}} // TODO: Implement notifications
              onFiltersClick={() => setSidebarOpen(true)} // Mobile filters drawer
            />
          </div>

          {/* NIVEL 2: CONTEXT BAR - KPIs y staff sin interferir */}
          <div className="flex-shrink-0 bg-[rgba(15,23,42,0.4)] backdrop-blur-md border-b border-[rgba(255,255,255,0.03)]">
            <AgendaContextBar
              quickStats={quickStats}
              staffUtilization={staffUtilization}
              staffList={staffList}
              selectedStaffId={selectedStaffId}
              onStaffChange={onStaffChange}
              viewMode={viewMode}
            />
          </div>

          {/* ÁREA DE CONTENIDO PRINCIPAL - Sin competencia visual */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* NIVEL 3: SIDEBAR - Mínima interferencia visual */}
            <div className="relative flex-shrink-0">
              {/* Backdrop móvil sutil */}
              {sidebarOpen && (
                <div
                  className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                  onClick={() => setSidebarOpen(false)}
                />
              )}

              {/* Sidebar con peso visual reducido */}
              <div className={cn(
                "transition-all duration-300 ease-out h-full",
                // Mobile: Drawer overlay
                "lg:relative lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 lg:z-auto",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                // Desktop: Ancho optimizado
                "w-80 lg:w-72 xl:w-80",
                // Fondo sutil para no competir
                "bg-[rgba(15,23,42,0.35)] backdrop-blur-md border-r border-[rgba(255,255,255,0.04)]",
                "shadow-[0_0_24px_rgba(0,0,0,0.15)] lg:shadow-none"
              )}>
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
              </div>
            </div>

            {/* NIVEL 1: CANVAS PRINCIPAL - Máximo contraste y claridad */}
            <div className="flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-[#0A0F14] to-[#0E1419] relative">
              {/* Sutil textura de fondo */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(58,109,255,0.02),transparent_50%)] pointer-events-none" />
              
              <div className="relative z-10 h-full">
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
      </div>
    </NotificationProvider>
  );
}
