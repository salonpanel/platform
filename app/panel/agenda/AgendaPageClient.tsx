"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AgendaHeader } from "@/components/calendar/AgendaHeader";
import { AgendaSidebar } from "@/components/calendar/AgendaSidebar";
import { AgendaContent } from "@/components/agenda/AgendaContent";
import { SearchPanel } from "@/components/calendar/SearchPanel";
import { NotificationsPanel } from "@/components/calendar/NotificationsPanel";
import { BookingActionPopover } from "@/components/calendar/BookingActionPopover";
import { BookingDetailPanel } from "@/components/calendar/BookingDetailPanel";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import StaffBlockingModal from "@/components/calendar/StaffBlockingModal";
import { useAgendaModals } from "@/hooks/useAgendaModals";
import { useAgendaData } from "@/hooks/useAgendaData";
import {
  useAgendaHandlers,
  type BookingMutationPayload,
  type SaveBookingResult,
} from "@/hooks/useAgendaHandlers";
import { useToast } from "@/components/ui/Toast";
import type { AgendaDataset } from "@/lib/agenda-data";
import type { Booking, CalendarSlot, ViewMode } from "@/types/agenda";

interface AgendaPageClientProps {
  initialData: AgendaDataset | null;
  error?: string | null;
  impersonateOrgId: string | null;
  initialDate: string;
  initialViewMode: ViewMode;
}

type AgendaFiltersState = {
  payment: string[];
  status: string[];
  staff: string[];
  highlighted: boolean | null;
};

const DEFAULT_FILTERS: AgendaFiltersState = {
  payment: [],
  status: [],
  staff: ["all"],
  highlighted: null,
};

