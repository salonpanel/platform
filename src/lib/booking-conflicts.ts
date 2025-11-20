/**
 * Utilidades para detectar conflictos de horarios en citas y bloqueos
 */

export interface Conflict {
  type: "booking" | "blocking";
  id: string;
  staff_id: string;
  staff_name?: string;
  start_at: string;
  end_at: string;
  customer_name?: string;
  service_name?: string;
  blocking_type?: "block" | "absence" | "vacation";
  blocking_reason?: string;
}

/**
 * Verifica si dos rangos de tiempo se solapan
 */
function doRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  // Dos rangos se solapan si:
  // start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Detecta conflictos de horario para una nueva cita o bloqueo
 * 
 * @param newStart - Fecha/hora de inicio de la nueva cita/bloqueo
 * @param newEnd - Fecha/hora de fin de la nueva cita/bloqueo
 * @param staffId - ID del empleado
 * @param existingBookings - Array de citas existentes para ese empleado
 * @param existingBlockings - Array de bloqueos existentes para ese empleado
 * @param excludeBookingId - ID de cita a excluir (útil para edición)
 * @param excludeBlockingId - ID de bloqueo a excluir (útil para edición)
 * @returns Array de conflictos encontrados
 */
export function detectConflicts(
  newStart: string | Date,
  newEnd: string | Date,
  staffId: string,
  existingBookings: Array<{
    id: string;
    staff_id: string | null;
    starts_at: string;
    ends_at: string;
    customer?: { name: string } | null;
    service?: { name: string } | null;
    staff?: { name: string } | null;
  }> = [],
  existingBlockings: Array<{
    id: string;
    staff_id: string;
    start_at: string;
    end_at: string;
    type?: "block" | "absence" | "vacation";
    reason?: string | null;
  }> = [],
  excludeBookingId?: string,
  excludeBlockingId?: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  
  const newStartDate = typeof newStart === "string" ? new Date(newStart) : newStart;
  const newEndDate = typeof newEnd === "string" ? new Date(newEnd) : newEnd;

  // Verificar conflictos con citas existentes
  for (const booking of existingBookings) {
    // Excluir la propia cita si se está editando
    if (excludeBookingId && booking.id === excludeBookingId) {
      continue;
    }

    // Solo verificar citas del mismo empleado
    if (booking.staff_id !== staffId) {
      continue;
    }

    const bookingStart = new Date(booking.starts_at);
    const bookingEnd = new Date(booking.ends_at);

    if (doRangesOverlap(newStartDate, newEndDate, bookingStart, bookingEnd)) {
      conflicts.push({
        type: "booking",
        id: booking.id,
        staff_id: booking.staff_id || "",
        staff_name: booking.staff?.name,
        start_at: booking.starts_at,
        end_at: booking.ends_at,
        customer_name: booking.customer?.name || undefined,
        service_name: booking.service?.name || undefined,
      });
    }
  }

  // Verificar conflictos con bloqueos existentes
  for (const blocking of existingBlockings) {
    // Excluir el propio bloqueo si se está editando
    if (excludeBlockingId && blocking.id === excludeBlockingId) {
      continue;
    }

    // Solo verificar bloqueos del mismo empleado
    if (blocking.staff_id !== staffId) {
      continue;
    }

    const blockingStart = new Date(blocking.start_at);
    const blockingEnd = new Date(blocking.end_at);

    if (doRangesOverlap(newStartDate, newEndDate, blockingStart, blockingEnd)) {
      conflicts.push({
        type: "blocking",
        id: blocking.id,
        staff_id: blocking.staff_id,
        start_at: blocking.start_at,
        end_at: blocking.end_at,
        blocking_type: blocking.type,
        blocking_reason: blocking.reason || undefined,
      });
    }
  }

  return conflicts;
}








