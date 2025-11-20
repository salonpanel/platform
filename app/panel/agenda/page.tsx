"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameWeek, isSameMonth } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Spinner } from "@/components/ui/Spinner";
import { AgendaEmptyState } from "@/components/calendar/AgendaEmptyState";
import { AgendaHeader } from "@/components/calendar/AgendaHeader";
import { AgendaSidebar } from "@/components/calendar/AgendaSidebar";
import { FloatingActionButton } from "@/components/calendar/FloatingActionButton";
import { AgendaCalendarView } from "@/components/panel/AgendaCalendarView";
import { NotificationsPanel } from "@/components/calendar/NotificationsPanel";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import { CustomerQuickView } from "@/components/calendar/CustomerQuickView";
import { BookingDetailPanel } from "@/components/calendar/BookingDetailPanel";
import { StaffBlockingModal } from "@/components/calendar/StaffBlockingModal";
import { ConflictResolutionModal } from "@/components/calendar/ConflictResolutionModal";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ListView } from "@/components/calendar/ListView";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { Booking, Staff, StaffBlocking, StaffSchedule, ViewMode, BookingStatus, BOOKING_STATUS_CONFIG, CalendarSlot } from "@/types/agenda";
import { toTenantLocalDate } from "@/lib/timezone";
import { useAgendaConflicts } from "@/hooks/useAgendaConflicts";
import { SearchPanel } from "@/components/calendar/SearchPanel";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { calculateStaffUtilization } from "@/lib/agenda-insights";
import { getBookingsNeedingStatusUpdate } from "@/lib/booking-status-transitions";

export default function AgendaPage() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [userRole, setUserRole] = useState<string | null>(null);
  // Cargar preferencias desde localStorage
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_selectedDate");
      return saved || format(new Date(), "yyyy-MM-dd");
    }
    return format(new Date(), "yyyy-MM-dd");
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_viewMode") as ViewMode;
      return saved || "day";
    }
    return "day";
  });
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffBlockings, setStaffBlockings] = useState<StaffBlocking[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showFreeSlots, setShowFreeSlots] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
const [showCustomerView, setShowCustomerView] = useState(false);
const [showBookingDetail, setShowBookingDetail] = useState(false);
const [showBlockingModal, setShowBlockingModal] = useState(false);

