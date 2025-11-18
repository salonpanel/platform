/**
 * Tipos centralizados para la Agenda
 */

export type BookingStatus = "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";

export interface Booking {
  id: string;
  starts_at: string;
  ends_at: string;
  appointment_id?: string | null;
  status: BookingStatus;
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  tenant_id?: string;
  customer?: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  service?: {
    name: string;
    duration_min: number;
    price_cents: number;
  } | null;
  staff?: {
    id: string;
    name: string;
  } | null;
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  active: boolean;
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
  paid: { 
    label: "Pagado", 
    color: "bg-emerald-500/10 text-emerald-300", 
    chipVariant: "default",
    legendColor: "#3A6DFF",
    legendBg: "rgba(58,109,255,0.12)",
    legendBorder: "#3A6DFF/30",
  },
  completed: { 
    label: "Completado", 
    color: "bg-emerald-500/10 text-emerald-300", 
    chipVariant: "outline",
    legendColor: "#4FE3C1",
    legendBg: "rgba(79,227,193,0.12)",
    legendBorder: "#4FE3C1/30",
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
    legendColor: "#FF6DA3",
    legendBg: "rgba(255,109,163,0.12)",
    legendBorder: "#FF6DA3/30",
  },
};

/**
 * Mapeo de estados de booking a etiquetas en español (compatibilidad)
 * @deprecated Usar BOOKING_STATUS_CONFIG en su lugar
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  hold: BOOKING_STATUS_CONFIG.hold.label,
  pending: BOOKING_STATUS_CONFIG.pending.label,
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

