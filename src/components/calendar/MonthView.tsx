"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfToday } from "date-fns";
import { parseISO } from "date-fns";
import { Card } from "@/components/ui/Card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking } from "@/types/agenda";

interface MonthViewProps {
  bookings: Booking[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onBookingClick: (booking: Booking) => void;
  timezone?: string;
}

export function MonthView({
  bookings,
  selectedDate,
  onDateSelect,
  onBookingClick,
  timezone = "Europe/Madrid",
}: MonthViewProps) {
  const currentDate = parseISO(selectedDate);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfMonth(currentDate);
  const calendarEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = startOfToday();

  // Añadir días del mes anterior/siguiente para completar la semana
  const firstDayOfWeek = calendarStart.getDay();
  const lastDayOfWeek = calendarEnd.getDay();
  const daysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Lunes = 0
  const daysAfter = 7 - (lastDayOfWeek === 0 ? 7 : lastDayOfWeek);

  const allDays: (Date | null)[] = useMemo(() => [
    ...Array(daysBefore).fill(null),
    ...days,
    ...Array(daysAfter).fill(null),
  ], [daysBefore, days, daysAfter]);

  // Agrupar bookings por día usando useMemo para mejor performance
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    days.forEach((day) => {
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

    // Ordenar bookings por hora de inicio dentro de cada día
    map.forEach((dayBookings) => {
      dayBookings.sort((a, b) => {
        const aTime = new Date(a.starts_at).getTime();
        const bTime = new Date(b.starts_at).getTime();
        return aTime - bTime;
      });
    });

    return map;
  }, [bookings, days, timezone]);

  const getBookingsForDay = (day: Date | null) => {
    if (!day) return [];
    const dayKey = format(day, "yyyy-MM-dd");
    return bookingsByDay.get(dayKey) || [];
  };

  // Obtener iniciales del cliente o nombre corto
  const getCustomerInitial = (name: string | null | undefined): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = direction === "next" 
      ? addMonths(currentDate, 1)
      : subMonths(currentDate, 1);
    onDateSelect(format(newDate, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-5 h-full flex flex-col p-4">
      {/* Navegación del mes - Premium */}
      <div className="flex items-center justify-between bg-[#15171A] rounded-2xl p-4 border border-white/5 backdrop-blur-md">
        <motion.button 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth("prev")}
          className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
        >
          <ChevronLeft className="h-5 w-5" />
        </motion.button>
        <h3 className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans'] tracking-tight">
          {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(currentDate)}
        </h3>
        <motion.button 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }}
          onClick={() => navigateMonth("next")}
          className="p-2 text-[#d1d4dc] hover:text-white hover:bg-white/5 rounded-[10px] transition-all duration-150"
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Grid del calendario */}
      <div className="grid grid-cols-7 gap-2 flex-1">
        {/* Días de la semana - Premium */}
        {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
          <div
            key={day}
            className="p-3 text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']"
          >
            {day}
          </div>
        ))}

        {/* Días del mes */}
        {allDays.map((day, idx) => {
          const dayBookings = getBookingsForDay(day);
          const isCurrentMonth = day ? isSameMonth(day, currentDate) : false;
          const isSelected = day ? isSameDay(day, currentDate) : false;
          const isTodayDate = day ? isSameDay(day, today) : false;

          // Usar la misma paleta de colores que Day view
          const getBookingColor = (status: Booking["status"]) => {
            const statusColorMap: Record<Booking["status"], string> = {
              hold: "bg-[rgba(255,193,7,0.12)] border-l-[2px] border-[#FFC107]/30 text-[#FFC107]",
              pending: "bg-[rgba(255,193,7,0.12)] border-l-[2px] border-[#FFC107]/30 text-[#FFC107]",
              paid: "bg-[rgba(58,109,255,0.12)] border-l-[2px] border-[#3A6DFF]/30 text-[#3A6DFF]",
              completed: "bg-[rgba(79,227,193,0.12)] border-l-[2px] border-[#4FE3C1]/30 text-[#4FE3C1]",
              cancelled: "bg-white/3 border-l-[2px] border-white/10 text-[#9ca3af] opacity-60",
              no_show: "bg-[rgba(255,109,163,0.12)] border-l-[2px] border-[#FF6DA3]/30 text-[#FF6DA3]",
            };
            return statusColorMap[status] || statusColorMap.pending;
          };

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.005, duration: 0.15, ease: "easeOut" }}
              className={`bg-[#15171A] rounded-[14px] p-2 sm:p-2.5 min-h-[80px] sm:min-h-[100px] cursor-pointer transition-all border ${
                !isCurrentMonth ? "opacity-30" : ""
              } ${
                isSelected 
                  ? "ring-2 ring-[#3A6DFF] bg-[rgba(58,109,255,0.12)] border-[#3A6DFF]" 
                  : "border-white/5 hover:border-white/10 hover:bg-white/3"
              } ${
                isTodayDate && !isSelected ? "bg-[rgba(79,227,193,0.08)] border-[#4FE3C1]/40" : ""
              }`}
              onClick={() => {
                if (day) {
                  onDateSelect(format(day, "yyyy-MM-dd"));
                }
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div
                  className={`text-sm sm:text-base font-semibold font-['Plus_Jakarta_Sans'] ${
                    isTodayDate
                      ? "text-[#4FE3C1]"
                      : isSelected
                      ? "text-[#3A6DFF]"
                      : "text-white"
                  }`}
                >
                  {day ? format(day, "d") : ""}
                </div>
                {isTodayDate && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FE3C1]" />
                )}
              </div>
              <div className="space-y-1">
                {dayBookings.slice(0, 3).map((booking) => {
                  const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
                  const customerName = booking.customer?.name || "Sin cliente";
                  const customerInitial = getCustomerInitial(customerName);
                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05, duration: 0.15 }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onBookingClick(booking);
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && day) {
                          e.preventDefault();
                          e.stopPropagation();
                          onBookingClick(booking);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Cita de ${customerName} a las ${startTime}`}
                      className={`text-[9px] sm:text-[10px] p-1 sm:p-1.5 rounded-[8px] truncate cursor-pointer hover:scale-[1.02] transition-all backdrop-blur-sm flex items-center gap-1.5 ${getBookingColor(booking.status)}`}
                    >
                      {/* Dot de color según status */}
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        booking.status === "paid" || booking.status === "completed"
                          ? "bg-[#3A6DFF]"
                          : booking.status === "pending" || booking.status === "hold"
                          ? "bg-[#FFC107]"
                          : booking.status === "cancelled"
                          ? "bg-[#9ca3af]"
                          : booking.status === "no_show"
                          ? "bg-[#FF6DA3]"
                          : "bg-[#4FE3C1]"
                      }`} />
                      {/* Hora */}
                      <span className="font-semibold font-mono flex-shrink-0">{startTime}</span>
                      {/* Iniciales o nombre corto */}
                      <span className="font-medium truncate">{customerInitial}</span>
                    </motion.div>
                  );
                })}
                {dayBookings.length > 3 && (
                  <div className="text-[9px] sm:text-[10px] font-semibold text-[#9ca3af] pt-1 font-['Plus_Jakarta_Sans']">
                    +{dayBookings.length - 3} más
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

