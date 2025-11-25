"use client";

import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { useToast } from "@/components/ui/Toast";
import { Booking, Staff, StaffBlocking, StaffSchedule, ViewMode, CalendarSlot, BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { toTenantLocalDate } from "@/lib/timezone";
import { useAgendaConflicts } from "@/hooks/useAgendaConflicts";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getBookingsNeedingStatusUpdate } from "@/lib/booking-status-transitions";
import { useAgendaData } from "@/hooks/useAgendaData";
import { AgendaContainer } from "@/components/agenda/AgendaContainer";
import { AgendaSkeleton } from "@/components/agenda/AgendaSkeleton";

// OPTIMIZACIÓN: Lazy load modales que no se usan en carga inicial
const NewBookingModal = lazy(() => import("@/components/calendar/NewBookingModal").then(m => ({ default: m.NewBookingModal })));
const CustomerQuickView = lazy(() => import("@/components/calendar/CustomerQuickView").then(m => ({ default: m.CustomerQuickView })));
const BookingDetailPanel = lazy(() => import("@/components/calendar/BookingDetailPanel").then(m => ({ default: m.BookingDetailPanel })));
const StaffBlockingModal = lazy(() => import("@/components/calendar/StaffBlockingModal").then(m => ({ default: m.StaffBlockingModal })));
const ConflictResolutionModal = lazy(() => import("@/components/calendar/ConflictResolutionModal").then(m => ({ default: m.ConflictResolutionModal })));
const NotificationsPanel = lazy(() => import("@/components/calendar/NotificationsPanel").then(m => ({ default: m.NotificationsPanel })));

