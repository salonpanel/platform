/**
 * Tipos centralizados para la Agenda
 */

/**
 * Legacy single-status field (still persisted for backwards compatibility).
 * New UI should prefer `booking_state` + `payment_status`.
 */
export type BookingStatus = "hold" | "pending" | "confirmed" | "paid" | "completed" | "cancelled" | "no_show";

export type BookingState = "pending" | "confirmed" | "arrived" | "in_progress" | "completed" | "cancelled" | "no_show";
export type PaymentStatus = "unpaid" | "deposit" | "paid";

export const BOOKING_STATE_CONFIG: Record<
  BookingState,
  {
    label: string;
    legendColor: string;
    legendBg: string;
    legendBorder: string;
  }
> = {
  pending: {
    label: "Pendiente",
    legendColor: "#FFC107",
    legendBg: "rgba(255,193,7,0.12)",
    legendBorder: "rgba(255,193,7,0.35)",
  },
  confirmed: {
    label: "Confirmada",
    legendColor: "#38BDF8",
    legendBg: "rgba(56,189,248,0.12)",
    legendBorder: "rgba(56,189,248,0.35)",
  },
  arrived: {
    label: "Ha llegado",
    legendColor: "#F59E0B",
    legendBg: "rgba(245,158,11,0.14)",
    legendBorder: "rgba(245,158,11,0.40)",
  },
  in_progress: {
    label: "En curso",
    legendColor: "#A78BFA",
    legendBg: "rgba(167,139,250,0.12)",
    legendBorder: "rgba(167,139,250,0.35)",
  },
  completed: {
    label: "Completada",
    legendColor: "#4FA1D8",
    legendBg: "rgba(79,161,216,0.12)",
    legendBorder: "rgba(79,161,216,0.35)",
  },
  cancelled: {
    label: "Cancelada",
    legendColor: "#9CA3AF",
    legendBg: "rgba(255,255,255,0.04)",
    legendBorder: "rgba(255,255,255,0.12)",
  },
  no_show: {
    label: "No se presentó",
    legendColor: "#E06072",
    legendBg: "rgba(224,96,114,0.12)",
    legendBorder: "rgba(224,96,114,0.35)",
  },
};

export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  {
    label: string;
    legendColor: string;
    legendBg: string;
    legendBorder: string;
    shortLabel: string;
  }
> = {
  unpaid: {
    label: "No pagado",
    shortLabel: "No pagado",
    legendColor: "#F59E0B",
    legendBg: "rgba(245,158,11,0.12)",
    legendBorder: "rgba(245,158,11,0.35)",
  },
  deposit: {
    label: "Adelanto pagado",
    shortLabel: "Adelanto",
    legendColor: "#FB7185",
    legendBg: "rgba(251,113,133,0.12)",
    legendBorder: "rgba(251,113,133,0.35)",
  },
  paid: {
    label: "Pagado",
    shortLabel: "Pagado",
    legendColor: "#4FA1D8",
    legendBg: "rgba(79,161,216,0.12)",
    legendBorder: "rgba(79,161,216,0.35)",
  },
};

export function getBookingStateFromLegacyStatus(status: BookingStatus): BookingState {
  switch (status) {
    case "cancelled":
      return "cancelled";
    case "no_show":
      return "no_show";
    case "completed":
      return "completed";
    case "confirmed":
      return "confirmed";
    case "paid":
      return "confirmed";
    case "hold":
    case "pending":
    default:
      return "pending";
  }
}

export function getPaymentStatusFromLegacyStatus(status: BookingStatus): PaymentStatus {
  return status === "paid" || status === "completed" ? "paid" : "unpaid";
}

export function getBookingPresentation(booking: Pick<Booking, "status" | "booking_state" | "payment_status">) {
  const bookingState = booking.booking_state ?? getBookingStateFromLegacyStatus(booking.status);
  const paymentStatus = booking.payment_status ?? getPaymentStatusFromLegacyStatus(booking.status);
  return {
    bookingState,
    paymentStatus,
    bookingStateConfig: BOOKING_STATE_CONFIG[bookingState],
    paymentStatusConfig: PAYMENT_STATUS_CONFIG[paymentStatus],
  };
}