const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [services, setServices] = useState<Array<{ id: string; name: string; duration_min: number; price_cents: number; buffer_min: number }>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null; notes?: string | null }>>([]);
  
  const { showToast, ToastComponent } = useToast();

  // Hook para manejo de conflictos
  const conflictsHook = useAgendaConflicts({
    bookings,
    staffBlockings,
    userRole: (userRole as "owner" | "admin" | "manager" | "staff") || "staff",
    tenantTimezone,
  });

  // Filtros (cargar desde localStorage)
  const [filters, setFilters] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_filters");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Si hay error, usar valores por defecto
        }
      }
    }
    return {
      payment: [] as string[],
      status: [] as string[],
      staff: [] as string[],
      highlighted: null as boolean | null,
    };
  });

  // Cargar tenant y staff
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const impersonateOrgId = searchParams?.get("impersonate");
        const { tenant, role } = await getCurrentTenant(impersonateOrgId);

        if (!tenant) {
          setError("No tienes acceso a ninguna barbería");
          setLoading(false);
          return;
        }

        setTenantId(tenant.id);
        setTenantTimezone(tenant.timezone);
        setUserRole(role || null);

        // Cargar rol del usuario en el tenant para gating de permisos
        const { data: authUser } = await supabase.auth.getUser();
        const currentUserId = authUser.user?.id || null;
        if (currentUserId) {
          const { data: membership } = await supabase
            .from("memberships")
            .select("role")
            .eq("tenant_id", tenant.id)
            .eq("user_id", currentUserId)
            .maybeSingle();
          if (membership?.role) setUserRole(membership.role);
        }

        const { data: staffData } = await supabase
          .from("staff")
          .select("id, name, active")
          .eq("tenant_id", tenant.id)
          .eq("active", true)
          .order("name");

        if (staffData) {
          setStaffList(staffData as Staff[]);
        }

        // Cargar servicios
        const { data: servicesData } = await supabase
          .from("services")
          .select("id, name, duration_min, price_cents, buffer_min")
          .eq("tenant_id", tenant.id)
          .eq("active", true)
          .order("name");

        if (servicesData) {
          setServices(servicesData.map(s => ({ ...s, buffer_min: s.buffer_min ?? 0 })));
        }

        // Cargar clientes
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, name, email, phone, notes")
          .eq("tenant_id", tenant.id)
          .order("name")
          .limit(100);

        if (customersData) {
          setCustomers(customersData);
        }
      } catch (err) {
        console.error("Error al cargar tenant:", err);
        setError("Error al cargar los datos");
        setLoading(false);
      }
    };

    loadTenant();
  }, [supabase, searchParams]);

  // Cargar bookings y bloqueos
  useEffect(() => {
    if (!tenantId) return;

    const loadBookings = async () => {
      try {
        const start = startOfDay(parseISO(selectedDate));
        const end = endOfDay(parseISO(selectedDate));

        const [bookingsResult, blockingsResult, schedulesResult] = await Promise.all([
          supabase
            .from("bookings")
            .select(`
              *,
              customer:customers(id, name, email, phone),
              service:services(id, name, duration_min, price_cents),
              staff:staff(id, name)
            `)
            .eq("tenant_id", tenantId)
            .gte("starts_at", start.toISOString())
            .lte("starts_at", end.toISOString())
            .order("starts_at"),
          supabase
            .from("staff_blockings")
            .select("*")
            .eq("tenant_id", tenantId)
            .gte("start_at", start.toISOString())
            .lte("end_at", end.toISOString())
            .order("start_at"),
          supabase
            .from("staff_schedules")
            .select("staff_id, start_time, end_time")
            .eq("tenant_id", tenantId)
            .eq("is_active", true),
        ]);

        if (bookingsResult.data) {
          setBookings(bookingsResult.data as Booking[]);
        }
        if (blockingsResult.data) {
          setStaffBlockings(blockingsResult.data);
        }
        if (schedulesResult.data) {
          setStaffSchedules(schedulesResult.data);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar bookings:", err);
        setError("Error al cargar las reservas");
        setLoading(false);
      }
    };

    loadBookings();
  }, [tenantId, selectedDate, supabase]);

  // Transiciones automáticas de estado (paid -> completed cuando pasa la hora)
  useEffect(() => {
    if (!tenantId || bookings.length === 0) return;

    const checkAndUpdateStatuses = async () => {
      const updates = getBookingsNeedingStatusUpdate(bookings);
      
      if (updates.length === 0) return;

      // Actualizar cada booking que necesita cambio de estado
      const updatePromises = updates.map(async ({ bookingId, newStatus }) => {
        const { error } = await supabase
          .from("bookings")
          .update({ status: newStatus })
          .eq("id", bookingId)
          .eq("tenant_id", tenantId);

        if (error) {
          console.error(`Error al actualizar estado de booking ${bookingId}:`, error);
          return null;
        }
        return { bookingId, newStatus };
      });

      const results = await Promise.all(updatePromises);
      const successful = results.filter((r): r is { bookingId: string; newStatus: BookingStatus } => r !== null);

      if (successful.length > 0) {
        // Actualizar el estado local de los bookings actualizados
        setBookings((prev) =>
          prev.map((booking) => {
            const update = successful.find((u) => u.bookingId === booking.id);
            return update ? { ...booking, status: update.newStatus } : booking;
          })
        );

        // Mostrar toast solo si hay actualizaciones visibles
        if (successful.length === 1) {
          const statusLabel = BOOKING_STATUS_CONFIG[successful[0].newStatus]?.label || successful[0].newStatus;
          showToast(`Cita actualizada a "${statusLabel}"`, "success");
        } else if (successful.length > 1) {
          showToast(`${successful.length} citas actualizadas automáticamente`, "success");
        }
      }
    };

    // Verificar inmediatamente al cargar
    checkAndUpdateStatuses();

    // Verificar cada minuto para bookings que pasen de paid a completed
    const interval = setInterval(checkAndUpdateStatuses, 60000); // 60 segundos

    return () => clearInterval(interval);
  }, [bookings, tenantId, supabase, showToast]);

  // Detectar conflictos
  // Función auxiliar para detectar conflictos (mantenida para compatibilidad con código existente)
  const detectConflictsForBooking = (
    startsAt: string,
    endsAt: string,
    staffId: string,
    excludeBookingId?: string
  ) => {
    return conflictsHook.checkBookingConflicts({
      id: excludeBookingId,
      staff_id: staffId,
      starts_at: startsAt,
      ends_at: endsAt,
    });
  };

  const refreshDaySnapshots = async (targetDate?: string) => {
    if (!tenantId) return;
    // Si se proporciona una fecha objetivo, usarla; sino, usar la fecha seleccionada
    const dateToRefresh = targetDate || selectedDate;
    const start = startOfDay(parseISO(dateToRefresh));
    const end = endOfDay(parseISO(dateToRefresh));

    const [bookingsResult, blockingsResult] = await Promise.all([
      supabase
        .from("bookings")
        .select(`
          *,
          customer:customers(id, name, email, phone),
          service:services(id, name, duration_min, price_cents),
          staff:staff(id, name)
        `)
        .eq("tenant_id", tenantId)
        .gte("starts_at", start.toISOString())
        .lte("starts_at", end.toISOString())
        .order("starts_at"),
      supabase
        .from("staff_blockings")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("start_at", start.toISOString())
        .lte("end_at", end.toISOString())
        .order("start_at"),
    ]);

    if (bookingsResult.data) {
      setBookings(bookingsResult.data as Booking[]);
    }
    if (blockingsResult.data) {
      setStaffBlockings(blockingsResult.data);
    }
  };

  const notifyError = (err: unknown, fallback: string) => {
    console.error(fallback, err);
    const code = typeof err === "object" && err !== null && "code" in err ? (err as { code?: string }).code : undefined;
    const hint = typeof err === "object" && err !== null && "hint" in err ? (err as { hint?: string }).hint : undefined;
    const message = err instanceof Error ? err.message : undefined;
    if (code === "23P01") {
      showToast("El horario seleccionado ya está ocupado por otra cita confirmada.", "error");
      return;
    }
    showToast(message || hint || fallback, "error");
  };

  const syncAppointmentSlot = async (
    bookingId: string,
    payload: { staff_id?: string; starts_at?: string; ends_at?: string }
  ) => {
    if (!tenantId) return;
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking?.appointment_id) return;

    const updatePayload: Record<string, string> = {};
    if (payload.staff_id) updatePayload.staff_id = payload.staff_id;
    if (payload.starts_at) updatePayload.starts_at = payload.starts_at;
    if (payload.ends_at) updatePayload.ends_at = payload.ends_at;

    if (Object.keys(updatePayload).length === 0) return;

    const { error } = await supabase
      .from("appointments")
      .update(updatePayload)
      .eq("id", targetBooking.appointment_id)
      .eq("tenant_id", tenantId);

    if (error) throw error;
  };

  // Callbacks
  const onNewBooking = (slot: CalendarSlot) => {
    setSelectedSlot(slot);
    setShowNewBookingModal(true);
    setEditingBooking(null);
  };

  const onUnavailability = (slot: CalendarSlot) => {
    setSelectedSlot(slot);
    setShowBlockingModal(true);
  };

  const onAbsence = (slot: CalendarSlot) => {
    setSelectedSlot({ ...slot, type: "absence" });
    setShowBlockingModal(true);
  };

type BookingFormPayload = Booking & {
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
};

