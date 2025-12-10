"use client";

import { useState, useCallback } from "react";
import { detectConflicts, Conflict } from "@/lib/booking-conflicts";
import { Booking, StaffBlocking } from "@/types/agenda";

export interface PendingBookingInput {
  id?: string;
  starts_at: string;
  ends_at: string;
  staff_id: string;
  customer_id?: string;
  service_id?: string;
  notes?: string;
  status?: string;
}

export interface PendingBlockingInput {
  start_at: string;
  end_at: string;
  staff_id: string;
  reason?: string;
}

export type ConflictResolution = "force" | "cancel" | "change_time" | "change_staff";

interface UseAgendaConflictsProps {
  bookings: Booking[];
  staffBlockings: StaffBlocking[];
  userRole: "owner" | "admin" | "manager" | "staff";
}

export function useAgendaConflicts({ bookings, staffBlockings, userRole }: UseAgendaConflictsProps) {
  const [pendingBooking, setPendingBooking] = useState<PendingBookingInput | null>(null);
  const [pendingBlocking, setPendingBlocking] = useState<PendingBlockingInput | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  /**
   * Verifica conflictos para una nueva cita
   */
  const checkBookingConflicts = useCallback(
    (bookingPayload: PendingBookingInput): Conflict[] => {
      const filteredBookings = bookingPayload.id
        ? bookings.filter((b) => b.id !== bookingPayload.id)
        : bookings;

      return detectConflicts(
        bookingPayload.starts_at,
        bookingPayload.ends_at,
        bookingPayload.staff_id,
        filteredBookings,
        staffBlockings,
        bookingPayload.id
      );
    },
    [bookings, staffBlockings]
  );

  /**
   * Verifica conflictos para un nuevo bloqueo
   */
  const checkBlockingConflicts = useCallback(
    (blockingPayload: PendingBlockingInput): Conflict[] => {
      return detectConflicts(
        blockingPayload.start_at,
        blockingPayload.end_at,
        blockingPayload.staff_id,
        bookings,
        staffBlockings
      );
    },
    [bookings, staffBlockings]
  );

  /**
   * Maneja la resolución de conflictos
   * @param action - Acción seleccionada por el usuario
   * @param onResolve - Callback que ejecuta la acción (saveBooking/saveBlocking)
   */
  const handleResolve = useCallback(
    async (
      action: ConflictResolution,
      onResolve: (force: boolean) => Promise<void>
    ) => {
      if (action === "cancel") {
        // Cancelar: solo limpiar estados
        setShowConflictModal(false);
        setPendingBooking(null);
        setPendingBlocking(null);
        setConflicts([]);
        return;
      }

      if (action === "force") {
        // Forzar: ejecutar con force=true
        try {
          await onResolve(true);
          setShowConflictModal(false);
          setPendingBooking(null);
          setPendingBlocking(null);
          setConflicts([]);
        } catch (err) {
          // El error se maneja en el callback
          throw err;
        }
        return;
      }

      // change_time o change_staff: el usuario debe cambiar manualmente
      // Estos casos se manejan cerrando el modal y dejando que el usuario
      // modifique los valores en el formulario
      setShowConflictModal(false);
      // No limpiar pendingBooking/pendingBlocking para que el usuario pueda editar
    },
    []
  );

  /**
   * Verifica conflictos y muestra el modal si los hay
   * @param bookingPayload - Datos de la cita a verificar
   * @returns true si hay conflictos, false si no
   */
  const checkAndShowBookingConflicts = useCallback(
    (bookingPayload: PendingBookingInput): boolean => {
      const detectedConflicts = checkBookingConflicts(bookingPayload);
      if (detectedConflicts.length > 0) {
        setConflicts(detectedConflicts);
        setPendingBooking(bookingPayload);
        setShowConflictModal(true);
        return true;
      }
      return false;
    },
    [checkBookingConflicts]
  );

  /**
   * Verifica conflictos y muestra el modal si los hay
   * @param blockingPayload - Datos del bloqueo a verificar
   * @returns true si hay conflictos, false si no
   */
  const checkAndShowBlockingConflicts = useCallback(
    (blockingPayload: PendingBlockingInput): boolean => {
      const detectedConflicts = checkBlockingConflicts(blockingPayload);
      if (detectedConflicts.length > 0) {
        setConflicts(detectedConflicts);
        setPendingBlocking(blockingPayload);
        setShowConflictModal(true);
        return true;
      }
      return false;
    },
    [checkBlockingConflicts]
  );

  /**
   * Limpia todos los estados de conflictos
   */
  const clearConflicts = useCallback(() => {
    setShowConflictModal(false);
    setPendingBooking(null);
    setPendingBlocking(null);
    setConflicts([]);
  }, []);

  return {
    // Estados
    pendingBooking,
    pendingBlocking,
    conflicts,
    showConflictModal,
    // Setters (para casos especiales)
    setPendingBooking,
    setPendingBlocking,
    setConflicts,
    setShowConflictModal,
    // Funciones de verificación
    checkBookingConflicts,
    checkBlockingConflicts,
    checkAndShowBookingConflicts,
    checkAndShowBlockingConflicts,
    // Resolución
    handleResolve,
    // Utilidades
    clearConflicts,
  };
}

