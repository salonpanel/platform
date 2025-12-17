"use client";

import { useMemo } from "react";
import { format, parseISO, startOfDay, addMinutes, isSameDay } from "date-fns";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show" | "confirmed";
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  customer?: {
    name: string;
    email: string;
    phone: string | null;
  };
  service?: {
    name: string;
    duration_min: number;
    price_cents: number;
  };
  staff?: {
    name: string;
  };
};

interface AgendaTimelineProps {
  bookings: Booking[];
  selectedDate: string;
  timezone: string;
  onBookingClick?: (booking: Booking) => void;
}

// Colores según estado (Glass UI adaptation)
const statusColors = {
  hold: "bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20",
  pending: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
  paid: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20",
  completed: "bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20",
  cancelled: "bg-red-500/10 border-red-500/30 hover:bg-red-500/20",
  no_show: "bg-gray-500/10 border-gray-500/30 hover:bg-gray-500/20",
  confirmed: "bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20",
};

export function AgendaTimeline({
  bookings,
  selectedDate,
  timezone,
  onBookingClick,
}: AgendaTimelineProps) {
  // Generar intervalos de 30 minutos desde las 8:00 hasta las 22:00
  const timeSlots = useMemo(() => {
    const slots = [];
    const startHour = 8;
    const endHour = 22;

    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }

    return slots;
  }, []);

  // Calcular posición y altura de cada booking
  const bookingPositions = useMemo(() => {
    const selectedDateObj = parseISO(selectedDate);
    const dayStart = startOfDay(selectedDateObj);

    return bookings.map((booking) => {
      const startsAt = new Date(booking.starts_at);
      const endsAt = new Date(booking.ends_at);

      // Convertir a timezone del tenant para calcular posición
      const localStartsAt = toTenantLocalDate(startsAt, timezone);
      const localEndsAt = toTenantLocalDate(endsAt, timezone);

      // Calcular minutos desde medianoche
      const startMinutes =
        localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
      const endMinutes = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();
      const duration = endMinutes - startMinutes;

      // Posición en píxeles (cada hora = 120px, cada 30 min = 60px)
      const top = (startMinutes / 30) * 60;
      const height = (duration / 30) * 60;

      return {
        booking,
        top,
        height,
        startMinutes,
        endMinutes,
      };
    });
  }, [bookings, selectedDate, timezone]);

  // Calcular altura total del timeline (8:00 a 22:00 = 14 horas = 28 slots de 30 min)
  const timelineHeight = 28 * 60; // 1680px

  return (
    <GlassCard variant="default" noPadding className="overflow-hidden">
      <div className="relative" style={{ minHeight: `${timelineHeight}px` }}>
        {/* Grid de horas */}
        <div className="absolute inset-0 flex">
          {/* Columna de horas */}
          <div className="w-20 border-r border-white/10 bg-white/5">
            {timeSlots.map((time, index) => {
              const [hour, minute] = time.split(":").map(Number);
              const isHour = minute === 0;

              return (
                <div
                  key={time}
                  className={`
                    border-b border-white/5
                    ${isHour ? "h-16" : "h-16 border-dashed"}
                    flex items-start justify-end pr-3 pt-1
                  `}
                  style={{ height: "60px" }}
                >
                  {isHour && (
                    <span className="text-xs font-medium text-white/50">
                      {time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Área de bookings */}
          <div className="flex-1 relative">
            {/* Líneas de tiempo */}
            {timeSlots.map((time, index) => {
              const isHour = time.endsWith(":00");
              return (
                <div
                  key={time}
                  className={`
                    absolute left-0 right-0
                    ${isHour ? "border-t border-white/10" : "border-t border-dashed border-white/5"}
                  `}
                  style={{ top: `${index * 60}px` }}
                />
              );
            })}

            {/* Bookings */}
            {bookingPositions.map(({ booking, top, height }) => (
              <div
                key={booking.id}
                onClick={() => onBookingClick?.(booking)}
                className={`
                  absolute left-2 right-2 rounded-lg border-l-4 p-3
                  ${statusColors[booking.status] || statusColors.pending}
                  cursor-pointer backdrop-blur-sm transition-all duration-200
                  z-10 group
                `}
                style={{
                  top: `${top}px`,
                  height: `${Math.max(height, 60)}px`,
                  minHeight: "60px",
                }}
              >
                <div className="flex items-start justify-between h-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-semibold text-white/90">
                        {formatInTenantTz(booking.starts_at, timezone, "HH:mm")}{" "}
                        -{" "}
                        {formatInTenantTz(booking.ends_at, timezone, "HH:mm")}
                      </span>
                      <GlassBadge variant={booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'paid' ? 'success' : booking.status === 'cancelled' || booking.status === 'no_show' ? 'danger' : 'warning'} size="sm">
                        {booking.status}
                      </GlassBadge>
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      {booking.customer?.name || "Sin cliente"}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {booking.service?.name || "Sin servicio"}
                    </div>
                    {booking.staff && (
                      <div className="text-xs text-white/50 mt-1">
                        👤 {booking.staff.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