const onSave = async (bookingData: BookingFormPayload) => {
    if (!tenantId) return;

    try {
      // Validación de campos requeridos
      if (!bookingData.customer_id || !bookingData.service_id || !bookingData.staff_id || !bookingData.starts_at || !bookingData.ends_at) {
        throw new Error("Faltan campos requeridos para crear la reserva");
      }

      // Verificar conflictos usando el hook
      const hasConflicts = conflictsHook.checkAndShowBookingConflicts({
        id: bookingData.id,
        staff_id: bookingData.staff_id,
        starts_at: bookingData.starts_at,
        ends_at: bookingData.ends_at,
      });

      if (hasConflicts) {
        // Guardar el booking completo en pendingBooking para poder guardarlo después
        conflictsHook.setPendingBooking(bookingData as any);
        return;
      }

      await saveBooking(bookingData);
    } catch (err) {
      notifyError(err, "Error al guardar la cita");
    }
  };

type BlockingFormPayload = {
  staff_id: string;
  start_at: string;
  end_at: string;
  type: "block" | "absence" | "vacation";
  reason: string;
  notes?: string | null;
};

const onSaveBlocking = async (blockingData: BlockingFormPayload) => {
    if (!tenantId) return;

    try {
      // Verificar conflictos usando el hook
      const hasConflicts = conflictsHook.checkAndShowBlockingConflicts(blockingData);

      if (hasConflicts) {
        return;
      }

      await saveBlocking(blockingData);
    } catch (err) {
      notifyError(err, "Error al guardar el bloqueo");
    }
  };

  const onBookingEdit = (booking: Booking) => {
    setEditingBooking(booking);
    setShowNewBookingModal(true);
  };

  const onBookingCancel = async (bookingId: string) => {
    if (!tenantId) return;
    if (!confirm("¿Estás seguro de que quieres cancelar esta cita?")) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .eq("tenant_id", tenantId);

      if (error) {
        notifyError(error, "Error al cancelar la cita");
        return;
      }

      await refreshDaySnapshots();
      showToast("Cita cancelada correctamente.", "success");
    } catch (err) {
      notifyError(err, "Error al cancelar la cita");
    }
  };

  const onBookingSendMessage = (booking: Booking) => {
    // TODO: Implementar envío de mensaje
    console.log("Enviar mensaje a:", booking.customer?.email);
    showToast(`Pronto podrás enviar mensajes a ${booking.customer?.name || "este cliente"}.`, "info");
  };

  const onBookingStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    if (!tenantId) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId)
        .eq("tenant_id", tenantId);

      if (error) {
        notifyError(error, "Error al cambiar el estado de la cita");
        return;
      }

      await refreshDaySnapshots();
      if (newStatus === "cancelled") {
        showToast("Cita cancelada correctamente.", "success");
      } else {
        showToast(`Estado cambiado a ${BOOKING_STATUS_CONFIG[newStatus].label}.`, "success");
      }
    } catch (err) {
      notifyError(err, "Error al cambiar el estado de la cita");
    }
  };

  const onBookingMove = async (bookingId: string, newStaffId: string, newStartsAt: string, newEndsAt: string) => {
    if (!tenantId) return;

    try {
      // Validar datos
      const startsAtDate = new Date(newStartsAt);
      const endsAtDate = new Date(newEndsAt);
      if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime())) {
        throw new Error("Las fechas proporcionadas no son válidas");
      }
      if (endsAtDate <= startsAtDate) {
        throw new Error("La fecha de fin debe ser posterior a la fecha de inicio");
      }

      const bookingToUpdate = bookings.find((b) => b.id === bookingId);
      if (!bookingToUpdate) {
        throw new Error("No se encontró la cita seleccionada");
      }

      if (bookingToUpdate.status === "paid" || bookingToUpdate.status === "completed") {
        showToast("Las citas pagadas o completadas no se pueden mover. Cancela y vuelve a crearla.", "error");
        return;
      }

      const targetStaffId = newStaffId || bookingToUpdate.staff_id;
      
      if (!targetStaffId) {
        showToast("Debe seleccionar un profesional para la cita", "error");
        return;
      }

      const hasConflicts = conflictsHook.checkAndShowBookingConflicts({
        id: bookingId,
        staff_id: targetStaffId,
        starts_at: newStartsAt,
        ends_at: newEndsAt,
      });

      if (hasConflicts) {
        return;
      }

      // Asegurar que las fechas estén en formato ISO string
      const startsAtISO = new Date(newStartsAt).toISOString();
      const endsAtISO = new Date(newEndsAt).toISOString();

      const updatedBooking: BookingFormPayload = {
        ...bookingToUpdate,
        staff_id: targetStaffId,
        starts_at: startsAtISO,
        ends_at: endsAtISO,
      };

      await saveBooking(updatedBooking, false, "Cita reprogramada correctamente.");
    } catch (err) {
      notifyError(err, "Error al mover la cita");
    }
  };

  const onBookingResize = async (bookingId: string, newStartsAt: string, newEndsAt: string) => {
    if (!tenantId) return;

    try {
      // Validar que las nuevas fechas sean válidas
      const startsAtDate = new Date(newStartsAt);
      const endsAtDate = new Date(newEndsAt);

      if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime())) {
        throw new Error("Las fechas proporcionadas no son válidas");
      }

      if (endsAtDate <= startsAtDate) {
        throw new Error("La fecha de fin debe ser posterior a la fecha de inicio");
      }

      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking || !booking.staff_id) {
        throw new Error("No se pudo encontrar la cita o el staff asignado");
      }

      // Verificar si el booking está protegido (paid/completed)
      const isProtected = booking.status === "paid" || booking.status === "completed";
      if (isProtected) {
        throw new Error("No se puede modificar la duración de una cita pagada o completada");
      }

      // Verificar conflictos usando el hook
      const hasConflicts = conflictsHook.checkAndShowBookingConflicts({
        id: bookingId,
        staff_id: booking.staff_id,
        starts_at: newStartsAt,
        ends_at: newEndsAt,
      });

      if (hasConflicts) {
        return;
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          starts_at: newStartsAt,
          ends_at: newEndsAt,
        })
        .eq("id", bookingId)
        .eq("tenant_id", tenantId);

      if (error) {
        notifyError(error, "Error al cambiar la duración de la cita");
        return;
      }

      await syncAppointmentSlot(bookingId, {
        starts_at: newStartsAt,
        ends_at: newEndsAt,
      });
      await refreshDaySnapshots();
      showToast("Cita actualizada correctamente.", "success");
    } catch (err) {
      notifyError(err, "Error al redimensionar la cita");
    }
  };

  // Función auxiliar para guardar un booking
  const saveBooking = async (
    bookingData: BookingFormPayload,
    forceOverlap = false,
    successMessage?: string
  ) => {
    if (!tenantId) return;

    // Si no se fuerza el solape, verificar conflictos nuevamente
    if (!forceOverlap) {
      if (!bookingData.staff_id) {
        throw new Error("Debe seleccionar un profesional para la cita");
      }
      const detectedConflicts = detectConflictsForBooking(
        bookingData.starts_at,
        bookingData.ends_at,
        bookingData.staff_id,
        bookingData.id
      );

      if (detectedConflicts.length > 0) {
        throw new Error("Todavía hay conflictos. Por favor, resuélvelos primero.");
      }
    }

    let result;
    if (bookingData.id) {
      // Update: obtener el booking actual para comparar y respetar restricciones
      const { data: currentBooking, error: fetchError } = await supabase
        .from("bookings")
        .select("status, staff_id, starts_at, ends_at, internal_notes, client_message, is_highlighted, customer_id, service_id")
        .eq("id", bookingData.id)
        .eq("tenant_id", tenantId)
        .single();

      if (fetchError) {
        throw new Error(`Error al obtener la cita: ${fetchError.message}`);
      }

      // Construir payload solo con campos que pueden cambiar
      const bookingPayload: Partial<BookingFormPayload> = {
        tenant_id: tenantId,
      };

      // Siempre actualizar campos no críticos si han cambiado
      const newStatus = bookingData.status || "pending";
      if (newStatus !== (currentBooking?.status || "pending")) {
        bookingPayload.status = newStatus;
      }

      const newInternalNotes = bookingData.internal_notes ?? null;
      if (newInternalNotes !== (currentBooking?.internal_notes ?? null)) {
        bookingPayload.internal_notes = newInternalNotes;
      }

      const newClientMessage = bookingData.client_message ?? null;
      if (newClientMessage !== (currentBooking?.client_message ?? null)) {
        bookingPayload.client_message = newClientMessage;
      }

      const newIsHighlighted = bookingData.is_highlighted ?? false;
      if (newIsHighlighted !== (currentBooking?.is_highlighted ?? false)) {
        bookingPayload.is_highlighted = newIsHighlighted;
      }

      // Si el booking actual NO está en estado protegido (paid/completed), permitir cambios en campos críticos
      const isProtected = currentBooking?.status === "paid" || currentBooking?.status === "completed";
      
      if (!isProtected) {
        // Actualizar todos los campos si realmente han cambiado
        if (bookingData.customer_id && bookingData.customer_id !== currentBooking?.customer_id) {
          bookingPayload.customer_id = bookingData.customer_id;
        }
        if (bookingData.service_id && bookingData.service_id !== currentBooking?.service_id) {
          bookingPayload.service_id = bookingData.service_id;
        }
        if (bookingData.staff_id && bookingData.staff_id !== currentBooking?.staff_id) {
          bookingPayload.staff_id = bookingData.staff_id;
        }
        
        // Comparar fechas normalizadas para detectar cambios (usar getTime() para comparación precisa)
        if (bookingData.starts_at) {
          const currentStartsAt = currentBooking?.starts_at ? new Date(currentBooking.starts_at).getTime() : null;
          const newStartsAt = new Date(bookingData.starts_at).getTime();
          if (newStartsAt !== currentStartsAt) {
            bookingPayload.starts_at = bookingData.starts_at;
          }
        }
        
        if (bookingData.ends_at) {
          const currentEndsAt = currentBooking?.ends_at ? new Date(currentBooking.ends_at).getTime() : null;
          const newEndsAt = new Date(bookingData.ends_at).getTime();
          if (newEndsAt !== currentEndsAt) {
            bookingPayload.ends_at = bookingData.ends_at;
          }
        }
      } else {
        // Si está protegido, solo actualizar campos no críticos
        // Los campos críticos (staff_id, starts_at, ends_at) se mantienen iguales
        if (bookingData.customer_id && bookingData.customer_id !== currentBooking?.customer_id) {
          bookingPayload.customer_id = bookingData.customer_id;
        }
        if (bookingData.service_id && bookingData.service_id !== currentBooking?.service_id) {
          bookingPayload.service_id = bookingData.service_id;
        }
      }

      // Solo actualizar si hay cambios (excluyendo tenant_id que siempre está)
      const payloadKeys = Object.keys(bookingPayload).filter(key => key !== "tenant_id");
      const hasChanges = payloadKeys.length > 0;
      
      if (hasChanges) {
        result = await supabase
          .from("bookings")
          .update(bookingPayload)
          .eq("id", bookingData.id)
          .eq("tenant_id", tenantId);
      } else {
        // Si no hay cambios, crear un resultado exitoso simulado pero no actualizar
        result = { error: null, data: null };
        // Cerrar modal sin mostrar mensaje de éxito
        setShowNewBookingModal(false);
        setEditingBooking(null);
        conflictsHook.clearConflicts();
        return;
      }
    } else {
      // Insert: crear nuevo booking con todos los campos
      const bookingPayload: Partial<BookingFormPayload> = {
        tenant_id: tenantId,
        customer_id: bookingData.customer_id,
        service_id: bookingData.service_id,
        staff_id: bookingData.staff_id,
        starts_at: bookingData.starts_at,
        ends_at: bookingData.ends_at,
        status: bookingData.status || "pending",
        internal_notes: bookingData.internal_notes || null,
        client_message: bookingData.client_message || null,
        is_highlighted: bookingData.is_highlighted || false,
      };
      result = await supabase.from("bookings").insert(bookingPayload);
    }

    if (result.error) {
      // Mejorar el mensaje de error
      const errorMessage = result.error.message || result.error.hint || "Error al guardar la cita";
      throw new Error(errorMessage);
    }

    if (bookingData.id) {
      // Solo sincronizar appointment_slot si los campos críticos han cambiado
      // Obtener el booking actualizado para verificar qué cambió
      const { data: updatedBooking } = await supabase
        .from("bookings")
        .select("staff_id, starts_at, ends_at, appointment_id")
        .eq("id", bookingData.id)
        .eq("tenant_id", tenantId)
        .single();

      if (updatedBooking?.appointment_id) {
        await syncAppointmentSlot(bookingData.id, {
          staff_id: updatedBooking.staff_id,
          starts_at: updatedBooking.starts_at,
          ends_at: updatedBooking.ends_at,
        });
      }

      // Si la fecha cambió, actualizar también el día nuevo
      if (updatedBooking?.starts_at) {
        const newBookingDate = format(parseISO(updatedBooking.starts_at), "yyyy-MM-dd");
        const oldBookingDate = format(parseISO(selectedDate), "yyyy-MM-dd");
        
        // Si la cita se movió a otro día, actualizar ambos días
        if (newBookingDate !== oldBookingDate) {
          // Actualizar el día nuevo (donde está ahora la cita)
          await refreshDaySnapshots(newBookingDate);
          // Actualizar el día actual (para que desaparezca si se movió)
          await refreshDaySnapshots(selectedDate);
        } else {
          // Si está en el mismo día, solo actualizar el día actual
          await refreshDaySnapshots(selectedDate);
        }
      } else {
        // Si no hay fecha actualizada, actualizar el día actual
        await refreshDaySnapshots(selectedDate);
      }
    } else {
      // Para nuevas citas, actualizar el día donde se creó
      if (bookingData.starts_at) {
        const newBookingDate = format(parseISO(bookingData.starts_at), "yyyy-MM-dd");
        await refreshDaySnapshots(newBookingDate);
      } else {
        await refreshDaySnapshots(selectedDate);
      }
    }

    const defaultMessage = bookingData.id ? "Cita actualizada correctamente" : "Cita creada correctamente";
    showToast(successMessage || defaultMessage, "success");

    setShowNewBookingModal(false);
    setEditingBooking(null);
    conflictsHook.clearConflicts();
  };

  // Función auxiliar para guardar un bloqueo
