"use client";

import { useState } from 'react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { SupabaseClient } from '@supabase/supabase-js';
import { Booking, BookingStatus, CalendarSlot } from '@/types/agenda';
import { useToast } from '@/components/ui/Toast';
import { useAgendaConflicts } from './useAgendaConflicts';

type BookingFormPayload = Booking & {
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
};

type BlockingFormPayload = {
  staff_id: string;
  start_at: string;
  end_at: string;
  type: "block" | "absence" | "vacation";
  reason: string;
  notes?: string | null;
};

interface UseAgendaHandlersProps {
  tenantId: string | null;
  supabase: SupabaseClient;
  bookings: Booking[];
  selectedDate: string;
  timezone: string;
  userRole: string | null;
  refreshDaySnapshots: (targetDate?: string) => Promise<void>;
}

export function useAgendaHandlers({
  tenantId,
  supabase,
  bookings,
  selectedDate,
  timezone,
  userRole,
  refreshDaySnapshots,
}: UseAgendaHandlersProps) {
  const { showToast } = useToast();
  const conflictsHook = useAgendaConflicts({
    bookings,
    staffBlockings: [],
    userRole: (userRole as "owner" | "admin" | "manager" | "staff") || "staff",
    tenantTimezone: timezone,
  });

  // Estado local para modales y selección
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [showBookingDetail, setShowBookingDetail] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  // Utilidades
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

  // Handlers
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

  const onSave = async (bookingData: BookingFormPayload) => {
    if (!tenantId) return;

    try {
      if (!bookingData.customer_id || !bookingData.service_id || !bookingData.staff_id || !bookingData.starts_at || !bookingData.ends_at) {
        throw new Error("Faltan campos requeridos para crear la reserva");
      }

      const hasConflicts = conflictsHook.checkAndShowBookingConflicts({
        id: bookingData.id,
        staff_id: bookingData.staff_id,
        starts_at: bookingData.starts_at,
        ends_at: bookingData.ends_at,
      });

      if (hasConflicts) {
        conflictsHook.setPendingBooking(bookingData as any);
        return;
      }

      await saveBooking(bookingData);
    } catch (err) {
      notifyError(err, "Error al guardar la cita");
    }
  };

  const onSaveBlocking = async (blockingData: BlockingFormPayload) => {
    if (!tenantId) return;

    try {
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
        showToast(`Estado cambiado a ${newStatus}.`, "success");
      }
    } catch (err) {
      notifyError(err, "Error al cambiar el estado de la cita");
    }
  };

  const onBookingMove = async (bookingId: string, newStaffId: string, newStartsAt: string, newEndsAt: string) => {
    if (!tenantId) return;

    try {
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

      const isProtected = booking.status === "paid" || booking.status === "completed";
      if (isProtected) {
        throw new Error("No se puede modificar la duración de una cita pagada o completada");
      }

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

  // Funciones auxiliares
  const saveBooking = async (
    bookingData: BookingFormPayload,
    forceOverlap = false,
    successMessage?: string
  ) => {
    if (!tenantId) return;

    if (!forceOverlap) {
      if (!bookingData.staff_id) {
        throw new Error("Debe seleccionar un profesional para la cita");
      }
      const detectedConflicts = conflictsHook.checkBookingConflicts({
        id: bookingData.id,
        staff_id: bookingData.staff_id,
        starts_at: bookingData.starts_at,
        ends_at: bookingData.ends_at,
      });

      if (detectedConflicts.length > 0) {
        throw new Error("Todavía hay conflictos. Por favor, resuélvelos primero.");
      }
    }

    let result;
    if (bookingData.id) {
      const { data: currentBooking, error: fetchError } = await supabase
        .from("bookings")
        .select("status, staff_id, starts_at, ends_at, internal_notes, client_message, is_highlighted, customer_id, service_id")
        .eq("id", bookingData.id)
        .eq("tenant_id", tenantId)
        .single();

      if (fetchError) {
        throw new Error(`Error al obtener la cita: ${fetchError.message}`);
      }

      const bookingPayload: Partial<BookingFormPayload> = {
        tenant_id: tenantId,
      };

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

      const isProtected = currentBooking?.status === "paid" || currentBooking?.status === "completed";
      
      if (!isProtected) {
        if (bookingData.customer_id && bookingData.customer_id !== currentBooking?.customer_id) {
          bookingPayload.customer_id = bookingData.customer_id;
        }
        if (bookingData.service_id && bookingData.service_id !== currentBooking?.service_id) {
          bookingPayload.service_id = bookingData.service_id;
        }
        if (bookingData.staff_id && bookingData.staff_id !== currentBooking?.staff_id) {
          bookingPayload.staff_id = bookingData.staff_id;
        }
        
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
        if (bookingData.customer_id && bookingData.customer_id !== currentBooking?.customer_id) {
          bookingPayload.customer_id = bookingData.customer_id;
        }
        if (bookingData.service_id && bookingData.service_id !== currentBooking?.service_id) {
          bookingPayload.service_id = bookingData.service_id;
        }
      }

      const payloadKeys = Object.keys(bookingPayload).filter(key => key !== "tenant_id");
      const hasChanges = payloadKeys.length > 0;
      
      if (hasChanges) {
        result = await supabase
          .from("bookings")
          .update(bookingPayload)
          .eq("id", bookingData.id)
          .eq("tenant_id", tenantId);
      } else {
        result = { error: null, data: null };
        setShowNewBookingModal(false);
        setEditingBooking(null);
        conflictsHook.clearConflicts();
        return;
      }
    } else {
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
      const errorMessage = result.error.message || result.error.hint || "Error al guardar la cita";
      throw new Error(errorMessage);
    }

    if (bookingData.id) {
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

      if (updatedBooking?.starts_at) {
        const newBookingDate = format(parseISO(updatedBooking.starts_at), "yyyy-MM-dd");
        const oldBookingDate = format(parseISO(selectedDate), "yyyy-MM-dd");
        
        if (newBookingDate !== oldBookingDate) {
          await refreshDaySnapshots(newBookingDate);
          await refreshDaySnapshots(selectedDate);
        } else {
          await refreshDaySnapshots(selectedDate);
        }
      } else {
        await refreshDaySnapshots(selectedDate);
      }
    } else {
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

  const saveBlocking = async (blocking: BlockingFormPayload, forceOverlap = false) => {
    if (!tenantId) return;

    if (!forceOverlap) {
      const detectedConflicts = conflictsHook.checkBookingConflicts({
        staff_id: blocking.staff_id,
        starts_at: blocking.start_at,
        ends_at: blocking.end_at,
      });

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

  return {
    // Estado
    showNewBookingModal,
    showBlockingModal,
    showBookingDetail,
    editingBooking,
    selectedBooking,
    selectedSlot,
    // Setters
    setShowNewBookingModal,
    setShowBlockingModal,
    setShowBookingDetail,
    setEditingBooking,
    setSelectedBooking,
    setSelectedSlot,
    // Handlers
    onNewBooking,
    onUnavailability,
    onAbsence,
    onSave,
    onSaveBlocking,
    onBookingEdit,
    onBookingCancel,
    onBookingSendMessage,
    onBookingStatusChange,
    onBookingMove,
    onBookingResize,
    // Hooks
    conflictsHook,
  };
}
