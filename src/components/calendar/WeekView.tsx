"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay, startOfToday } from "date-fns";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { motion } from "framer-motion";

interface WeekViewProps {
  bookings: Booking[];
  staffList: Array<{ id: string; name: string }>;
  selectedDate: string;
  timezone: string;
  onBookingClick: (booking: Booking) => void;
}

export function WeekView({
  bookings,
  staffList,
  selectedDate,
  timezone,
  onBookingClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }); // Lunes
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00
  const today = startOfToday();

  // Agrupar bookings por día usando useMemo para mejor performance
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    weekDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      map.set(dayKey, []);
    });

    bookings.forEach((booking) => {
      const bookingDate = new Date(booking.starts_at);
      const localBookingDate = toTenantLocalDate(bookingDate, timezone);
      const dayKey = format(localBookingDate, "yyyy-MM-dd");
      if (map.has(dayKey)) {
        map.get(dayKey)!.push(booking);
      }
    });

    return map;
  }, [bookings, weekDays, timezone]);

  const getBookingsForDay = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    return bookingsByDay.get(dayKey) || [];
  };

  const getBookingPosition = (booking: Booking) => {
    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    
    // Convertir a timezone local
    const localStart = toTenantLocalDate(start, timezone);
    const localEnd = toTenantLocalDate(end, timezone);
    
    const startHour = localStart.getHours() + localStart.getMinutes() / 60;
    const endHour = localEnd.getHours() + localEnd.getMinutes() / 60;
    const duration = endHour - startHour;

    const top = ((startHour - 8) / 13) * 100; // 8:00 es 0%, 21:00 es 100%
    const height = (duration / 13) * 100;

    return { top: `${top}%`, height: `${height}%` };
  };

  // Usar la misma paleta de colores que Day view (desde BOOKING_STATUS_CONFIG)
  const getStatusColor = (status: Booking["status"]) => {
    // Mapeo directo basado en los colores de Day view (statusColors)
    const statusColorMap: Record<Booking["status"], string> = {
      hold: "border-[#FFC107]/30 bg-[rgba(255,193,7,0.12)] text-[#FFC107]",
      pending: "border-[#FFC107]/30 bg-[rgba(255,193,7,0.12)] text-[#FFC107]",
      paid: "border-[#3A6DFF]/30 bg-[rgba(58,109,255,0.12)] text-[#3A6DFF]",
      completed: "border-[#4FE3C1]/30 bg-[rgba(79,227,193,0.12)] text-[#4FE3C1]",
      cancelled: "border-white/10 bg-white/3 text-[#9ca3af] opacity-60",
      no_show: "border-[#FF6DA3]/30 bg-[rgba(255,109,163,0.12)] text-[#FF6DA3]",
    };
    return `${statusColorMap[status] || statusColorMap.pending} border-l-[3px] backdrop-blur-md`;
  };

  return (
    <div className="w-full h-full overflow-x-auto scrollbar-hide bg-[#15171A]">
      <div className="min-w-[800px] h-full">
        {/* Header con días de la semana - Premium */}
        <div className="grid grid-cols-8 border-b border-white/5 sticky top-0 bg-[#15171A] backdrop-blur-md z-10">
          <div className="p-4 text-sm font-semibold text-white border-r border-white/5 font-['Plus_Jakarta_Sans']">
            Hora
          </div>
          {weekDays.map((day, idx) => {
            const isSelected = isSameDay(day, parseISO(selectedDate));
            const isTodayDate = isSameDay(day, today);
            return (
              <div
                key={idx}
                className={`p-4 text-center border-r border-white/5 transition-colors relative ${
                  isSelected
                    ? "bg-[rgba(58,109,255,0.12)] border-b-2 border-[#3A6DFF]"
                    : isTodayDate
                    ? "bg-[rgba(79,227,193,0.08)] border-b-2 border-[#4FE3C1]/40"
                    : "hover:bg-white/3"
                }`}
              >
                <div className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1 font-['Plus_Jakarta_Sans']">
                  {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(day)}
                </div>
                <div className={`text-lg font-semibold ${
                  isSelected
                    ? "text-[#3A6DFF]"
                    : isTodayDate
                    ? "text-[#4FE3C1]"
                    : "text-white"
                } font-['Plus_Jakarta_Sans']`}>
                  {format(day, "d")}
                </div>
                {isTodayDate && !isSelected && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#4FE3C1]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="relative flex-1 overflow-y-auto scrollbar-hide bg-[#15171A]">
          <div className="grid grid-cols-8">
            {/* Columna de horas */}
            <div className="border-r border-white/5">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="p-3 text-xs font-semibold text-white border-b border-white/5 min-h-[60px] font-mono font-['Plus_Jakarta_Sans']"
                >
                  {hour}:00
                </div>
              ))}
            </div>
            {/* Columnas de días con bookings */}
            {weekDays.map((day, dayIdx) => {
              const dayBookings = getBookingsForDay(day);
              return (
                <div
                  key={dayIdx}
                  className="relative border-r border-white/5"
                  style={{
                    minHeight: `${hours.length * 60}px`,
                  }}
                >
                  {/* Filas de horas (solo visual) */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-white/5 min-h-[60px]"
                    />
                  ))}
                  {/* Bookings para este día */}
                  {dayBookings.map((booking) => {
                    const position = getBookingPosition(booking);
                    const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02, brightness: 1.1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onBookingClick(booking)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onBookingClick(booking);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
                        className={`absolute left-2 right-2 rounded-[12px] p-2.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/50 focus:ring-offset-2 focus:ring-offset-[#15171A] transition-all border-l-[3px] z-10 ${getStatusColor(
                          booking.status
                        )}`}
                        style={{
                          top: position.top,
                          height: position.height,
                          minHeight: "50px",
                          boxShadow: "0px 2px 8px rgba(0,0,0,0.25), inset 0px 1px 0px rgba(255,255,255,0.08)",
                        }}
                      >
                        {/* Hora de inicio - Prioridad 1 */}
                        <div className="text-[9px] font-semibold text-current/90 mb-1 font-mono font-['Plus_Jakarta_Sans']">
                          {startTime}
                        </div>
                        {/* Cliente - Prioridad 2 */}
                        <div className="text-[11px] font-semibold text-current truncate mb-1 font-['Plus_Jakarta_Sans']">
                          {booking.customer?.name || "Sin cliente"}
                        </div>
                        {/* Servicio - Prioridad 3 (truncar si no hay espacio) */}
                        {parseFloat(position.height.replace("%", "")) > 15 && (
                          <div className="text-[10px] text-current/80 truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                            {booking.service?.name || "Sin servicio"}
                          </div>
                        )}
                        {/* Status badge solo si hay espacio suficiente */}
                        {parseFloat(position.height.replace("%", "")) > 20 && (
                          <div>
                            <StatusBadge status={booking.status} size="xs" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