export interface Booking {
  id: string;
  starts_at: string;
  ends_at: string;
  appointment_id?: string | null;
  status: BookingStatus;
  booking_state?: BookingState | null;
  payment_status?: PaymentStatus | null;
  deposit_amount_cents?: number | null;
  deposit_percent_bp?: number | null;
  deposit_currency?: string | null;
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  tenant_id?: string;
  customer?: {
    id?: string;
    name: string;
    email: string | null;
    phone: string | null;
    internal_notes?: string | null;
    preferred_staff_id?: string | null;
    preferred_time_of_day?: 'mañana' | 'tarde' | 'noche' | null;
    preferred_days?: string[] | null;
    last_call_status?: string | null;
    last_call_date?: string | null;
    next_due_date?: string | null;
    call_attempts?: number;
    prefers_whatsapp?: boolean;
  } | null;
  service?: {
    name: string;
    duration_min: number;
    price_cents: number;
  } | null;
  staff?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  active: boolean;
  color?: string | null;
  display_name?: string | null;
}

/**
 * Extended Customer interface with AI preferences
 */
export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes?: string | null; // Public notes visible to customer
  internal_notes?: string | null; // Internal notes for staff/AI only
  preferred_staff_id?: string | null;
  preferred_time_of_day?: 'mañana' | 'tarde' | 'noche' | null;
  preferred_days?: string[] | null; // ['lunes', 'martes', ...]
  last_call_status?: string | null; // 'answered', 'no_answer', 'voicemail', 'declined', 'scheduled'
  last_call_date?: string | null;
  next_due_date?: string | null;
  call_attempts?: number;
  prefers_whatsapp?: boolean;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StaffBlocking {
  id: string;
  staff_id: string;
  start_at: string;
  end_at: string;
  type: "block" | "absence" | "vacation";
  reason: string | null;
  notes: string | null;
}

export interface StaffSchedule {
  staff_id: string;
  start_time: string;
  end_time: string;
}

export interface CalendarSlot {
  staffId: string;
  time: string;
  date: string;
  endTime?: string;
  type?: "block" | "absence" | "vacation";
}

export type ViewMode = "day" | "week" | "month" | "list";

/**
 * Mapeo centralizado de estados de booking con labels, colores y variantes
 */
export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { 
  label: string; 
  color: string; 
  chipVariant: "default" | "outline";
  // Colores para la leyenda (formato premium)
  legendColor: string;
  legendBg: string;
  legendBorder: string;
}> = {
  hold: { 
    label: "Reserva temporal", 
    color: "bg-amber-500/10 text-amber-300", 
    chipVariant: "outline",
    legendColor: "#FFC107",
    legendBg: "rgba(255,193,7,0.12)",
    legendBorder: "#FFC107/30",
  },
  pending: {
    label: "Pendiente de pago",
    color: "bg-amber-500/10 text-amber-300",
    chipVariant: "default",
    legendColor: "#FFC107",
    legendBg: "rgba(255,193,7,0.12)",
    legendBorder: "#FFC107/30",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-sky-500/10 text-sky-300",
    chipVariant: "default",
    legendColor: "#38BDF8",
    legendBg: "rgba(56,189,248,0.12)",
    legendBorder: "#38BDF8/30",
  },
  paid: { 
    label: "Pagado", 
    color: "bg-emerald-500/10 text-emerald-300", 
    chipVariant: "default",
    legendColor: "#4FA1D8",
    legendBg: "rgba(79,161,216,0.12)",
    legendBorder: "#4FA1D8/30",
  },
  completed: { 
    label: "Completado", 
    color: "bg-emerald-500/10 text-emerald-300", 
    chipVariant: "outline",
    legendColor: "#4FA1D8",
    legendBg: "rgba(79,161,216,0.12)",
    legendBorder: "#4FA1D8/30",
  },
  cancelled: { 
    label: "Cancelado", 
    color: "bg-stone-500/10 text-stone-300", 
    chipVariant: "outline",
    legendColor: "#9ca3af",
    legendBg: "rgba(255,255,255,0.03)",
    legendBorder: "white/10",
  },
  no_show: { 
    label: "No se presentó", 
    color: "bg-rose-500/10 text-rose-300", 
    chipVariant: "outline",
    legendColor: "#E06072",
    legendBg: "rgba(224,96,114,0.12)",
    legendBorder: "#E06072/30",
  },
};

/**
 * Mapeo de estados de booking a etiquetas en español (compatibilidad)
 * @deprecated Usar BOOKING_STATUS_CONFIG en su lugar
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  hold: BOOKING_STATUS_CONFIG.hold.label,
  pending: BOOKING_STATUS_CONFIG.pending.label,
  confirmed: BOOKING_STATUS_CONFIG.confirmed.label,
  paid: BOOKING_STATUS_CONFIG.paid.label,
  completed: BOOKING_STATUS_CONFIG.completed.label,
  cancelled: BOOKING_STATUS_CONFIG.cancelled.label,
  no_show: BOOKING_STATUS_CONFIG.no_show.label,
};

/**
 * Obtiene la etiqueta en español para un estado de booking
 */
export function getBookingStatusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_CONFIG[status]?.label || status;
}

