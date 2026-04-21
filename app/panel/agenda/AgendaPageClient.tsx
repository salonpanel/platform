"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { AgendaTopBar } from "@/components/agenda/AgendaTopBar";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { AgendaContent } from "@/components/agenda/AgendaContent";
import { NotificationsPanel } from "@/components/calendar/NotificationsPanel";
import { BookingActionPopover } from "@/components/calendar/BookingActionPopover";
import { BookingSlidePanel } from "@/components/calendar/BookingSlidePanel";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import StaffBlockingModal from "@/components/calendar/StaffBlockingModal";
import { NotificationProvider } from "@/components/agenda/NotificationSystem";
import { useAgendaModals } from "@/hooks/useAgendaModals";
import { useAgendaData } from "@/hooks/useAgendaData";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useAgendaHandlers,
  type BookingMutationPayload,
  type SaveBookingResult,
} from "@/hooks/useAgendaHandlers";
import { useToast } from "@/components/ui/Toast";
import type { AgendaDataset } from "@/lib/agenda-data";
import type { Booking, CalendarSlot, ViewMode } from "@/types/agenda";
import { BOOKING_STATUS_CONFIG } from "@/types/agenda";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = impersonateOrgId ?? initialData?.tenant.id ?? null;
  const tenantTimezone = initialData?.tenant.timezone ?? "Europe/Madrid";
  const { showToast, ToastComponent } = useToast();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const [filters, setFilters] = useState<AgendaFiltersState>(DEFAULT_FILTERS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [slotPopover, setSlotPopover] = useState<{
    open: boolean;
    position: { x: number; y: number };
    slot: CalendarSlot;
  } | null>(null);
  const [bookingPopover, setBookingPopover] = useState<{
    open: boolean;
    position: { x: number; y: number };
    booking: Booking;
  } | null>(null);
  const [notifications, setNotifications] = useState(() =>
    initialData
      ? []
      : [{ id: "1", type: "info" as const, title: "Agenda lista", message: "Las notificaciones llegarán aquí", timestamp: "Hace 1 min", read: false }]
  );

  useEffect(() => {
    if (notificationsOpen) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, [notificationsOpen]);

  // Cmd+K / Ctrl+K global shortcut to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
  } = useAgendaData({ tenantId, selectedDate, viewMode, initialData });

  const { saveBooking, saveBlocking, moveBooking, resizeBooking } = useAgendaHandlers({
    tenantId,
    onAfterMutation: () => refreshDaySnapshots(selectedDate),
  });

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDaySnapshots(selectedDate);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDate, refreshDaySnapshots]);

  // Staff filter derived values
  const selectedStaffId = useMemo(
    () => (filters.staff.includes("all") ? null : filters.staff[0] || null),
    [filters.staff]
  );

  const handleStaffChange = useCallback((staffId: string | null) => {
    setFilters((prev) => ({ ...prev, staff: staffId ? [staffId] : ["all"] }));
  }, []);

  // Real API calls for status/cancel
  const handleStatusChange = useCallback(
    async (bookingId: string, newStatus: string) => {
      try {
        const res = await fetch("/api/panel/booking-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, status: newStatus }),
        });
        if (res.ok) {
          const config = BOOKING_STATUS_CONFIG[newStatus as keyof typeof BOOKING_STATUS_CONFIG];
          showToast(config ? `Estado: ${config.label}` : "Estado actualizado", "success");
          refreshDaySnapshots(selectedDate);
        } else {
          showToast("Error al cambiar estado", "error");
        }
      } catch {
        showToast("Error al cambiar estado", "error");
      }
    },
    [refreshDaySnapshots, selectedDate, showToast]
  );

  const handleCancelBooking = useCallback(
    async (bookingId: string) => {
      try {
        const res = await fetch("/api/panel/booking-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, status: "cancelled" }),
        });
        if (res.ok) {
          showToast("Cita cancelada", "success");
          refreshDaySnapshots(selectedDate);
        } else {
          showToast("Error al cancelar la cita", "error");
        }
      } catch {
        showToast("Error al cancelar la cita", "error");
      }
    },
    [refreshDaySnapshots, selectedDate, showToast]
  );

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
    (booking: Booking) => { modals.openBookingDetail(booking); },
    [modals]
  );

  const handleBookingContextMenu = useCallback((e: React.MouseEvent, booking: Booking) => {
    e.preventDefault();
    setBookingPopover({ open: true, position: { x: e.clientX, y: e.clientY }, booking });
  }, []);

  const closeBookingPopover = () => setBookingPopover(null);
  const closeSlotPopover = () => setSlotPopover(null);

  const filteredBookings = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (filters.status.length > 0 && !filters.status.includes(booking.status)) return false;
      if (!filters.staff.includes("all") && filters.staff.length > 0) {
        if (!booking.staff_id || !filters.staff.includes(booking.staff_id)) return false;
      }
      if (filters.highlighted !== null && Boolean(booking.is_highlighted) !== filters.highlighted) return false;
      if (filters.payment.includes("paid") && !(booking.status === "paid" || booking.status === "completed")) return false;
      if (filters.payment.includes("unpaid") && !(booking.status === "pending" || booking.status === "hold")) return false;
      if (!term) return true;
      const haystack = [booking.customer?.name, booking.customer?.phone, booking.service?.name]
        .filter(Boolean).map((v) => v!.toLowerCase());
      return haystack.some((v) => v.includes(term));
    });
  }, [bookings, filters, debouncedSearchTerm]);

  const visibleStaff = useMemo(() => {
    if (filters.staff.includes("all")) return staffList;
    return staffList.filter((member) => filters.staff.includes(member.id));
  }, [filters.staff, staffList]);

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

  // Barra inferior móvil: ?nuevaCita=1 abre el modal de nueva cita (desde cualquier página del panel)
  const nuevaCitaHandledRef = useRef(false);
  useEffect(() => {
    if (searchParams.get("nuevaCita") !== "1") {
      nuevaCitaHandledRef.current = false;
      return;
    }
    if (!tenantId || serverError) return;
    const staffId = visibleStaff[0]?.id || staffList[0]?.id || "";
    if (!staffId) return;
    if (nuevaCitaHandledRef.current) return;
    nuevaCitaHandledRef.current = true;

    const slot: CalendarSlot = {
      staffId,
      date: selectedDate,
      time: "10:00",
      endTime: "10:30",
    };

    const next = new URLSearchParams(searchParams.toString());
    next.delete("nuevaCita");
    const q = next.toString();
    router.replace(q ? `/panel/agenda?${q}` : "/panel/agenda", { scroll: false });

    modals.openNewBookingModal(slot);
  }, [
    searchParams,
    tenantId,
    serverError,
    selectedDate,
    staffList,
    visibleStaff,
    router,
    modals,
  ]);

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
    <NotificationProvider position="top-right" maxNotifications={3}>
      <div className="h-full flex flex-col">
        {/* Compact single-row header */}
        <AgendaTopBar
          selectedDate={selectedDate}
          viewMode={viewMode}
          onDateChange={setSelectedDate}
          onViewModeChange={setViewMode}
          onSearchClick={() => setSearchOpen((v) => !v)}
          onNotificationsClick={() => setNotificationsOpen(true)}
          unreadNotifications={unreadNotifications}
          filters={filters}
          onFiltersChange={setFilters}
          quickStats={quickStats}
        />

        {/* Staff chips + inline search */}
        <AgendaFilters
          staffList={staffList}
          selectedStaffId={selectedStaffId}
          onStaffChange={handleStaffChange}
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          onSearchToggle={() => setSearchOpen((v) => !v)}
          onSearchChange={setSearchTerm}
          onSearchClose={() => { setSearchOpen(false); setSearchTerm(""); }}
          activeFilters={[]}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
        />

        {/* Calendar content */}
        <div className="flex-1 min-h-0 mt-1.5">
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
              setSlotPopover({ open: true, position, slot: slot || defaultSlot })
            }
            onBookingContextMenu={handleBookingContextMenu}
            slotPopover={slotPopover}
            onSlotPopoverClose={closeSlotPopover}
            onSlotNewBooking={handleSlotNewBooking}
            onSlotBlock={(slot) => handleSlotBlock(slot, "block")}
            onSlotAbsence={(slot) => handleSlotBlock(slot, "absence")}
          />
        </div>

        {/* Notifications panel */}
        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
        />

        {/* Booking context menu (right-click) */}
        {bookingPopover && (
          <BookingActionPopover
            isOpen={bookingPopover.open}
            position={bookingPopover.position}
            onClose={closeBookingPopover}
            onEdit={() => {
              modals.openEditBookingModal(bookingPopover.booking);
              closeBookingPopover();
            }}
            onCancel={() => {
              handleCancelBooking(bookingPopover.booking.id);
              closeBookingPopover();
            }}
            onSendMessage={() => {
              showToast("Mensajería: próximamente", "info");
              closeBookingPopover();
            }}
            onStatusChange={(status) => {
              handleStatusChange(bookingPopover.booking.id, status);
              closeBookingPopover();
            }}
            currentStatus={bookingPopover.booking.status}
            canCancel
          />
        )}

        {/* Booking detail slide panel — status change handled internally by the panel, callback only for UI refresh */}
        <BookingSlidePanel
          booking={modals.selectedBooking}
          isOpen={modals.showBookingDetail}
          onClose={modals.closeBookingDetail}
          onEdit={(booking) => {
            modals.closeBookingDetail();
            modals.openEditBookingModal(booking);
          }}
          onCancel={handleCancelBooking}
          onStatusChange={(bookingId, newStatus) => {
            // Panel already called the API — just show feedback and refresh
            const config = BOOKING_STATUS_CONFIG[newStatus as keyof typeof BOOKING_STATUS_CONFIG];
            const label = config ? config.label : newStatus;
            showToast(newStatus === "cancelled" ? "Cita cancelada" : `Estado: ${label}`, newStatus === "cancelled" ? "error" : "success");
            refreshDaySnapshots(selectedDate);
          }}
          timezone={tenantTimezone}
        />

        {/* New / edit booking modal */}
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

        {/* Staff blocking modal */}
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
    </NotificationProvider>
  );
}
