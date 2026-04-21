/**
 * Lógica de transiciones automáticas de estados de booking
 * 
 * Reglas de negocio:
 * Nuevo modelo:
 * - booking_state: pending | confirmed | in_progress | completed | cancelled | no_show
 * - payment_status: unpaid | deposit | paid
 *
 * Reglas principales:
 * - Cuando el pago está en "paid" y ends_at ya pasó, sugerimos booking_state="completed"
 * - Cambios a cancelled/no_show solo manual (UI)
 */

import { Booking, BookingState, BookingStatus, getBookingPresentation } from "@/types/agenda";
import { parseISO, isPast } from "date-fns";

/**
 * Determina si un booking debería cambiar de estado automáticamente
 * @param booking El booking a evaluar
 * @param currentTime Tiempo actual (opcional, por defecto usa new Date())
 * @returns El nuevo estado si debe cambiar, o null si no debe cambiar
 */
export function getAutoTransitionStatus(
  booking: Booking,
  currentTime: Date = new Date()
): BookingStatus | null {
  const presentation = getBookingPresentation(booking);

  // Solo evaluar transiciones automáticas para ciertos estados
  if (
    presentation.bookingState === "cancelled" ||
    presentation.bookingState === "no_show"
  ) {
    // Estados finales o gestionados externamente (portal), no cambian automáticamente
    return null;
  }

  // Regla: si está pagada y ya terminó, sugerir completed (legacy status)
  if (presentation.paymentStatus === "paid" && presentation.bookingState !== "completed") {
    const endsAt = parseISO(booking.ends_at);
    if (isPast(endsAt)) {
      return "completed";
    }
  }

  // Regla 2: "hold" -> "pending" cuando expira (si hay expires_at en el futuro)
  // Nota: Esto requeriría un campo expires_at en Booking, por ahora no lo implementamos
  // pero dejamos la estructura para futuras mejoras

  // Regla 3: "pending" -> "paid" solo mediante webhook de pago (no automático)

  return null;
}

/**
 * Filtra bookings que necesitan actualización de estado
 * @param bookings Lista de bookings a evaluar
 * @param currentTime Tiempo actual (opcional)
 * @returns Array de objetos { bookingId, newStatus } para bookings que deben cambiar
 */
export function getBookingsNeedingStatusUpdate(
  bookings: Booking[],
  currentTime: Date = new Date()
): Array<{ bookingId: string; newStatus: BookingStatus }> {
  const updates: Array<{ bookingId: string; newStatus: BookingStatus }> = [];

  for (const booking of bookings) {
    const newStatus = getAutoTransitionStatus(booking, currentTime);
    if (newStatus && newStatus !== booking.status) {
      updates.push({
        bookingId: booking.id,
        newStatus,
      });
    }
  }

  return updates;
}

/**
 * Valida si una transición de estado es permitida
 * @param currentStatus Estado actual
 * @param newStatus Nuevo estado deseado
 * @param isManual Si es un cambio manual (true) o automático (false)
 * @returns true si la transición es válida, false si no
 */
export function isValidStatusTransition(
  currentStatus: BookingStatus,
  newStatus: BookingStatus,
  isManual: boolean = true
): boolean {
  // No se puede cambiar a sí mismo
  if (currentStatus === newStatus) {
    return false;
  }

  // Estados finales no pueden cambiar automáticamente
  if (currentStatus === "cancelled" || currentStatus === "no_show") {
    return isManual; // Solo manualmente se puede cambiar desde estos estados
  }

  // Transiciones permitidas
  const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
    hold: ["pending", "confirmed", "paid", "cancelled"],   // hold → pending/confirmed/paid/cancelled
    pending: ["confirmed", "paid", "cancelled", "no_show"], // pending → confirmado, pagado, cancelado o no_show
    confirmed: ["paid", "completed", "cancelled", "no_show"], // confirmed (portal) → pagado, completado, cancelado o no_show
    paid: ["completed", "cancelled"], // paid → completed (auto) o cancelled (manual)
    completed: ["cancelled"], // completed → solo cancelled
    cancelled: [], // final (reactivación manual a través de cheque isManual)
    no_show: [], // final
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Obtiene el siguiente estado lógico para un booking
 * Útil para sugerir el siguiente estado en la UI
 * @param currentStatus Estado actual
 * @returns El siguiente estado sugerido o null
 */
export function getSuggestedNextStatus(currentStatus: BookingStatus): BookingStatus | null {
  const suggestions: Record<BookingStatus, BookingStatus | null> = {
    hold: "pending",
    pending: "confirmed",
    confirmed: "paid",
    paid: "completed",
    completed: null, // No hay siguiente estado
    cancelled: null, // No hay siguiente estado
    no_show: null, // No hay siguiente estado
  };

  return suggestions[currentStatus] ?? null;
}



