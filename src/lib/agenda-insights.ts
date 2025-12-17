/**
 * Helper para calcular insights de utilización del staff
 * Calcula minutos disponibles, minutos reservados y % de utilización por staff
 */

import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { toTenantLocalDate } from "@/lib/timezone";
import { Booking, Staff, StaffSchedule, ViewMode } from "@/types/agenda";

export interface StaffUtilization {
  staffId: string;
  staffName: string;
  availableMinutes: number;
  bookedMinutes: number;
  utilization: number; // 0-100
}

/**
 * Calcula la utilización de cada staff en el rango actual (día/semana/mes)
 */
export function calculateStaffUtilization({
  bookings,
  staffList,
  staffSchedules,
  selectedDate,
  viewMode,
  timezone,
}: {
  bookings: Booking[];
  staffList: Staff[];
  staffSchedules: StaffSchedule[];
  selectedDate: string;
  viewMode: ViewMode;
  timezone: string;
}): StaffUtilization[] {
  const selectedDateObj = parseISO(selectedDate);
  
  // Calcular rango de fechas según viewMode (usar mismo enfoque que getBookingsInCurrentRange)
  let startDate: Date;
  let endDate: Date;
  
  switch (viewMode) {
    case "day": {
      startDate = selectedDateObj;
      endDate = selectedDateObj;
      break;
    }
    case "week": {
      // Lunes a domingo de la semana seleccionada
      startDate = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
      endDate = endOfWeek(selectedDateObj, { weekStartsOn: 1 });
      break;
    }
    case "month": {
      // Primer y último día del mes
      startDate = startOfMonth(selectedDateObj);
      endDate = endOfMonth(selectedDateObj);
      break;
    }
    default: {
      startDate = selectedDateObj;
      endDate = selectedDateObj;
    }
  }

  // Obtener todos los días en el rango
  const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });

  // Calcular utilización por staff
  return staffList
    .filter((staff) => staff.active)
    .map((staff) => {
      // Obtener horario general del staff
      const schedule = staffSchedules.find((s) => s.staff_id === staff.id);
      
      // Calcular minutos disponibles totales en el rango
      let availableMinutes = 0;
      
      daysInRange.forEach((day) => {
        // Usar horario general (por ahora; en el futuro podría haber horarios específicos por día)
        const dayStartTime = schedule?.start_time || "09:00";
        const dayEndTime = schedule?.end_time || "18:00";
        
        const [startHour, startMinute] = dayStartTime.split(":").map(Number);
        const [endHour, endMinute] = dayEndTime.split(":").map(Number);
        
        const dayStartMinutes = startHour * 60 + startMinute;
        const dayEndMinutes = endHour * 60 + endMinute;
        const dayAvailableMinutes = dayEndMinutes - dayStartMinutes;
        
        availableMinutes += Math.max(0, dayAvailableMinutes);
      });

      // Calcular minutos reservados para este staff en el rango
      const staffBookings = bookings.filter(
        (booking) =>
          booking.staff_id === staff.id &&
          booking.starts_at &&
          booking.ends_at
      );

      let bookedMinutes = 0;
      staffBookings.forEach((booking) => {
        const bookingStart = new Date(booking.starts_at);
        const bookingEnd = new Date(booking.ends_at);
        const localStart = toTenantLocalDate(bookingStart, timezone);
        const localEnd = toTenantLocalDate(bookingEnd, timezone);
        
        // Verificar si el booking está dentro del rango (mismo enfoque que getBookingsInCurrentRange)
        const bookingDate = format(localStart, "yyyy-MM-dd");
        const bookingDateObj = parseISO(bookingDate);
        
        // Verificar si el día del booking está en el rango
        const isInRange = daysInRange.some((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          return dayKey === bookingDate;
        });
        
        if (isInRange) {
          // Calcular duración en minutos
          const durationMs = localEnd.getTime() - localStart.getTime();
          const durationMinutes = Math.round(durationMs / (1000 * 60));
          bookedMinutes += Math.max(0, durationMinutes);
        }
      });

      // Calcular % de utilización (0-100)
      const utilization = availableMinutes > 0 
        ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100))
        : 0;

      return {
        staffId: staff.id,
        staffName: staff.name,
        availableMinutes,
        bookedMinutes,
        utilization,
      };
    })
    .sort((a, b) => b.utilization - a.utilization); // Ordenar por utilización descendente
}