const saveBlocking = async (blocking: BlockingFormPayload, forceOverlap = false) => {
    if (!tenantId) return;

    // Si no se fuerza el solape, verificar conflictos nuevamente (solo contra citas)
    if (!forceOverlap) {
      const detectedConflicts = detectConflictsForBooking(
        blocking.start_at,
        blocking.end_at,
        blocking.staff_id
      );

      if (detectedConflicts.length > 0) {
        throw new Error("Todavía hay conflictos. Por favor, resuélvelos primero.");
      }
    }

    const { error: insertError } = await supabase
      .from("staff_blockings")
      .insert({
        tenant_id: tenantId,
        staff_id: blocking.staff_id,
        start_at: blocking.start_at,
        end_at: blocking.end_at,
        type: blocking.type,
        reason: blocking.reason,
        notes: blocking.notes || null,
      });

    if (insertError) throw insertError;

    await refreshDaySnapshots();
    showToast("Bloqueo registrado correctamente.", "success");

    setShowBlockingModal(false);
    setSelectedSlot(null);
    conflictsHook.clearConflicts();
  };

  if (error && !tenantId) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen">
          <div className="p-8 rounded-[var(--radius-lg)] bg-[rgba(239,68,68,0.1)] border border-red-500/30">
            <p className="text-red-400 font-satoshi">{error}</p>
          </div>
        </div>
        {ToastComponent}
      </>
    );
  }

  // Calcular número de filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.payment.length > 0) count += filters.payment.length;
    if (filters.status.length > 0) count += filters.status.length;
    if (filters.staff.length > 0 && !filters.staff.includes("all")) count += filters.staff.length;
    if (filters.highlighted !== null) count += 1;
    return count;
  }, [filters]);

  // Filtrar staff visible según filtros
  const visibleStaff = useMemo(() => {
    if (filters.staff.length === 0 || filters.staff.includes("all")) {
      return staffList;
    }
    return staffList.filter((staff) => filters.staff.includes(staff.id));
  }, [staffList, filters.staff]);

  // Debounce del término de búsqueda (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filtrar bookings por búsqueda (usando debouncedSearchTerm para mejor performance)
  const filteredBookings = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return bookings;
    
    const term = debouncedSearchTerm.toLowerCase().trim();
    return bookings.filter((booking) => {
      const customerName = booking.customer?.name?.toLowerCase() || "";
      const customerPhone = booking.customer?.phone?.toLowerCase() || "";
      const customerEmail = booking.customer?.email?.toLowerCase() || "";
      const serviceName = booking.service?.name?.toLowerCase() || "";
      const internalNotes = booking.internal_notes?.toLowerCase() || "";
      const clientMessage = booking.client_message?.toLowerCase() || "";
      
      return (
        customerName.includes(term) ||
        customerPhone.includes(term) ||
        customerEmail.includes(term) ||
        serviceName.includes(term) ||
        internalNotes.includes(term) ||
        clientMessage.includes(term)
      );
    });
  }, [bookings, debouncedSearchTerm]);

  // Helper para obtener bookings en el rango actual según viewMode
  const getBookingsInCurrentRange = useMemo(() => {
    return (bookings: Booking[], selectedDate: string, viewMode: ViewMode, timezone: string): Booking[] => {
      const selectedDateObj = parseISO(selectedDate);

      const filterByRange = (rangeStart: Date, rangeEnd: Date) => {
        return bookings.filter((booking) => {
          const bookingDate = toTenantLocalDate(new Date(booking.starts_at), timezone);
          return bookingDate >= rangeStart && bookingDate <= rangeEnd;
        });
      };

      switch (viewMode) {
        case "day": {
          const dayStart = startOfDay(selectedDateObj);
          const dayEnd = endOfDay(selectedDateObj);
          return filterByRange(dayStart, dayEnd);
        }
        case "week": {
          const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });
          return filterByRange(weekStart, weekEnd);
        }
        case "month": {
          const monthStart = startOfMonth(selectedDateObj);
          const monthEnd = endOfMonth(selectedDateObj);
          return filterByRange(monthStart, monthEnd);
        }
        case "list": {
          const dayStart = startOfDay(selectedDateObj);
          const dayEnd = endOfDay(selectedDateObj);
          return filterByRange(dayStart, dayEnd);
        }
        default:
          return bookings;
      }
    };
  }, []);

  // Quick stats range-aware
  const quickStats = useMemo(() => {
    const rangeBookings = getBookingsInCurrentRange(bookings, selectedDate, viewMode, tenantTimezone);
    const statsBookings = searchTerm.trim() 
      ? rangeBookings.filter((b) => {
          const term = searchTerm.toLowerCase();
          return (
            b.customer?.name?.toLowerCase().includes(term) ||
            b.customer?.phone?.toLowerCase().includes(term) ||
            b.customer?.email?.toLowerCase().includes(term) ||
            b.service?.name?.toLowerCase().includes(term) ||
            b.internal_notes?.toLowerCase().includes(term) ||
            b.client_message?.toLowerCase().includes(term)
          );
        })
      : rangeBookings;
    
    const totalBookings = statsBookings.length;
    const totalMinutes = statsBookings.reduce((acc, b) => {
      const start = new Date(b.starts_at);
      const end = new Date(b.ends_at);
      return acc + Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }, 0);
    const totalAmount = statsBookings.reduce((acc, b) => {
      return acc + (b.service?.price_cents || 0);
    }, 0);

    // Calcular label del rango
    const selectedDateObj = parseISO(selectedDate);
    const tenantToday = startOfDay(toTenantLocalDate(new Date(), tenantTimezone));
    let rangeLabel = "";
    switch (viewMode) {
      case "day": {
        const selectedDay = startOfDay(selectedDateObj);
        const isToday = selectedDay.getTime() === tenantToday.getTime();
        rangeLabel = isToday ? "Hoy" : format(selectedDateObj, "d 'de' MMMM");
        break;
      }
      case "week": {
        const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });
        const isCurrentWeek = isSameWeek(selectedDateObj, tenantToday, { weekStartsOn: 1 });
        const prefix = isCurrentWeek ? "Esta semana" : "Semana";
        rangeLabel = `${prefix} (${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM")})`;
        break;
      }
      case "month": {
        const isCurrentMonth = isSameMonth(selectedDateObj, tenantToday);
        const monthLabel = format(selectedDateObj, "MMMM yyyy");
        rangeLabel = isCurrentMonth ? `Este mes (${monthLabel})` : monthLabel;
        break;
      }
      case "list":
        rangeLabel = format(selectedDateObj, "d 'de' MMMM");
        break;
    }

    return {
      totalBookings,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalAmount,
      rangeLabel,
    };
  }, [bookings, selectedDate, viewMode, tenantTimezone, searchTerm, getBookingsInCurrentRange]);

  // Calcular utilización por staff (solo para owners/admins/managers)
  const staffUtilization = useMemo(() => {
    if (!(userRole === "owner" || userRole === "admin" || userRole === "manager")) {
      return [];
    }
    
    return calculateStaffUtilization({
      bookings,
      staffList,
      staffSchedules,
      selectedDate,
      viewMode,
      timezone: tenantTimezone,
    });
  }, [bookings, staffList, staffSchedules, selectedDate, viewMode, tenantTimezone, userRole]);

  // Handler para filtrar por staff desde chips de utilización
  const handleStaffFilterChange = (staffId: string) => {
    setFilters((prev: { payment: string[]; status: string[]; staff: string[]; highlighted: boolean | null }) => {
      // Si el staff ya está filtrado, quitarlo; si no, añadirlo
      const currentStaff = prev.staff.includes("all") ? [] : prev.staff;
      if (currentStaff.includes(staffId)) {
        // Quitar el filtro
        const newStaff = currentStaff.filter((id) => id !== staffId);
        return {
          ...prev,
          staff: newStaff.length === 0 ? ["all"] : newStaff,
        };
      } else {
        // Añadir el filtro
        return {
          ...prev,
          staff: [staffId],
        };
      }
    });
  };

  // Guardar preferencias cuando cambian
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agenda_selectedDate", selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agenda_viewMode", viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agenda_filters", JSON.stringify(filters));
    }
  }, [filters]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si está escribiendo en un input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const shortcutsBlocked =
        showNewBookingModal ||
        showBlockingModal ||
        showBookingDetail ||
        conflictsHook.showConflictModal ||
        notificationsOpen ||
        searchOpen;

      if (shortcutsBlocked) {
        return;
      }

      // N → Nueva cita
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowNewBookingModal(true);
        return;
      }

      // T → Hoy
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setSelectedDate(format(new Date(), "yyyy-MM-dd"));
        return;
      }

      // ← / → → Navegar fechas
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const date = parseISO(selectedDate);
        let newDate: Date;
        switch (viewMode) {
          case "day":
            newDate = subDays(date, 1);
            break;
          case "week":
            newDate = subWeeks(date, 1);
            break;
          case "month":
            newDate = subMonths(date, 1);
            break;
          default:
            newDate = subDays(date, 1);
        }
        setSelectedDate(format(newDate, "yyyy-MM-dd"));
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const date = parseISO(selectedDate);
        let newDate: Date;
        switch (viewMode) {
          case "day":
            newDate = addDays(date, 1);
            break;
          case "week":
            newDate = addWeeks(date, 1);
            break;
          case "month":
            newDate = addMonths(date, 1);
            break;
          default:
            newDate = addDays(date, 1);
        }
        setSelectedDate(format(newDate, "yyyy-MM-dd"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedDate,
    viewMode,
    showNewBookingModal,
    showBlockingModal,
    showBookingDetail,
    conflictsHook.showConflictModal,
    notificationsOpen,
    searchOpen,
  ]);

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#0E0F11]"
    >
      {/* Premium Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-3">
        <AgendaHeader
          selectedDate={selectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onDateChange={setSelectedDate}
          timeRange={useMemo(() => {
            if (staffSchedules.length === 0) return "9:00 – 19:00";
            // Mapear staffSchedules a minutos
            const allMinutes = staffSchedules.flatMap(s => {
              const [startH, startM] = s.start_time.split(":").map(Number);
              const [endH, endM] = s.end_time.split(":").map(Number);
              return [
                startH * 60 + startM, // inicio en minutos
                endH * 60 + endM,    // fin en minutos
              ];
            });
            // Obtener min/max
            const earliest = Math.min(...allMinutes.filter((_, i) => i % 2 === 0));
            const latest = Math.max(...allMinutes.filter((_, i) => i % 2 === 1));
            // Construir string "HH:mm – HH:mm"
            const startH = Math.floor(earliest / 60);
            const startM = earliest % 60;
            const endH = Math.floor(latest / 60);
            const endM = latest % 60;
            return `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")} – ${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
          }, [staffSchedules])}
          onNotificationsClick={() => setNotificationsOpen(true)}
          onSearchClick={() => setSearchOpen(!searchOpen)}
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchClose={() => {
            setSearchOpen(false);
            setSearchTerm("");
          }}
          quickStats={quickStats}
          searchResultCount={filteredBookings.length}
          searchTotalCount={bookings.length}
          staffUtilization={staffUtilization}
          onStaffFilterChange={handleStaffFilterChange}
          onFiltersClick={() => setSidebarOpen(true)}
          onCalendarClick={() => {
            console.log("Abrir calendar picker");
          }}
          showFiltersButton={true}
        />
      </div>

      {/* Chip de filtros activos - Premium */}
      {activeFiltersCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="flex-shrink-0 px-4 lg:px-6 pb-2"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] bg-[rgba(58,109,255,0.12)] border border-[rgba(58,109,255,0.25)] backdrop-blur-md shadow-[0px_4px_20px_rgba(58,109,255,0.15)]">
            <div className="h-1.5 w-1.5 rounded-full bg-[#3A6DFF] animate-pulse" />
            <span className="text-sm text-white font-semibold font-['Plus_Jakarta_Sans']">
              {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro activo' : 'filtros activos'}
            </span>
            <button
              onClick={() => {
                setFilters({
                  payment: [],
                  status: [],
                  staff: [],
                  highlighted: null,
                });
              }}
              className="ml-1 px-2.5 py-1 text-xs font-semibold text-[#4FE3C1] hover:text-white hover:bg-[rgba(79,227,193,0.15)] rounded-[8px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
            >
              Limpiar
            </button>
          </div>
        </motion.div>
      )}

      {/* Sidebar - Mobile (Drawer) */}
      {sidebarOpen && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute left-0 top-0 bottom-0 w-[88vw] sm:w-[360px] max-w-[90%] bg-[#15171A] border-r border-white/10 backdrop-blur-md shadow-[0px_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="h-full overflow-y-auto scrollbar-hide p-5">
                <AgendaSidebar
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  filters={filters}
                  onFiltersChange={setFilters}
                  staffList={staffList}
                  onClose={() => setSidebarOpen(false)}
                  showFreeSlots={showFreeSlots}
                  onShowFreeSlotsChange={setShowFreeSlots}
                />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Layout principal - Dashboard con 3 áreas claras */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-hidden px-4 lg:px-6 pb-4">
        {/* Contenido principal - Card premium */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#15171A] rounded-2xl border border-white/5 shadow-[0px_8px_32px_rgba(0,0,0,0.35)]">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Spinner size="lg" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "day" ? (
            bookings.length === 0 && staffBlockings.length === 0 ? (
              <AgendaEmptyState
                selectedDate={selectedDate}
                onCreateBooking={() => setShowNewBookingModal(true)}
                bookingLink={
                  tenantId
                    ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reservar/${tenantId}`
                    : undefined
                }
              />
            ) : (
              <motion.div
                key={selectedDate}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-full overflow-auto scrollbar-hide"
              >
                <AgendaCalendarView
                  selectedDate={selectedDate}
                  selectedStaffIds={visibleStaff.map((s) => s.id)}
                  bookings={filteredBookings}
                  staffBlockings={staffBlockings}
                  staffList={visibleStaff}
                  staffSchedules={staffSchedules}
                  timezone={tenantTimezone}
                  showFreeSlots={showFreeSlots}
                  onSlotClick={(slot) => setSelectedSlot(slot)}
                  onNewBooking={onNewBooking}
                  onUnavailability={onUnavailability}
                  onAbsence={onAbsence}
                  onBookingClick={(booking) => {
                    const fullBooking = bookings.find((b) => b.id === booking.id);
                    if (fullBooking) {
                      setSelectedBooking(fullBooking);
                      setShowBookingDetail(true);
                    }
                  }}
                  onBookingEdit={(booking) => {
                    const fullBooking = bookings.find((b) => b.id === booking.id);
                    if (fullBooking) {
                      onBookingEdit(fullBooking);
                    }
                  }}
                  onBookingCancel={(bookingId) => {
                    const canCancel = userRole === "owner" || userRole === "admin";
                    if (!canCancel) return;
                    onBookingCancel(bookingId);
                  }}
                  onBookingSendMessage={(booking) => {
                    const fullBooking = bookings.find((b) => b.id === booking.id);
                    if (fullBooking) {
                      onBookingSendMessage(fullBooking);
                    }
                  }}
                  onBookingStatusChange={onBookingStatusChange}
                  onBookingMove={onBookingMove}
                  onBookingResize={onBookingResize}
                  canCancel={userRole === "owner" || userRole === "admin"}
                />
              </motion.div>
            )
          ) : viewMode === "week" ? (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full overflow-auto scrollbar-hide"
            >
              <WeekView
                selectedDate={selectedDate}
                staffList={visibleStaff}
                bookings={filteredBookings}
                timezone={tenantTimezone}
                onBookingClick={(booking) => {
                  const fullBooking = bookings.find((b) => b.id === booking.id);
                  if (fullBooking) {
                    setSelectedBooking(fullBooking);
                    setShowBookingDetail(true);
                  }
                }}
              />
            </motion.div>
          ) : viewMode === "month" ? (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full overflow-auto scrollbar-hide"
            >
              <MonthView
                selectedDate={selectedDate}
                bookings={filteredBookings}
                timezone={tenantTimezone}
                onDateSelect={setSelectedDate}
                onBookingClick={(booking) => {
                  const fullBooking = bookings.find((b) => b.id === booking.id);
                  if (fullBooking) {
                    setSelectedBooking(fullBooking);
                    setShowBookingDetail(true);
                  }
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full overflow-auto scrollbar-hide"
            >
              <ListView
                selectedDate={selectedDate}
                viewMode={viewMode}
                bookings={filteredBookings}
                timezone={tenantTimezone}
                searchTerm={debouncedSearchTerm}
                onBookingClick={(booking) => {
                  const fullBooking = bookings.find((b) => b.id === booking.id);
                  if (fullBooking) {
                    setSelectedBooking(fullBooking);
                    setShowBookingDetail(true);
                  }
                }}
              />
            </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Sidebar derecha - Desktop only - Glassmorphism premium */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="hidden lg:flex w-[280px] flex-shrink-0"
        >
          <div className="w-full h-full bg-[#15171A] rounded-2xl p-5 border border-white/5 backdrop-blur-md shadow-[0px_8px_32px_rgba(0,0,0,0.35)] overflow-y-auto scrollbar-hide">
            <AgendaSidebar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              filters={filters}
              onFiltersChange={setFilters}
              staffList={staffList}
            />
          </div>
        </motion.aside>
      </div>

      {/* Modales y paneles */}
      <FloatingActionButton onClick={() => {
        setSelectedSlot(null);
        setShowNewBookingModal(true);
        setEditingBooking(null);
      }} />

      {showNewBookingModal && (
        <NewBookingModal
          isOpen={showNewBookingModal}
          onClose={() => {
            setShowNewBookingModal(false);
            setEditingBooking(null);
            setSelectedSlot(null);
          }}
          onSave={onSave}
          services={services}
          customers={customers}
          staff={staffList}
          selectedTime={selectedSlot?.time}
          selectedEndTime={selectedSlot?.endTime}
          selectedStaffId={selectedSlot?.staffId}
          selectedDate={selectedSlot?.date || selectedDate}
          editingBooking={editingBooking}
          tenantId={tenantId || undefined}
        />
      )}

      {showBlockingModal && selectedSlot && (
        <StaffBlockingModal
          isOpen={showBlockingModal}
          onClose={() => {
            setShowBlockingModal(false);
            setSelectedSlot(null);
          }}
          onSave={onSaveBlocking}
          staff={staffList}
          slot={selectedSlot}
        />
      )}

      {conflictsHook.showConflictModal && (
        <ConflictResolutionModal
          isOpen={conflictsHook.showConflictModal}
          onClose={conflictsHook.clearConflicts}
          conflicts={conflictsHook.conflicts}
          newBookingStart={conflictsHook.pendingBooking?.starts_at || conflictsHook.pendingBlocking?.start_at || ""}
          newBookingEnd={conflictsHook.pendingBooking?.ends_at || conflictsHook.pendingBlocking?.end_at || ""}
          newBookingStaffId={conflictsHook.pendingBooking?.staff_id || conflictsHook.pendingBlocking?.staff_id || ""}
          newBookingStaffName={staffList.find(s => s.id === (conflictsHook.pendingBooking?.staff_id || conflictsHook.pendingBlocking?.staff_id))?.name}
          timezone={tenantTimezone}
          userRole={(userRole as "owner" | "admin" | "manager" | "staff") || "staff"}
          onResolve={async (resolution) => {
            try {
              if (conflictsHook.pendingBooking) {
                await conflictsHook.handleResolve(resolution, async (force) => {
                  await saveBooking(conflictsHook.pendingBooking as any, force);
                });
              } else if (conflictsHook.pendingBlocking) {
                await conflictsHook.handleResolve(resolution, async (force) => {
                  const blocking = conflictsHook.pendingBlocking!;
                  await saveBlocking({
                    ...blocking,
                    type: blocking.type || "block",
                    reason: blocking.reason || "",
                  }, force);
                });
              }
            } catch (err) {
              notifyError(err, "Error al resolver el conflicto");
            }
          }}
        />
      )}

      {showBookingDetail && selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          isOpen={showBookingDetail}
          onClose={() => {
            setShowBookingDetail(false);
            setSelectedBooking(null);
          }}
          onEdit={() => onBookingEdit(selectedBooking)}
          onDelete={onBookingCancel}
          timezone={tenantTimezone}
        />
      )}

      {showCustomerView && selectedBooking && selectedBooking.customer && (
        <CustomerQuickView
          customer={{
            id: selectedBooking.customer_id!,
            name: selectedBooking.customer.name,
            email: selectedBooking.customer.email,
            phone: selectedBooking.customer.phone,
          }}
          onClose={() => setShowCustomerView(false)}
        />
      )}

      {notificationsOpen && (
        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      )}
    </motion.div>
    {ToastComponent}
    </>
  );
}