type AgendaNotification = {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
};

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

  // Estados de UI locales (modales y paneles) - SIMPLIFICADO
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showFreeSlots, setShowFreeSlots] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCustomerView, setShowCustomerView] = useState(false);
  const [showBookingDetail, setShowBookingDetail] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [notifications, setNotifications] = useState<AgendaNotification[]>([
    {
      id: "1",
      type: "success",
      title: "Nueva reserva online",
      message: "Juan Pérez ha realizado una reserva para mañana a las 10:00",
      timestamp: "Hace 5 minutos",
      read: false,
    },
    {
      id: "2",
      type: "warning",
      title: "Cita cancelada",
      message: "María García ha cancelado su cita del 15 de noviembre",
      timestamp: "Hace 1 hora",
      read: false,
    },
    {
      id: "3",
      type: "error",
      title: "Error al procesar pago",
      message: "No se pudo procesar el pago de la cita #1234",
      timestamp: "Hace 2 horas",
      read: true,
    },
  ]);
  
  const { showToast, ToastComponent } = useToast();

  // Hook para datos de la agenda (reemplaza estados locales)
  const agendaData = useAgendaData({
    tenantId,
    supabase,
    selectedDate,
    viewMode,
    timezone: tenantTimezone,
    userRole,
  });

  // Extraer datos del hook para usar en el componente
  const {
    loading,
    error,
    staffList,
    bookings,
    staffBlockings,
    staffSchedules,
    services,
    customers,
    searchTerm,
    setSearchTerm: setAgendaSearchTerm,
    filters,
    setFilters,
    activeFiltersCount,
    filteredBookings,
    visibleStaff,
    quickStats,
    staffUtilization,
    refreshDaySnapshots,
  } = agendaData;

  // Hook para manejo de conflictos
  const conflictsHook = useAgendaConflicts({
    bookings,
    staffBlockings,
    userRole: (userRole as "owner" | "admin" | "manager" | "staff") || "staff",
    tenantTimezone,
  });

  // Cargar info del tenant (necesario para inicializar el hook useAgendaData)
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const impersonateOrgId = searchParams?.get("impersonate");
        const { tenant, role } = await getCurrentTenant(impersonateOrgId);

        if (!tenant) {
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
      } catch (err) {
        console.error("Error al cargar tenant:", err);
      }
    };

    loadTenant();
  }, [supabase, searchParams]);

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
        // Refrescar datos para obtener los cambios
        await refreshDaySnapshots();

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

  // Alias for NewBookingModal compatibility
  const onBookingSave = onSave;

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

  // Wrapper functions to adapt existing handlers to AgendaContainer interface
  const handleBookingDrag = async (bookingId: string, newTime: string, newStaffId?: string) => {
    // For drag operations, we need to calculate the end time based on original booking duration
    const originalBooking = bookings.find(b => b.id === bookingId);
    if (!originalBooking) return;
    
    const originalDuration = new Date(originalBooking.ends_at).getTime() - new Date(originalBooking.starts_at).getTime();
    const newEndsAt = new Date(new Date(newTime).getTime() + originalDuration).toISOString();
    
    await onBookingMove(bookingId, newStaffId || originalBooking.staff_id || '', newTime, newEndsAt);
  };

  const handleBookingResize = async (bookingId: string, newEndTime: string) => {
    // For resize operations, we keep the original start time and only change the end time
    const originalBooking = bookings.find(b => b.id === bookingId);
    if (!originalBooking) return;
    
    await onBookingResize(bookingId, originalBooking.starts_at, newEndTime);
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

  // OPTIMIZACIÓN: Mostrar skeleton inmediatamente si no hay tenant
  if (!tenantId) {
    return (
      <>
        <AgendaSkeleton />
        {ToastComponent}
      </>
    );
  }

  // Mostrar skeleton mientras carga por primera vez
  if (loading && !staffList.length) {
    return (
      <>
        <AgendaSkeleton />
        {ToastComponent}
      </>
    );
  }

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

  // Los datos filtrados y stats ahora vienen del hook useAgendaData

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


  // Handler para filtrar por staff desde chips de utilización
  const handleStaffFilterChange = (staffId: string) => {
    setFilters((prev: { payment: string[]; status: string[]; staff: string[]; services: string[]; highlighted: boolean | null }) => {
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
        notificationsOpen;

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
  ]);

  useEffect(() => {
    if (notificationsOpen) {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    }
  }, [notificationsOpen]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  return (
    <>
      <div className="h-full flex flex-col">
        <AgendaContainer
          // Data from useAgendaData hook
          loading={loading}
          error={error}
          staffList={staffList}
          bookings={bookings}
          searchTerm={searchTerm}
          setSearchTerm={setAgendaSearchTerm}
          filters={filters}
          setFilters={setFilters}
          activeFiltersCount={activeFiltersCount}
          filteredBookings={filteredBookings}
          visibleStaff={visibleStaff}
          quickStats={quickStats}
          staffUtilization={staffUtilization}
          refreshDaySnapshots={refreshDaySnapshots}
          services={services}
          
          // Core state from page.tsx
          tenantId={tenantId}
          tenantTimezone={tenantTimezone}
          selectedDate={selectedDate}
          selectedStaffId={filters.staff.includes("all") ? null : filters.staff[0] || null}
          viewMode={viewMode}
          
          // Callbacks from page.tsx
          onDateChange={setSelectedDate}
          onViewModeChange={setViewMode}
          onStaffChange={(staffId) => {
            setFilters(prev => ({
              ...prev,
              staff: staffId ? [staffId] : ["all"],
              services: prev.services || [],
            }));
          }}
          onBookingClick={(booking) => {
            const fullBooking = bookings.find((b) => b.id === booking.id);
            if (fullBooking) {
              setSelectedBooking(fullBooking);
              setShowBookingDetail(true);
            }
          }}
          onNewBooking={() => setShowNewBookingModal(true)}
          onBookingDrag={handleBookingDrag}
          onBookingResize={handleBookingResize}
          onNotificationsToggle={() => setNotificationsOpen((prev) => !prev)}

          // UI state - SIMPLIFICADO (sin searchOpen)
          selectedBooking={selectedBooking}
          newBookingOpen={showNewBookingModal}
          unreadNotifications={unreadNotifications}

          // Options
          density="default"
          enableDragDrop={true}
          showConflicts={true}
        />
      </div>

      {/* Modals and panels - Lazy loaded con Suspense */}
      {showNewBookingModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />}>
          <NewBookingModal
            isOpen={showNewBookingModal}
            onClose={() => {
              setShowNewBookingModal(false);
              setEditingBooking(null);
            }}
            onSave={onBookingSave}
            services={services}
            staff={staffList}
            customers={customers}
            selectedDate={selectedDate}
            selectedTime={selectedSlot?.time}
            selectedEndTime={selectedSlot?.endTime}
            selectedStaffId={selectedSlot?.staffId || (filters.staff.includes("all") ? undefined : filters.staff[0] || undefined)}
            isLoading={loading}
            editingBooking={editingBooking}
            tenantId={tenantId || undefined}
          />
        </Suspense>
      )}

      {conflictsHook.showConflictModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />}>
          <ConflictResolutionModal
            isOpen={conflictsHook.showConflictModal}
            onClose={() => conflictsHook.setShowConflictModal(false)}
            conflicts={conflictsHook.conflicts}
            newBookingStart={conflictsHook.pendingBooking?.starts_at || ""}
            newBookingEnd={conflictsHook.pendingBooking?.ends_at || ""}
            newBookingStaffId={conflictsHook.pendingBooking?.staff_id || ""}
            newBookingStaffName={staffList.find(s => s.id === conflictsHook.pendingBooking?.staff_id)?.name}
            timezone={tenantTimezone}
            onResolve={(action: "change_time" | "change_staff" | "force" | "cancel") => {
              conflictsHook.handleResolve(action, async (force: boolean) => {
                if (conflictsHook.pendingBooking) {
                  const bookingPayload: BookingFormPayload = {
                    id: conflictsHook.pendingBooking.id || "",
                    staff_id: conflictsHook.pendingBooking.staff_id || "",
                    starts_at: conflictsHook.pendingBooking.starts_at,
                    ends_at: conflictsHook.pendingBooking.ends_at,
                    customer_id: conflictsHook.pendingBooking.customer_id || null,
                    service_id: conflictsHook.pendingBooking.service_id || null,
                    status: (conflictsHook.pendingBooking.status as BookingStatus) || "pending",
                    internal_notes: conflictsHook.pendingBooking.internal_notes || null,
                    client_message: conflictsHook.pendingBooking.client_message || null,
                    is_highlighted: conflictsHook.pendingBooking.is_highlighted || false,
                  };
                  await saveBooking(bookingPayload, force);
                } else if (conflictsHook.pendingBlocking) {
                  const blockingPayload: BlockingFormPayload = {
                    staff_id: conflictsHook.pendingBlocking.staff_id,
                    start_at: conflictsHook.pendingBlocking.start_at,
                    end_at: conflictsHook.pendingBlocking.end_at,
                    type: conflictsHook.pendingBlocking.type || "block",
                    reason: conflictsHook.pendingBlocking.reason || "",
                    notes: conflictsHook.pendingBlocking.notes || null,
                  };
                  await saveBlocking(blockingPayload, force);
                }
              });
            }}
          />
        </Suspense>
      )}

      {showBookingDetail && selectedBooking && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />}>
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
        </Suspense>
      )}

      {showCustomerView && selectedBooking && selectedBooking.customer && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />}>
          <CustomerQuickView
            customer={{
              id: selectedBooking.customer_id!,
              name: selectedBooking.customer.name,
              email: selectedBooking.customer.email,
              phone: selectedBooking.customer.phone,
            }}
            onClose={() => setShowCustomerView(false)}
          />
        </Suspense>
      )}

      {notificationsOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />}>
          <NotificationsPanel
            isOpen={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            notifications={notifications}
          />
        </Suspense>
      )}
      {ToastComponent}
    </>
  );
}