export default function AgendaPageClient({
  initialData,
  error: serverError,
  impersonateOrgId,
  initialDate,
  initialViewMode,
}: AgendaPageClientProps) {
  const tenantId = impersonateOrgId ?? initialData?.tenant.id ?? null;
  const tenantTimezone = initialData?.tenant.timezone ?? "Europe/Madrid";
  const { showToast, ToastComponent } = useToast();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<AgendaFiltersState>(DEFAULT_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [slotPopover, setSlotPopover] = useState<
    | {
      open: boolean;
      position: { x: number; y: number };
      slot: CalendarSlot;
    }
    | null
  >(null);
  const [bookingPopover, setBookingPopover] = useState<
    | {
      open: boolean;
      position: { x: number; y: number };
      booking: Booking;
    }
    | null
  >(null);
  const [notifications, setNotifications] = useState(
    () =>
      initialData
        ? []
        : [
          {
            id: "1",
            type: "info" as const,
            title: "Agenda lista",
            message: "Las notificaciones llegarán aquí",
            timestamp: "Hace 1 min",
            read: false,
          },
        ]
  );

  useEffect(() => {
    if (notificationsOpen) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, [notificationsOpen]);

  const modals = useAgendaModals();

  const {
    loading,
    error,
    staffList,
    services,
    customers,
    bookings,
    staffBlockings,
    staffSchedules,
    stats,
    rangeLabel,
    refreshDaySnapshots,
  } = useAgendaData({
    tenantId,
    selectedDate,
    viewMode,
    initialData,
  });

  const { saveBooking, saveBlocking, moveBooking, resizeBooking } = useAgendaHandlers({
    tenantId,
    onAfterMutation: () => refreshDaySnapshots(selectedDate),
  });

  const handleBookingSave = useCallback(
    (payload: BookingMutationPayload): Promise<SaveBookingResult> => saveBooking(payload),
    [saveBooking]
  );

  const handleBlockingSave = useCallback(
    (payload: Parameters<typeof saveBlocking>[0]) => saveBlocking(payload),
    [saveBlocking]
  );

  const handleBookingDrag = useCallback(
    async (bookingId: string, newTime: string, newStaffId?: string) => {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;

      const dateStr = format(new Date(selectedDate), "yyyy-MM-dd");
      const newStartsAt = `${dateStr}T${newTime}`;

      await moveBooking(booking, newStartsAt, newStaffId);
    },
    [bookings, selectedDate, moveBooking]
  );

  const handleBookingResize = useCallback(
    async (bookingId: string, newEndTime: string) => {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;

      // Ensure date is conserved
      const dateStr = format(new Date(booking.starts_at), "yyyy-MM-dd");
      const newEndsAt = `${dateStr}T${newEndTime}`;

      await resizeBooking(booking, newEndsAt);
    },
    [bookings, resizeBooking]
  );

  const handleSlotNewBooking = useCallback(
    (slot: CalendarSlot) => {
      modals.openNewBookingModal(slot);
      setSlotPopover(null);
    },
    [modals]
  );

  const handleSlotBlock = useCallback(
    (slot: CalendarSlot, type: CalendarSlot["type"] = "block") => {
      modals.openBlockingModal({ ...slot, type });
      setSlotPopover(null);
    },
    [modals]
  );

  const handleBookingClick = useCallback(
    (booking: Booking) => {
      modals.openBookingDetail(booking);
    },
    [modals]
  );

  const handleBookingContextMenu = useCallback((e: React.MouseEvent, booking: Booking) => {
    e.preventDefault();
    setBookingPopover({
      open: true,
      position: { x: e.clientX, y: e.clientY },
      booking,
    });
  }, []);

  const closeBookingPopover = () => setBookingPopover(null);
  const closeSlotPopover = () => setSlotPopover(null);

  const filteredBookings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (filters.status.length > 0 && !filters.status.includes(booking.status)) {
        return false;
      }

      if (!filters.staff.includes("all") && filters.staff.length > 0) {
        if (!booking.staff_id || !filters.staff.includes(booking.staff_id)) {
          return false;
        }
      }

      if (filters.highlighted !== null && Boolean(booking.is_highlighted) !== filters.highlighted) {
        return false;
      }

      if (filters.payment.includes("paid")) {
        const isPaid = booking.status === "paid" || booking.status === "completed";
        if (!isPaid) return false;
      }

      if (filters.payment.includes("unpaid")) {
        const requiresPayment = booking.status === "pending" || booking.status === "hold";
        if (!requiresPayment) return false;
      }

      if (!term) return true;
      const haystack = [booking.customer?.name, booking.customer?.phone, booking.service?.name]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      return haystack.some((value) => value.includes(term));
    });
  }, [bookings, filters, searchTerm]);

  const visibleStaff = useMemo(() => {
    if (filters.staff.includes("all")) return staffList;
    return staffList.filter((member) => filters.staff.includes(member.id));
  }, [filters.staff, staffList]);

  const staffUtilization = useMemo(
    () =>
      staffList.map((member) => {
        const staffBookings = filteredBookings.filter((booking) => booking.staff_id === member.id);
        return {
          staffId: member.id,
          staffName: member.name,
          utilization: Math.min(100, staffBookings.length * 10),
        };
      }),
    [filteredBookings, staffList]
  );

  const quickStats = stats
    ? {
      totalBookings: stats.total_bookings,
      totalHours: Number((stats.total_minutes / 60).toFixed(1)),
      totalAmount: stats.total_amount,
      rangeLabel,
    }
    : undefined;

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const defaultSlot: CalendarSlot = {
    staffId: visibleStaff[0]?.id || staffList[0]?.id || "",
    date: selectedDate,
    time: "10:00",
    endTime: "10:30",
  };

  if (!tenantId || serverError) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/40 bg-red-500/5 text-red-200">
        <h3 className="font-bold text-lg mb-2">Error cargando agenda</h3>
        <p>{serverError || "No se pudo cargar la agenda para este usuario (Tenant ID missing)."}</p>
        <p className="text-sm opacity-75 mt-2">Si el problema persiste, contacta a soporte.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <AgendaHeader
        selectedDate={selectedDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onDateChange={setSelectedDate}
        onNotificationsClick={() => setNotificationsOpen(true)}
        onSearchClick={() => setSearchOpen(true)}
        onFiltersClick={() => setSidebarOpen(true)}
        showFiltersButton
        quickStats={quickStats}
        searchOpen={searchOpen}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchClose={() => setSearchOpen(false)}
        searchResultCount={filteredBookings.length}
        searchTotalCount={bookings.length}
        staffUtilization={staffUtilization}
        onStaffFilterChange={(staffId) =>
          setFilters((prev) => ({
            ...prev,
            staff: staffId === "all" ? ["all"] : [staffId],
          }))
        }
      />

      <div className="flex-1 min-h-0 flex gap-4">
        <aside className="hidden xl:block w-80 flex-shrink-0">
          <AgendaSidebar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            filters={filters}
            onFiltersChange={setFilters}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </aside>

        <div className="flex-1 min-h-0 flex flex-col">
          <AgendaContent
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            bookings={filteredBookings}
            staffList={visibleStaff}
            staffBlockings={staffBlockings}
            staffSchedules={staffSchedules}
            loading={loading}
            error={error}
            tenantTimezone={tenantTimezone}
            onBookingClick={handleBookingClick}
            onNewBooking={() => handleSlotNewBooking(defaultSlot)}
            onBookingDrag={handleBookingDrag}
            onBookingResize={handleBookingResize}
            density="default"
            onPopoverShow={(position, slot) =>
              setSlotPopover({
                open: true,
                position,
                slot: slot || defaultSlot,
              })
            }
            onBookingContextMenu={handleBookingContextMenu}
            slotPopover={slotPopover}
            onSlotPopoverClose={closeSlotPopover}
            onSlotNewBooking={handleSlotNewBooking}
            onSlotBlock={(slot) => handleSlotBlock(slot, "block")}
            onSlotAbsence={(slot) => handleSlotBlock(slot, "absence")}
          />
        </div>
      </div>

      <SearchPanel
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        resultCount={filteredBookings.length}
        totalCount={bookings.length}
      />

      <NotificationsPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
      />

      {bookingPopover && (
        <BookingActionPopover
          isOpen={bookingPopover.open}
          position={bookingPopover.position}
          onClose={closeBookingPopover}
          onEdit={() => {
            modals.openEditBookingModal(bookingPopover.booking);
            closeBookingPopover();
          }}
          onCancel={() => showToast("Cancelar cita: próximamente", "info")}
          onSendMessage={() => showToast("Mensajería: próximamente", "info")}
          onStatusChange={(status) => showToast(`Estado actualizado a ${status}`, "info")}
          currentStatus={bookingPopover.booking.status}
          canCancel
        />
      )}

      {modals.showBookingDetail && modals.selectedBooking && (
        <BookingDetailPanel
          booking={modals.selectedBooking}
          isOpen={modals.showBookingDetail}
          onClose={modals.closeBookingDetail}
          onEdit={(booking) => {
            modals.closeBookingDetail();
            modals.openEditBookingModal(booking);
          }}
          onDelete={() => showToast("Eliminación gestionada por RPC", "info")}
          timezone={tenantTimezone}
        />
      )}

      {modals.showNewBookingModal && (
        <NewBookingModal
          isOpen={modals.showNewBookingModal}
          onClose={modals.closeNewBookingModal}
          onSave={handleBookingSave}
          services={services}
          staff={staffList}
          customers={customers}
          selectedDate={selectedDate}
          selectedTime={modals.selectedSlot?.time}
          selectedEndTime={modals.selectedSlot?.endTime}
          selectedStaffId={modals.selectedSlot?.staffId}
          isLoading={loading}
          editingBooking={modals.editingBooking}
          tenantId={tenantId || ""}
        />
      )}

      {modals.showBlockingModal && (
        <StaffBlockingModal
          isOpen={modals.showBlockingModal}
          onClose={modals.closeBlockingModal}
          onSave={handleBlockingSave}
          staff={staffList}
          slot={modals.selectedSlot}
          isLoading={loading}
        />
      )}

      {ToastComponent}
    </div>
  );
}
