"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { format, parseISO, startOfDay, addMinutes } from "date-fns";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CheckCircle2, MessageSquare, Star, CreditCard, AlertCircle } from "lucide-react";
import { AgendaActionPopover } from "@/components/calendar/AgendaActionPopover";
import { BookingActionPopover } from "@/components/calendar/BookingActionPopover";
import { BookingMoveConfirmModal } from "@/components/calendar/BookingMoveConfirmModal";
import { BookingResizeConfirmModal } from "@/components/calendar/BookingResizeConfirmModal";
import { motion, AnimatePresence } from "framer-motion";
import { toTenantLocalDate } from "@/lib/timezone";
import { Booking, Staff, StaffBlocking, StaffSchedule, BookingStatus, CalendarSlot } from "@/types/agenda";

interface AgendaCalendarViewProps {
  bookings: Booking[];
  staffBlockings?: StaffBlocking[];
  staffList: Staff[];
  selectedDate: string;
  selectedStaffIds: string[];
  timezone: string;
  staffSchedules?: StaffSchedule[]; // Horarios operativos del staff para el día seleccionado
  showFreeSlots?: boolean; // Mostrar solo huecos libres
  onBookingClick?: (booking: Booking) => void;
  onSlotClick?: (slot: CalendarSlot) => void;
  onNewBooking?: (slot: CalendarSlot) => void;
  onUnavailability?: (slot: CalendarSlot) => void;
  onAbsence?: (slot: CalendarSlot) => void;
  onBookingMove?: (bookingId: string, newStaffId: string, newStartTime: string, newEndTime: string) => void;
  onBookingResize?: (bookingId: string, newStartTime: string, newEndTime: string) => void;
  onBookingEdit?: (booking: Booking) => void;
  onBookingCancel?: (bookingId: string) => void;
  onBookingSendMessage?: (booking: Booking) => void;
  onBookingStatusChange?: (bookingId: string, newStatus: BookingStatus) => void;
  canCancel?: boolean;
}

// Colores premium según estado - Pastel con bordes sutiles
const statusColors = {
  hold: "border-[#FFC107]/30 bg-[rgba(255,193,7,0.12)] text-[#FFC107]",
  pending: "border-[#FFC107]/30 bg-[rgba(255,193,7,0.12)] text-[#FFC107]",
  paid: "border-[#3A6DFF]/30 bg-[rgba(58,109,255,0.12)] text-[#3A6DFF]",
  completed: "border-[#4FE3C1]/30 bg-[rgba(79,227,193,0.12)] text-[#4FE3C1]",
  cancelled: "border-white/10 bg-white/3 text-[#9ca3af] opacity-60",
  no_show: "border-[#FF6DA3]/30 bg-[rgba(255,109,163,0.12)] text-[#FF6DA3]",
};

// Colores y estilos para bloqueos según tipo - Menos intrusivos
const blockingColors = {
  block: "bg-white/3 border-l-[3px] border-white/10 text-[#9ca3af] opacity-50 backdrop-blur-sm",
  absence: "bg-[rgba(239,68,68,0.08)] border-l-[3px] border-[#EF4444]/30 text-[#EF4444] opacity-60 backdrop-blur-sm",
  vacation: "bg-[rgba(58,109,255,0.08)] border-l-[3px] border-[#3A6DFF]/30 text-[#3A6DFF] opacity-60 backdrop-blur-sm",
};

// Constantes centralizadas para cálculos de posición
// Cada slot de 15 minutos = 60px de altura
const SLOT_HEIGHT_PX = 60;
const SLOT_DURATION_MINUTES = 15;
const MIN_BOOKING_HEIGHT_PX = 60; // Altura mínima para una cita (15 min)
const DEFAULT_SLOT_DURATION_MINUTES = 30; // Para pre-llenar modales desde gaps libres

// Generar slots de tiempo (cada 15 minutos) - se genera dinámicamente según horarios del staff
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION_MINUTES) {
      slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
    }
  }
  return slots;
};

export function AgendaCalendarView({
  bookings,
  staffBlockings = [],
  staffList,
  selectedDate,
  selectedStaffIds,
  timezone,
  staffSchedules = [],
  showFreeSlots = false,
  onBookingClick,
  onSlotClick,
  onNewBooking,
  onUnavailability,
  onAbsence,
  onBookingMove,
  onBookingResize,
  onBookingEdit,
  onBookingCancel,
  onBookingSendMessage,
  onBookingStatusChange,
  canCancel = true,
}: AgendaCalendarViewProps) {
  
  // Calcular rango horario basado en horarios operativos del staff
  const { startHour, endHour, startMinutes } = useMemo(() => {
    if (staffSchedules.length === 0) {
      // Si no hay horarios, usar valores por defecto
      return { startHour: 8, endHour: 22, startMinutes: 8 * 60 };
    }

    // Encontrar la hora de inicio más temprana y la hora de fin más tardía
    let earliestStart = 24;
    let latestEnd = 0;

    staffSchedules.forEach((schedule) => {
      const [startH, startM] = schedule.start_time.split(":").map(Number);
      const [endH, endM] = schedule.end_time.split(":").map(Number);
      
      const startHourDecimal = startH + startM / 60;
      const endHourDecimal = endH + endM / 60;

      if (startHourDecimal < earliestStart) {
        earliestStart = startHourDecimal;
      }
      if (endHourDecimal > latestEnd) {
        latestEnd = endHourDecimal;
      }
    });

    // Redondear hacia abajo para inicio y hacia arriba para fin
    const calcStartHour = Math.floor(earliestStart);
    const calcEndHour = Math.ceil(latestEnd);
    const calcStartMinutes = calcStartHour * 60 + Math.floor((earliestStart - calcStartHour) * 60);

    return {
      startHour: calcStartHour,
      endHour: calcEndHour,
      startMinutes: calcStartMinutes,
    };
  }, [staffSchedules]);

  const timeSlots = useMemo(() => generateTimeSlots(startHour, endHour), [startHour, endHour]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timeColumnRef = useRef<HTMLDivElement>(null);
  const staffColumnsRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);
  const [popoverState, setPopoverState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    slot: CalendarSlot | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    slot: null,
  });

  // Estado para popover de acciones de booking
  const [bookingActionPopover, setBookingActionPopover] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    booking: Booking | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    booking: null,
  });

  // Estados para drag & drop
  const [draggingBooking, setDraggingBooking] = useState<{
    bookingId: string;
    originalStaffId: string;
    originalTop: number;
    dragOffset: { x: number; y: number };
    currentTop: number;
    currentStaffId: string;
  } | null>(null);
  const draggingRef = useRef<typeof draggingBooking>(null);

  // Estados para redimensionamiento
  const [resizingBooking, setResizingBooking] = useState<{
    bookingId: string;
    staffId: string; // Guardar staff_id para acceder a la columna correcta
    originalHeight: number;
    originalTop: number;
    resizeType: "start" | "end"; // Redimensionar desde el inicio o desde el fin
    currentHeight: number;
  } | null>(null);
  const resizingRef = useRef<typeof resizingBooking>(null);
  
  // Flags para prevenir onClick después de drag/resize
  const justFinishedDragRef = useRef(false);
  const justFinishedResizeRef = useRef(false);
  
  // Referencias para navegación por teclado
  const bookingRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);
  
  // Estado para modal de confirmación de movimiento
  const [moveConfirmModal, setMoveConfirmModal] = useState<{
    isOpen: boolean;
    booking: Booking | null;
    newStartTime: string;
    newEndTime: string;
    newStaffId: string;
  }>({
    isOpen: false,
    booking: null,
    newStartTime: "",
    newEndTime: "",
    newStaffId: "",
  });
  
  // Estado para modal de confirmación de redimensionamiento
  const [resizeConfirmModal, setResizeConfirmModal] = useState<{
    isOpen: boolean;
    booking: Booking | null;
    newStartTime: string;
    newEndTime: string;
  }>({
    isOpen: false,
    booking: null,
    newStartTime: "",
    newEndTime: "",
  });
  
  // Filtrar staff según selección
  const visibleStaff = useMemo(() => {
    if (selectedStaffIds.length === 0 || selectedStaffIds.includes("all")) {
      return staffList.filter((s) => s.active);
    }
    return staffList.filter((s) => selectedStaffIds.includes(s.id) && s.active);
  }, [staffList, selectedStaffIds]);

  // Sincronizar scroll entre columna de horas y columnas de staff
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    // Esperar a que el DOM se renderice completamente
    const timeoutId = setTimeout(() => {
      const timeColumn = timeColumnRef.current;
      const staffColumns = Array.from(staffColumnsRefs.current.values());
      
      if (!timeColumn || staffColumns.length === 0) return;

      const syncScroll = (source: HTMLDivElement, targetScrollTop: number) => {
        // Evitar bucles infinitos - si ya estamos sincronizando, salir
        if (isScrollingRef.current) return;
        
        // Marcar que estamos sincronizando ANTES de hacer cambios
        isScrollingRef.current = true;
        
        // Usar requestAnimationFrame para sincronizar en el siguiente frame
        requestAnimationFrame(() => {
          // Sincronizar columna de horas si no es la fuente
          if (timeColumn && timeColumn !== source) {
            const currentTimeScroll = timeColumn.scrollTop;
            if (Math.abs(currentTimeScroll - targetScrollTop) > 0.5) {
              timeColumn.scrollTop = targetScrollTop;
            }
          }
          
          // Sincronizar todas las columnas de staff si no son la fuente
          staffColumns.forEach((col) => {
            if (col && col !== source) {
              const currentStaffScroll = col.scrollTop;
              if (Math.abs(currentStaffScroll - targetScrollTop) > 0.5) {
                col.scrollTop = targetScrollTop;
              }
            }
          });
          
          // Resetear el flag después de sincronizar
          requestAnimationFrame(() => {
            isScrollingRef.current = false;
          });
        });
      };

      const handleTimeColumnScroll = () => {
        if (timeColumn && !isScrollingRef.current) {
          const scrollTop = timeColumn.scrollTop;
          syncScroll(timeColumn, scrollTop);
        }
      };

      const handleStaffColumnScroll = (e: Event) => {
        const target = e.target as HTMLDivElement;
        if (target && !isScrollingRef.current) {
          const scrollTop = target.scrollTop;
          syncScroll(target, scrollTop);
        }
      };

      // Agregar listeners con passive para mejor rendimiento
      timeColumn.addEventListener('scroll', handleTimeColumnScroll, { passive: true });
      staffColumns.forEach((col) => {
        col.addEventListener('scroll', handleStaffColumnScroll, { passive: true });
      });

      // Guardar función de cleanup
      cleanup = () => {
        timeColumn.removeEventListener('scroll', handleTimeColumnScroll);
        staffColumns.forEach((col) => {
          col.removeEventListener('scroll', handleStaffColumnScroll);
        });
      };
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, [visibleStaff.length]);

  // Auto-scroll a la hora actual
  useEffect(() => {
    const scrollableElements = [
      timeColumnRef.current,
      ...Array.from(staffColumnsRefs.current.values()),
    ].filter(Boolean) as HTMLDivElement[];

    if (scrollableElements.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;
    
    // Solo hacer scroll si estamos viendo el día actual
    // selectedDate está en formato "yyyy-MM-dd"
    const [year, month, day] = selectedDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const today = new Date();
    const isToday = 
      selectedDateObj.getFullYear() === today.getFullYear() &&
      selectedDateObj.getMonth() === today.getMonth() &&
      selectedDateObj.getDate() === today.getDate();
    
    if (isToday) {
      // Calcular posición relativa al inicio del día visible
      const relativeMinutes = currentMinutes - startMinutes;
      if (relativeMinutes >= 0 && relativeMinutes < (endHour - startHour) * 60) {
        // Usar constantes centralizadas: cada 15 min = 60px
        const scrollPosition = (relativeMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX - 200; // 200px de offset para ver mejor
        const targetScroll = Math.max(0, scrollPosition);
        
        // Aplicar scroll a todos los elementos sincronizadamente
        isScrollingRef.current = true;
        scrollableElements.forEach((el) => {
          el.scrollTop = targetScroll;
        });
        requestAnimationFrame(() => {
          isScrollingRef.current = false;
        });
      }
    }
  }, [selectedDate, startMinutes, startHour, endHour, visibleStaff.length]);

  // Organizar bookings por staff
  const bookingsByStaff = useMemo(() => {
    const map = new Map<string, Booking[]>();
    visibleStaff.forEach((staff) => {
      map.set(staff.id, []);
    });
    
    bookings.forEach((booking) => {
      if (booking.staff_id && map.has(booking.staff_id)) {
        map.get(booking.staff_id)!.push(booking);
      }
    });
    
    return map;
  }, [bookings, visibleStaff]);

  // Organizar bloqueos por staff
  const blockingsByStaff = useMemo(() => {
    const map = new Map<string, StaffBlocking[]>();
    visibleStaff.forEach((staff) => {
      map.set(staff.id, []);
    });
    
    staffBlockings.forEach((blocking) => {
      if (blocking.staff_id && map.has(blocking.staff_id)) {
        map.get(blocking.staff_id)!.push(blocking);
      }
    });
    
    return map;
  }, [staffBlockings, visibleStaff]);

  // Calcular posición y altura de cada booking
  const getBookingPosition = (booking: Booking) => {
    const startsAt = new Date(booking.starts_at);
    const endsAt = new Date(booking.ends_at);
    
    // Convertir a timezone del tenant
    const localStartsAt = toTenantLocalDate(startsAt, timezone);
    const localEndsAt = toTenantLocalDate(endsAt, timezone);
    
    // Calcular minutos desde medianoche
    const startMinutesFromMidnight = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
    const endMinutesFromMidnight = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();
    
    // Calcular minutos relativos al inicio del día visible (startMinutes calculado dinámicamente)
    const relativeStartMinutes = startMinutesFromMidnight - startMinutes;
    const relativeEndMinutes = endMinutesFromMidnight - startMinutes;
    const duration = relativeEndMinutes - relativeStartMinutes;
    
    // Posición en píxeles usando constantes centralizadas
    // Cada slot de 15 minutos = 60px de altura
    const slotIndex = Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES);
    const top = Math.max(0, slotIndex * SLOT_HEIGHT_PX);
    const height = Math.max(MIN_BOOKING_HEIGHT_PX, Math.ceil(duration / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX);
    
    return { top, height, startMinutes: startMinutesFromMidnight, endMinutes: endMinutesFromMidnight };
  };

  // Lista ordenada de bookings para navegación por teclado (por staff y luego por hora)
  const orderedBookings = useMemo(() => {
    const allBookings: Array<{ booking: Booking; staffIndex: number; position: { top: number; startMinutes: number } }> = [];
    
    visibleStaff.forEach((staff, staffIndex) => {
      const staffBookings = bookingsByStaff.get(staff.id) || [];
      staffBookings.forEach((booking) => {
        const pos = getBookingPosition(booking);
        if (pos) {
          allBookings.push({
            booking,
            staffIndex,
            position: { top: pos.top, startMinutes: pos.startMinutes },
          });
        }
      });
    });
    
    // Ordenar por staff (columna) y luego por hora (top)
    return allBookings.sort((a, b) => {
      if (a.staffIndex !== b.staffIndex) {
        return a.staffIndex - b.staffIndex;
      }
      return a.position.startMinutes - b.position.startMinutes;
    });
  }, [visibleStaff, bookingsByStaff, bookings, startMinutes, timezone]);
  
  // Función para encontrar el siguiente booking en la dirección especificada
  const findNextBooking = useMemo(() => {
    return (currentBookingId: string, direction: "up" | "down" | "left" | "right") => {
      const currentIndex = orderedBookings.findIndex((item) => item.booking.id === currentBookingId);
      if (currentIndex === -1) return null;
      
      const current = orderedBookings[currentIndex];
      
      if (direction === "up" || direction === "down") {
        // Buscar en la misma columna (staff)
        const sameColumnBookings = orderedBookings.filter((item) => item.staffIndex === current.staffIndex);
        const currentColIndex = sameColumnBookings.findIndex((item) => item.booking.id === currentBookingId);
        
        if (direction === "up" && currentColIndex > 0) {
          return sameColumnBookings[currentColIndex - 1].booking.id;
        } else if (direction === "down" && currentColIndex < sameColumnBookings.length - 1) {
          return sameColumnBookings[currentColIndex + 1].booking.id;
        }
      } else if (direction === "left" || direction === "right") {
        // Buscar en columna adyacente con hora similar
        const targetStaffIndex = direction === "left" ? current.staffIndex - 1 : current.staffIndex + 1;
        
        if (targetStaffIndex >= 0 && targetStaffIndex < visibleStaff.length) {
          // Buscar booking más cercano en la columna adyacente
          const adjacentBookings = orderedBookings.filter((item) => item.staffIndex === targetStaffIndex);
          if (adjacentBookings.length > 0) {
            // Encontrar el booking más cercano en tiempo
            const closest = adjacentBookings.reduce((prev, curr) => {
              const prevDiff = Math.abs(prev.position.startMinutes - current.position.startMinutes);
              const currDiff = Math.abs(curr.position.startMinutes - current.position.startMinutes);
              return currDiff < prevDiff ? curr : prev;
            });
            return closest.booking.id;
          }
        }
      }
      
      return null;
    };
  }, [orderedBookings, visibleStaff]);

  // Calcular posición y altura de cada bloqueo
  const getBlockingPosition = (blocking: StaffBlocking) => {
    const startsAt = new Date(blocking.start_at);
    const endsAt = new Date(blocking.end_at);
    
    // Convertir a timezone del tenant
    const localStartsAt = toTenantLocalDate(startsAt, timezone);
    const localEndsAt = toTenantLocalDate(endsAt, timezone);
    
    // Verificar que el bloqueo es del día seleccionado
    // selectedDate está en formato "yyyy-MM-dd"
    const [year, month, day] = selectedDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const blockingDate = new Date(localStartsAt);
    const isSameDay = 
      blockingDate.getFullYear() === selectedDateObj.getFullYear() &&
      blockingDate.getMonth() === selectedDateObj.getMonth() &&
      blockingDate.getDate() === selectedDateObj.getDate();
    
    if (!isSameDay) {
      return null;
    }
    
    // Calcular minutos desde medianoche
    const startMinutesFromMidnight = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
    const endMinutesFromMidnight = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();
    
    // Calcular minutos relativos al inicio del día visible (startMinutes calculado dinámicamente)
    const relativeStartMinutes = startMinutesFromMidnight - startMinutes;
    const relativeEndMinutes = endMinutesFromMidnight - startMinutes;
    const duration = relativeEndMinutes - relativeStartMinutes;
    
    // Posición en píxeles usando constantes centralizadas
    // Cada slot de 15 minutos = 60px de altura
    const slotIndex = Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES);
    const top = Math.max(0, slotIndex * SLOT_HEIGHT_PX);
    const height = Math.max(MIN_BOOKING_HEIGHT_PX, Math.ceil(duration / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX);
    
    return { top, height, startMinutes: startMinutesFromMidnight, endMinutes: endMinutesFromMidnight };
  };

  // Calcular gaps libres para cada staff (solo cuando showFreeSlots está activo)
  const freeSlotsByStaff = useMemo(() => {
    if (!showFreeSlots) return new Map<string, Array<{ startMinutes: number; endMinutes: number; duration: number }>>();
    
    const gapsMap = new Map<string, Array<{ startMinutes: number; endMinutes: number; duration: number }>>();
    const MIN_GAP_DURATION = 30; // Mínimo 30 minutos para mostrar un gap destacado

    visibleStaff.forEach((staff) => {
      const gaps: Array<{ startMinutes: number; endMinutes: number; duration: number }> = [];
      
      // Obtener horario del staff para este día
      const schedule = staffSchedules.find(s => s.staff_id === staff.id);
      const dayStartMinutes = schedule 
        ? (parseInt(schedule.start_time.split(":")[0]) * 60 + parseInt(schedule.start_time.split(":")[1]))
        : startMinutes;
      const dayEndMinutes = schedule
        ? (parseInt(schedule.end_time.split(":")[0]) * 60 + parseInt(schedule.end_time.split(":")[1]))
        : endHour * 60;

      // Obtener bookings y bloqueos del staff
      const staffBookings = bookingsByStaff.get(staff.id) || [];
      const staffBlockingsList = blockingsByStaff.get(staff.id) || [];

      // Combinar bookings y bloqueos y ordenar por hora de inicio
      const allOccupied: Array<{ startMinutes: number; endMinutes: number }> = [];
      
      staffBookings.forEach(booking => {
        const pos = getBookingPosition(booking);
        if (pos) {
          allOccupied.push({ startMinutes: pos.startMinutes, endMinutes: pos.endMinutes });
        }
      });
      
      staffBlockingsList.forEach(blocking => {
        const pos = getBlockingPosition(blocking);
        if (pos) {
          allOccupied.push({ startMinutes: pos.startMinutes, endMinutes: pos.endMinutes });
        }
      });

      // Ordenar por hora de inicio
      allOccupied.sort((a, b) => a.startMinutes - b.startMinutes);

      // Gap desde inicio del día hasta primer booking/bloqueo
      if (allOccupied.length === 0) {
        // Todo el día está libre
        const duration = dayEndMinutes - dayStartMinutes;
        if (duration >= MIN_GAP_DURATION) {
          gaps.push({
            startMinutes: dayStartMinutes,
            endMinutes: dayEndMinutes,
            duration,
          });
        }
      } else {
        // Gap inicial
        const firstOccupied = allOccupied[0];
        if (firstOccupied.startMinutes > dayStartMinutes) {
          const duration = firstOccupied.startMinutes - dayStartMinutes;
          if (duration >= MIN_GAP_DURATION) {
            gaps.push({
              startMinutes: dayStartMinutes,
              endMinutes: firstOccupied.startMinutes,
              duration,
            });
          }
        }

        // Gaps entre bookings/bloqueos
        for (let i = 0; i < allOccupied.length - 1; i++) {
          const current = allOccupied[i];
          const next = allOccupied[i + 1];
          const gapStart = current.endMinutes;
          const gapEnd = next.startMinutes;
          const duration = gapEnd - gapStart;
          
          if (duration >= MIN_GAP_DURATION) {
            gaps.push({
              startMinutes: gapStart,
              endMinutes: gapEnd,
              duration,
            });
          }
        }

        // Gap desde último booking/bloqueo hasta fin del día
        const lastOccupied = allOccupied[allOccupied.length - 1];
        if (lastOccupied.endMinutes < dayEndMinutes) {
          const duration = dayEndMinutes - lastOccupied.endMinutes;
          if (duration >= MIN_GAP_DURATION) {
            gaps.push({
              startMinutes: lastOccupied.endMinutes,
              endMinutes: dayEndMinutes,
              duration,
            });
          }
        }
      }

      gapsMap.set(staff.id, gaps);
    });

    return gapsMap;
  }, [showFreeSlots, visibleStaff, staffSchedules, bookingsByStaff, blockingsByStaff, startMinutes, endHour]);

  // Detectar si hay un booking o bloqueo en una posición específica
  const hasBookingAtPosition = (staffId: string, timeSlot: string, startMinutes: number) => {
    const staffBookings = bookingsByStaff.get(staffId) || [];
    const hasBooking = staffBookings.some((booking) => {
      // Excluir el booking que se está arrastrando
      if (draggingBooking && booking.id === draggingBooking.bookingId) {
        return false;
      }
      const { startMinutes: bookingStart, endMinutes: bookingEnd } = getBookingPosition(booking);
      return startMinutes >= bookingStart && startMinutes < bookingEnd;
    });
    
    // También verificar bloqueos
    const staffBlockings = blockingsByStaff.get(staffId) || [];
    const hasBlocking = staffBlockings.some((blocking) => {
      const pos = getBlockingPosition(blocking);
      if (!pos) return false;
      return startMinutes >= pos.startMinutes && startMinutes < pos.endMinutes;
    });
    
    return hasBooking || hasBlocking;
  };

  // Convertir posición Y a minutos desde medianoche (redondeado a slots de 15 min)
  const pixelsToMinutes = (pixels: number): number => {
    // Validar que pixels sea un número válido
    if (typeof pixels !== "number" || isNaN(pixels) || !isFinite(pixels)) {
      return startMinutes; // Devolver hora de inicio calculada
    }
    // Usar constantes centralizadas: cada SLOT_HEIGHT_PX = SLOT_DURATION_MINUTES
    // Usar Math.round para redondear al slot más cercano (0, 15, 30, 45)
    const slots = Math.round(Math.max(0, pixels) / SLOT_HEIGHT_PX);
    const relativeMinutes = slots * SLOT_DURATION_MINUTES; // Minutos relativos al inicio del día visible
    // Sumar el offset de inicio para obtener minutos desde medianoche
    return startMinutes + relativeMinutes;
  };

  // Convertir minutos a formato HH:mm
  const minutesToTime = (minutes: number): string => {
    // Validar que minutes sea un número válido
    if (typeof minutes !== "number" || isNaN(minutes) || !isFinite(minutes)) {
      return "09:00"; // Hora por defecto
    }
    
    // Asegurar que esté en el rango válido (0-1439 minutos = 0-23:59)
    const clampedMinutes = Math.max(0, Math.min(1439, Math.floor(minutes)));
    const hours = Math.floor(clampedMinutes / 60);
    const mins = clampedMinutes % 60;
    
    // Validar que hours y mins sean números válidos
    if (isNaN(hours) || isNaN(mins)) {
      return "09:00"; // Hora por defecto
    }
    
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  // Obtener staffId desde el elemento más cercano con data-staff-id
  const getStaffIdFromElement = (element: HTMLElement | null): string | null => {
    if (!element) return null;
    const staffColumn = element.closest('[data-staff-id]');
    if (staffColumn) {
      return staffColumn.getAttribute('data-staff-id');
    }
    return null;
  };

  // Handler para iniciar el drag
  const handleBookingMouseDown = (
    e: React.MouseEvent,
    booking: Booking,
    top: number
  ) => {
    // Solo permitir drag con botón izquierdo
    if (e.button !== 0) return;
    
    // Prevenir el comportamiento por defecto para evitar selección de texto
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar si el booking está protegido (paid/completed) - no permitir drag en estos casos
    if (booking.status === "paid" || booking.status === "completed") {
      return;
    }

    // Obtener la columna del staff usando la referencia correcta
    if (!booking.staff_id) {
      console.warn("El booking no tiene staff_id asignado");
      return;
    }
    
    const staffColumnElement = staffColumnsRefs.current.get(booking.staff_id);
    if (!staffColumnElement) {
      console.warn("No se encontró la columna de staff para el drag:", booking.staff_id);
      return;
    }

    // Obtener el elemento booking
    const bookingElement = e.currentTarget as HTMLElement;
    const bookingRect = bookingElement.getBoundingClientRect();
    const columnRect = staffColumnElement.getBoundingClientRect();
    const columnScrollTop = staffColumnElement.scrollTop;
    
    // Calcular la posición del click relativa a la columna (considerando scroll)
    const clickYInColumn = e.clientY - columnRect.top + columnScrollTop;
    
    // Calcular el offset del click relativo al top del booking dentro de la columna
    // Esto nos permite mantener la posición relativa del click mientras arrastramos
    const dragOffsetY = clickYInColumn - top;
    
    const dragOffset = {
      x: e.clientX - bookingRect.left,
      y: dragOffsetY,
    };

    const dragState = {
      bookingId: booking.id,
      originalStaffId: booking.staff_id || "",
      originalTop: top,
      dragOffset,
      currentTop: top,
      currentStaffId: booking.staff_id || "",
    };

    setDraggingBooking(dragState);
    draggingRef.current = dragState;

    // Añadir listeners globales
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentDrag = draggingRef.current;
      if (!currentDrag) return;

      const timelineElement = timelineRef.current;
      if (!timelineElement) return;

      try {
        // Obtener staffId desde el elemento bajo el mouse primero
        const elementUnderMouse = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement;
        const newStaffId = getStaffIdFromElement(elementUnderMouse) || currentDrag.originalStaffId;
        
        // Obtener la columna del staff usando la referencia correcta (preferir la nueva si cambió)
        let staffColumnElement: HTMLElement | null = staffColumnsRefs.current.get(newStaffId) || null;
        
        // Si no encontramos la columna del nuevo staff, usar la columna original
        if (!staffColumnElement) {
          staffColumnElement = staffColumnsRefs.current.get(currentDrag.originalStaffId) || null;
          if (!staffColumnElement) {
            console.warn("No se encontró la columna de staff");
            return;
          }
        }
        
        const staffColumnRect = staffColumnElement.getBoundingClientRect();
        const actualScrollTop = staffColumnElement.scrollTop;
        
        // Validar que los valores sean números válidos
        if (
          typeof moveEvent.clientY !== "number" || isNaN(moveEvent.clientY) ||
          typeof staffColumnRect.top !== "number" || isNaN(staffColumnRect.top) ||
          typeof currentDrag.dragOffset.y !== "number" || isNaN(currentDrag.dragOffset.y) ||
          typeof actualScrollTop !== "number" || isNaN(actualScrollTop)
        ) {
          console.error("Valores inválidos en handleMouseMove:", {
            clientY: moveEvent.clientY,
            top: staffColumnRect.top,
            dragOffsetY: currentDrag.dragOffset.y,
            scrollTop: actualScrollTop,
          });
          return;
        }

        // Calcular posición relativa dentro de la columna de staff
        // El dragOffset.y es relativo al elemento booking dentro de su contenedor
        // Necesitamos calcular la posición del mouse relativa a la columna y ajustar por el offset del click
        const mouseYRelativeToColumn = moveEvent.clientY - staffColumnRect.top + actualScrollTop;
        const relativeY = mouseYRelativeToColumn - currentDrag.dragOffset.y;

        // Validar que relativeY sea válido
        if (typeof relativeY !== "number" || isNaN(relativeY) || !isFinite(relativeY)) {
          console.error("relativeY inválido:", relativeY);
          return;
        }

        // Snap a slots de 15 minutos (60px) para precisión durante el arrastre
        const slotIndex = Math.round(relativeY / SLOT_HEIGHT_PX);
        const snappedY = slotIndex * SLOT_HEIGHT_PX;

        // Calcular nuevo top (limitado al área del timeline)
        const timelineHeight = staffColumnElement.scrollHeight;
        const maxY = Math.max(0, timelineHeight - SLOT_HEIGHT_PX);
        const clampedY = Math.max(0, Math.min(snappedY, maxY));
        
        // Validar que clampedY sea válido
        if (typeof clampedY !== "number" || isNaN(clampedY) || !isFinite(clampedY)) {
          console.error("clampedY inválido:", clampedY);
          return;
        }

        const updatedDrag = {
          ...currentDrag,
          currentTop: clampedY,
          currentStaffId: newStaffId,
        };
        
        setDraggingBooking(updatedDrag);
        draggingRef.current = updatedDrag;
      } catch (error) {
        console.error("Error en handleMouseMove:", error);
        // No hacer nada, solo loguear el error
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const currentDrag = draggingRef.current;
      if (!currentDrag) {
        // Si no hay drag activo, limpiar listeners
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        return;
      }

      // Verificar si realmente se movió (más de 5px) o fue solo un click
      const movedDistance = Math.abs(currentDrag.currentTop - currentDrag.originalTop);
      const wasActualDrag = movedDistance > 5;

      try {
        // Si no fue un drag real, limpiar inmediatamente para permitir onClick
        if (!wasActualDrag) {
          setDraggingBooking(null);
          draggingRef.current = null;
          // NO marcar justFinishedDragRef porque no hubo movimiento real
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }
        
        // Solo marcar justFinishedDragRef si realmente hubo movimiento
        justFinishedDragRef.current = true;
        setTimeout(() => {
          justFinishedDragRef.current = false;
        }, 100);

        // Validar que currentTop sea un número válido
        if (typeof currentDrag.currentTop !== "number" || isNaN(currentDrag.currentTop) || !isFinite(currentDrag.currentTop)) {
          console.error("currentTop inválido:", currentDrag.currentTop);
          setDraggingBooking(null);
          draggingRef.current = null;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        // Validar que currentStaffId sea válido
        if (!currentDrag.currentStaffId) {
          console.error("currentStaffId inválido:", currentDrag.currentStaffId);
          setDraggingBooking(null);
          draggingRef.current = null;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        // Calcular nueva hora basada en la posición final
        const newMinutes = pixelsToMinutes(currentDrag.currentTop);
        const newTime = minutesToTime(newMinutes);

        // Validar que newTime sea válido
        if (!newTime || !newTime.match(/^\d{2}:\d{2}$/)) {
          console.error("newTime inválido:", newTime);
          setDraggingBooking(null);
          draggingRef.current = null;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        // Calcular duración original del booking
        const bookingToMove = bookings.find((b) => b.id === currentDrag.bookingId);
        if (bookingToMove && onBookingMove) {
          const originalStart = new Date(bookingToMove.starts_at);
          const originalEnd = new Date(bookingToMove.ends_at);
          
          // Validar que las fechas sean válidas
          if (isNaN(originalStart.getTime()) || isNaN(originalEnd.getTime())) {
            console.error("Fechas originales inválidas:", { originalStart, originalEnd });
            setDraggingBooking(null);
            draggingRef.current = null;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            return;
          }

          const durationMs = originalEnd.getTime() - originalStart.getTime();
          const durationMinutes = durationMs / (1000 * 60);

          // Validar que durationMinutes sea válido
          if (isNaN(durationMinutes) || !isFinite(durationMinutes) || durationMinutes <= 0) {
            console.error("durationMinutes inválido:", durationMinutes);
            setDraggingBooking(null);
            draggingRef.current = null;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            return;
          }

          // Calcular nueva hora de fin
          const newEndMinutes = newMinutes + durationMinutes;
          const newEndTime = minutesToTime(Math.floor(newEndMinutes));

          // Validar que newEndTime sea válido
          if (!newEndTime || !newEndTime.match(/^\d{2}:\d{2}$/)) {
            console.error("newEndTime inválido:", newEndTime);
            setDraggingBooking(null);
            draggingRef.current = null;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            return;
          }

          // Construir fechas completas usando la fecha seleccionada y las horas calculadas
          const [startHour, startMinute] = newTime.split(":").map(Number);
          const [endHour, endMinute] = newEndTime.split(":").map(Number);
          
          // Crear fechas en la timezone del tenant
          // selectedDate está en formato "yyyy-MM-dd", necesitamos crear un Date object correctamente
          const [year, month, day] = selectedDate.split("-").map(Number);
          const selectedDateObj = new Date(year, month - 1, day);
          const newStartsAt = new Date(selectedDateObj);
          newStartsAt.setHours(startHour, startMinute, 0, 0);
          
          const newEndsAt = new Date(selectedDateObj);
          newEndsAt.setHours(endHour, endMinute, 0, 0);
          
          // Si la hora de fin es menor que la de inicio, significa que pasó a otro día
          if (newEndsAt <= newStartsAt) {
            newEndsAt.setDate(newEndsAt.getDate() + 1);
          }

          // Validar que las fechas sean válidas
          if (isNaN(newStartsAt.getTime()) || isNaN(newEndsAt.getTime())) {
            console.error("Fechas construidas inválidas:", { newStartsAt, newEndsAt });
            setDraggingBooking(null);
            draggingRef.current = null;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            return;
          }

          // Mostrar modal de confirmación en lugar de mover directamente
          setMoveConfirmModal({
            isOpen: true,
            booking: bookingToMove,
            newStartTime: newStartsAt.toISOString(),
            newEndTime: newEndsAt.toISOString(),
            newStaffId: currentDrag.currentStaffId,
          });
        }
      } catch (error) {
        console.error("Error en handleMouseUp:", error);
        alert("Error al mover la cita. Por favor, intenta de nuevo.");
      } finally {
        // Solo limpiar si realmente hubo un drag (ya se marcó justFinishedDragRef arriba si hubo movimiento)
        setDraggingBooking(null);
        draggingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handler para iniciar el redimensionamiento
  const handleBookingResizeStart = (
    e: React.MouseEvent,
    booking: Booking,
    height: number,
    top: number,
    resizeType: "start" | "end"
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Obtener la columna del staff donde está el booking
    if (!booking.staff_id) {
      console.warn("El booking no tiene staff_id asignado");
      return;
    }
    
    const staffColumnElement = staffColumnsRefs.current.get(booking.staff_id);
    if (!staffColumnElement) {
      console.warn("No se encontró la columna del staff para el booking:", booking.staff_id);
      return;
    }

    // Guardar la posición original del booking para cálculos
    const originalTop = top;
    const originalBottom = top + height;

    const resizeState = {
      bookingId: booking.id,
      staffId: booking.staff_id,
      originalHeight: height,
      originalTop: top,
      resizeType,
      currentHeight: height,
    };

    setResizingBooking(resizeState);
    resizingRef.current = resizeState;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentResize = resizingRef.current;
      if (!currentResize) return;

      const currentStaffColumn = staffColumnsRefs.current.get(currentResize.staffId);
      if (!currentStaffColumn) return;

      // Calcular posición relativa a la columna del staff (considerando scroll)
      const columnRect = currentStaffColumn.getBoundingClientRect();
      const scrollTop = currentStaffColumn.scrollTop;
      const mouseYRelative = moveEvent.clientY - columnRect.top + scrollTop;

      if (currentResize.resizeType === "end") {
        // Redimensionar desde el final (borde inferior)
        // Redondear a slots de 15 minutos (60px) para precisión
        const slotIndex = Math.round(mouseYRelative / SLOT_HEIGHT_PX);
        const snappedY = slotIndex * SLOT_HEIGHT_PX;
        const newBottom = Math.max(originalTop + SLOT_HEIGHT_PX, snappedY); // Mínimo 1 slot (15 min)
        const newHeight = newBottom - originalTop;
        
        const updatedResize = {
          ...currentResize,
          currentHeight: newHeight,
        };
        setResizingBooking(updatedResize);
        resizingRef.current = updatedResize;
      } else {
        // Redimensionar desde el inicio (borde superior)
        // Redondear a slots de 15 minutos (60px) para precisión
        const slotIndex = Math.round(mouseYRelative / SLOT_HEIGHT_PX);
        const snappedY = slotIndex * SLOT_HEIGHT_PX;
        const newTop = Math.min(originalBottom - SLOT_HEIGHT_PX, snappedY); // Mínimo 1 slot (15 min)
        const newHeight = originalBottom - newTop;
        
        const updatedResize = {
          ...currentResize,
          currentHeight: newHeight,
        };
        setResizingBooking(updatedResize);
        resizingRef.current = updatedResize;
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const currentResize = resizingRef.current;
      if (!currentResize) return;

      const bookingToResize = bookings.find((b) => b.id === currentResize.bookingId);
      if (bookingToResize && onBookingResize) {
        let newStartTime: string;
        let newEndTime: string;

        // Obtener la posición del booking original para calcular tiempos
        const { startMinutes: originalStartMinutesFromMidnight, endMinutes: originalEndMinutesFromMidnight } = getBookingPosition(bookingToResize);
        
        if (currentResize.resizeType === "end") {
          // Solo cambia el tiempo de fin
          // La altura actual está en píxeles, convertirla a minutos usando las constantes
          const slots = Math.round(currentResize.currentHeight / SLOT_HEIGHT_PX);
          const newDurationMinutes = slots * SLOT_DURATION_MINUTES;
          
          newStartTime = minutesToTime(originalStartMinutesFromMidnight);
          const newEndMinutes = originalStartMinutesFromMidnight + newDurationMinutes;
          newEndTime = minutesToTime(newEndMinutes);
        } else {
          // Cambia el tiempo de inicio
          // La altura actual está en píxeles, convertirla a minutos usando las constantes
          const slots = Math.round(currentResize.currentHeight / SLOT_HEIGHT_PX);
          const newDurationMinutes = slots * SLOT_DURATION_MINUTES;
          const newStartMinutesFromMidnight = originalEndMinutesFromMidnight - newDurationMinutes;
          
          // Asegurar que no se vaya antes del inicio del día visible
          const clampedStartMinutes = Math.max(startMinutes, newStartMinutesFromMidnight);
          newStartTime = minutesToTime(clampedStartMinutes);
          newEndTime = minutesToTime(originalEndMinutesFromMidnight);
        }

        // Construir fechas completas usando la fecha seleccionada y las horas calculadas
        const [startHour, startMinute] = newStartTime.split(":").map(Number);
        const [endHour, endMinute] = newEndTime.split(":").map(Number);
        
        // Crear fechas en la timezone del tenant
        // selectedDate está en formato "yyyy-MM-dd", necesitamos crear un Date object correctamente
        const [year, month, day] = selectedDate.split("-").map(Number);
        const selectedDateObj = new Date(year, month - 1, day);
        const newStartsAt = new Date(selectedDateObj);
        newStartsAt.setHours(startHour, startMinute, 0, 0);
        
        const newEndsAt = new Date(selectedDateObj);
        newEndsAt.setHours(endHour, endMinute, 0, 0);
        
        // Si la hora de fin es menor que la de inicio, significa que pasó a otro día
        if (newEndsAt <= newStartsAt) {
          newEndsAt.setDate(newEndsAt.getDate() + 1);
        }

        // Validar que las fechas sean válidas
        if (isNaN(newStartsAt.getTime()) || isNaN(newEndsAt.getTime())) {
          console.error("Fechas construidas inválidas en resize:", { newStartsAt, newEndsAt });
          setResizingBooking(null);
          resizingRef.current = null;
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          return;
        }

        // Mostrar modal de confirmación en lugar de redimensionar directamente
        setResizeConfirmModal({
          isOpen: true,
          booking: bookingToResize,
          newStartTime: newStartsAt.toISOString(),
          newEndTime: newEndsAt.toISOString(),
        });
      }

      // Verificar si realmente hubo un resize significativo antes de marcar el flag
      const finalResize = resizingRef.current;
      const wasActualResize = finalResize && 
        Math.abs((finalResize.currentHeight || 0) - (finalResize.originalHeight || 0)) > 5;
      
      setResizingBooking(null);
      resizingRef.current = null;
      
      // Solo marcar justFinishedResizeRef si realmente hubo movimiento
      if (wasActualResize) {
        justFinishedResizeRef.current = true;
        setTimeout(() => {
          justFinishedResizeRef.current = false;
        }, 100);
      }
      
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Manejar clic en slot de tiempo
  const handleSlotClick = (
    e: React.MouseEvent,
    staffId: string,
    timeSlot: string
  ) => {
    // No hacer nada si se hace clic en un booking
    if ((e.target as HTMLElement).closest('[data-booking]')) {
      return;
    }

    // Calcular minutos desde medianoche
    const [hour, minute] = timeSlot.split(":").map(Number);
    const startMinutesFromMidnight = hour * 60 + minute;

    // Verificar si hay booking en esta posición (usando minutos desde medianoche para la comparación)
    if (hasBookingAtPosition(staffId, timeSlot, startMinutesFromMidnight)) {
      return;
    }

    // Obtener posición del clic
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    const slot: CalendarSlot = {
      staffId,
      time: timeSlot,
      date: selectedDate,
      endTime: minutesToTime(startMinutesFromMidnight + DEFAULT_SLOT_DURATION_MINUTES),
    };

    setPopoverState({
      isOpen: true,
      position: { x, y },
      slot,
    });

    // Llamar callback si existe
    onSlotClick?.(slot);
  };

  // Calcular altura total del timeline basada en horas disponibles (adaptativo)
  const timelineHeight = useMemo(() => {
    // Calcular minutos totales desde startHour hasta endHour
    const startMinutesTotal = startHour * 60;
    const endMinutesTotal = endHour * 60;
    const totalMinutes = endMinutesTotal - startMinutesTotal;
    const totalSlots = Math.ceil(totalMinutes / SLOT_DURATION_MINUTES);
    return totalSlots * SLOT_HEIGHT_PX; // Usar constantes centralizadas
  }, [startHour, endHour]);
  
  // Verificar si estamos en el día de hoy
  const isToday = useMemo(() => {
    const today = new Date();
    const selectedDateObj = new Date(selectedDate + "T00:00:00");
    return (
      selectedDateObj.getFullYear() === today.getFullYear() &&
      selectedDateObj.getMonth() === today.getMonth() &&
      selectedDateObj.getDate() === today.getDate()
    );
  }, [selectedDate]);
  
  // Calcular minutos actuales del día (para línea roja)
  const currentMinutes = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Si la hora actual está fuera del rango visible, retornar null
    if (totalMinutes < startMinutes || totalMinutes > (endHour * 60 + 60)) {
      return null;
    }
    
    // Calcular posición relativa al inicio del timeline
    const relativeMinutes = totalMinutes - startMinutes;
    return relativeMinutes;
  }, [isToday, startMinutes, endHour]);

  // Línea de "ahora" para vista de día
  const nowLineTop = useMemo(() => {
    const now = new Date();
    const [y, m, d] = selectedDate.split("-").map(Number);
    const isSameDay = now.getFullYear() === y && (now.getMonth()+1) === m && now.getDate() === d;
    if (!isSameDay) return null;
    const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
    const relativeMinutes = minutesFromMidnight - startMinutes;
    if (relativeMinutes < 0) return 0;
    // Usar constantes centralizadas: cada SLOT_DURATION_MINUTES = SLOT_HEIGHT_PX
    return (relativeMinutes / SLOT_DURATION_MINUTES) * SLOT_HEIGHT_PX;
  }, [selectedDate, startMinutes]);

  if (visibleStaff.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-500">No hay staff seleccionado</p>
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#15171A]">
      <div 
        ref={timelineRef}
        className="relative flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
      >
        <div className="flex h-full" style={{ minWidth: `${visibleStaff.length * 300}px` }}>
          {/* Columna de horas - Premium */}
          <div className="w-24 border-r border-white/5 bg-[#15171A] sticky left-0 z-10 flex flex-col h-full">
            {/* Header vacío para alineación con columnas de staff */}
            <div className="sticky top-0 z-20 bg-[#15171A] border-b border-white/5 px-4 py-4 backdrop-blur-md flex items-center flex-shrink-0" style={{ height: "72px" }}>
              <div className="text-[10px] font-semibold text-[#9ca3af] uppercase font-['Plus_Jakarta_Sans'] tracking-wider">Hora</div>
            </div>
            
            {/* Área de slots de tiempo - Premium */}
            <div 
              ref={timeColumnRef}
              className="relative flex-1 overflow-y-auto scrollbar-hide bg-[#15171A]" 
              style={{ 
                height: `calc(100% - 72px)`
              }}
            >
              {timeSlots.map((time, index) => {
                const [hour, minute] = time.split(":").map(Number);
                const isHour = minute === 0;
                
                return (
                  <div
                    key={time}
                    className={`
                      absolute left-0 right-0
                      flex items-start justify-end pr-3 pt-1
                      ${isHour ? "border-t border-white/5" : "border-t border-dashed border-white/3"}
                    `}
                    style={{ 
                      top: `${index * 60}px`, 
                      height: "60px",
                      width: "100%",
                      left: 0,
                      right: 0,
                      pointerEvents: "none"
                    }}
                  >
                    {isHour && (
                      <span className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] font-mono">
                        {time}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columnas de staff - Premium */}
          {visibleStaff.map((staff, staffIndex) => {
            const staffBookings = bookingsByStaff.get(staff.id) || [];
            const staffBlockingsList = blockingsByStaff.get(staff.id) || [];
            
            return (
              <motion.div
                key={staff.id}
                data-staff-id={staff.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: staffIndex * 0.05, duration: 0.2, ease: "easeOut" }}
                className="flex-1 min-w-[300px] border-r border-white/5 last:border-r-0 relative bg-[#15171A]"
              >
                {/* Header del staff - Premium glassmorphism */}
                <div className="sticky top-0 z-20 bg-[#15171A] border-b border-white/5 px-5 py-4 backdrop-blur-md flex-shrink-0" style={{ height: "72px" }}>
                  <div className="flex items-center gap-3 h-full">
                    <motion.div 
                      className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold text-white shadow-[0px_2px_8px_rgba(0,0,0,0.15)]"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.15 }}
                    >
                      {staff.name.charAt(0).toUpperCase()}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm font-['Plus_Jakarta_Sans'] tracking-tight">{staff.name}</div>
                      <div className="text-xs text-[#9ca3af] font-medium mt-0.5 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#4FE3C1]" />
                        {(() => {
                          const schedule = staffSchedules.find(s => s.staff_id === staff.id);
                          return schedule ? `${schedule.start_time} - ${schedule.end_time}` : "09:00 - 19:00";
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Área de bookings - Premium */}
                <div 
                  ref={(el) => {
                    if (el) {
                      staffColumnsRefs.current.set(staff.id, el);
                    } else {
                      staffColumnsRefs.current.delete(staff.id);
                    }
                  }}
                  data-staff-column={staff.id}
                  className="relative flex-1 overflow-y-auto scrollbar-hide bg-[#15171A]" 
                  style={{ 
                    height: `calc(100% - 72px)`
                  }}
                >
                  {/* Línea para hora actual (solo si es hoy) - Premium moderna */}
                  {currentMinutes !== null && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none"
                      style={{
                        top: `${(currentMinutes / 15) * 60}px`,
                        height: "2px",
                      }}
                    >
                      <div className="absolute left-0 top-0 w-full h-full bg-gradient-to-r from-[#EF4444] via-[#FF6DA3] to-[#EF4444] shadow-[0px_0px_8px_rgba(239,68,68,0.4)]" />
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#EF4444] rounded-full -translate-x-1.5 border-2 border-[#15171A] shadow-[0px_0px_12px_rgba(239,68,68,0.6)]" />
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-[#EF4444]/90 backdrop-blur-sm rounded-[6px] text-[10px] font-semibold text-white font-['Plus_Jakarta_Sans']">
                        Ahora
                      </div>
                    </div>
                  )}

                  {/* Slots de tiempo clickeables - Premium */}
                  {timeSlots.map((time, index) => {
                    const isHour = time.endsWith(":00");
                    const [hour, minute] = time.split(":").map(Number);
                    const startMinutes = hour * 60 + minute;
                    const hasBooking = hasBookingAtPosition(staff.id, time, startMinutes);

                    return (
                      <div
                        key={time}
                        onClick={(e) => handleSlotClick(e, staff.id, time)}
                        className={`
                          absolute left-0 right-0 cursor-pointer
                          ${isHour ? "border-t border-white/5" : "border-t border-dashed border-white/3"}
                          ${!hasBooking ? "hover:bg-white/3 transition-colors duration-150" : ""}
                        `}
                        style={{ top: `${index * 60}px`, height: "60px" }}
                        data-time-slot={time}
                      />
                    );
                  })}

                  {/* Free slots overlay (solo cuando showFreeSlots está activo) */}
                  {showFreeSlots && freeSlotsByStaff.get(staff.id)?.map((gap, gapIndex) => {
                    const relativeStartMinutes = gap.startMinutes - startMinutes;
                    const relativeEndMinutes = gap.endMinutes - startMinutes;
                    // Usar constantes centralizadas para cálculos de posición
                    const slotIndexStart = Math.round(relativeStartMinutes / SLOT_DURATION_MINUTES);
                    const slotIndexEnd = Math.round(relativeEndMinutes / SLOT_DURATION_MINUTES);
                    const top = Math.max(0, slotIndexStart * SLOT_HEIGHT_PX);
                    const height = Math.max(MIN_BOOKING_HEIGHT_PX, (slotIndexEnd - slotIndexStart) * SLOT_HEIGHT_PX);
                    const durationHours = Math.floor(gap.duration / 60);
                    const durationMins = gap.duration % 60;
                    const durationLabel = durationHours > 0 
                      ? `${durationHours}h ${durationMins > 0 ? durationMins + "m" : ""}`.trim()
                      : `${durationMins}m`;

                    return (
                      <motion.div
                        key={`free-slot-${gapIndex}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: gapIndex * 0.05 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const gapStartTime = minutesToTime(gap.startMinutes);
                          const gapEndTime = minutesToTime(gap.endMinutes);
                    onNewBooking?.({
                      staffId: staff.id,
                      time: gapStartTime,
                      endTime: gapEndTime,
                      date: selectedDate,
                    });
                        }}
                        className="absolute left-3 right-3 rounded-[10px] border-2 border-dashed border-[#4FE3C1]/40 bg-[rgba(79,227,193,0.08)] hover:bg-[rgba(79,227,193,0.12)] hover:border-[#4FE3C1]/60 cursor-pointer transition-all duration-150 z-0 group"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          minHeight: "60px",
                        }}
                        title={`Hueco libre: ${minutesToTime(gap.startMinutes)} - ${minutesToTime(gap.endMinutes)} (${durationLabel})`}
                      >
                        <div className="flex items-center justify-center h-full p-2">
                          <div className="text-center">
                            <div className="text-xs font-semibold text-[#4FE3C1] font-['Plus_Jakarta_Sans'] mb-0.5">
                              Libre {durationLabel}
                            </div>
                            <div className="text-[10px] text-[#4FE3C1]/70 font-mono font-['Plus_Jakarta_Sans']">
                              {minutesToTime(gap.startMinutes)} - {minutesToTime(gap.endMinutes)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Bloqueos/Ausencias (mostrar detrás de bookings) - Menos intrusivos */}
                  {staffBlockingsList.map((blocking) => {
                    const pos = getBlockingPosition(blocking);
                    if (!pos) return null;
                    
                    const { top, height } = pos;
                    
                    // Estilos según tipo
                    const typeLabels = {
                      block: "Bloqueo",
                      absence: "Ausencia",
                      vacation: "Vacaciones",
                    };
                    
                    // Convertir fechas a timezone local antes de formatear
                    const startAt = new Date(blocking.start_at);
                    const endAt = new Date(blocking.end_at);
                    const localStartAt = new Date(
                      startAt.toLocaleString("en-US", { timeZone: timezone })
                    );
                    const localEndAt = new Date(
                      endAt.toLocaleString("en-US", { timeZone: timezone })
                    );
                    
                    return (
                      <div
                        key={blocking.id}
                        data-blocking
                        className={`
                          absolute left-3 right-3 rounded-[10px] border-l-[3px] p-2
                          ${blockingColors[blocking.type] || blockingColors.block}
                          z-5
                        `}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 40)}px`,
                          minHeight: "40px",
                        }}
                        title={blocking.reason || typeLabels[blocking.type]}
                      >
                        <div className="flex items-start justify-between h-full opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-mono font-semibold">
                                {format(localStartAt, "HH:mm")}{" "}
                                -{" "}
                                {format(localEndAt, "HH:mm")}
                              </span>
                            </div>
                            <div className="text-[10px] font-medium truncate">
                              {blocking.reason || typeLabels[blocking.type]}
                            </div>
                            {blocking.notes && (
                              <div className="text-[10px] opacity-60 truncate mt-0.5">
                                {blocking.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Bookings (mostrar encima de bloqueos) */}
                  {staffBookings.map((booking, bookingIndex) => {
                    const { top, height, startMinutes, endMinutes } = getBookingPosition(booking);
                    
                    // Si este booking se está arrastrando, usar la posición del drag
                    const isDragging = draggingBooking?.bookingId === booking.id;
                    const isResizing = resizingBooking?.bookingId === booking.id;
                    
                    let displayTop = isDragging ? draggingBooking.currentTop : top;
                    let displayHeight = isResizing ? resizingBooking.currentHeight : height;
                    const displayStaffId = isDragging ? draggingBooking.currentStaffId : booking.staff_id;
                    
                    // Si se está redimensionando desde el inicio, ajustar el top
                    if (isResizing && resizingBooking.resizeType === "start") {
                      const originalBottom = top + height;
                      displayTop = originalBottom - displayHeight;
                    }
                    
                    // Determinar en qué columnas mostrar el booking
                    const isOriginalColumn = booking.staff_id === staff.id;
                    const isTargetColumn = isDragging && displayStaffId === staff.id;
                    
                    // Mostrar booking: siempre en su columna original, o en la columna destino si se está arrastrando
                    const showInThisColumn = isOriginalColumn || isTargetColumn;
                    
                    // Si se está arrastrando y estamos en la columna original (pero no es el destino), mostrar ghost
                    const isGhost = isDragging && isOriginalColumn && !isTargetColumn;
                    
                    // Convertir fechas a timezone local antes de formatear
                    const startsAt = new Date(booking.starts_at);
                    const endsAt = new Date(booking.ends_at);
                    const localStartsAt = new Date(
                      startsAt.toLocaleString("en-US", { timeZone: timezone })
                    );
                    const localEndsAt = new Date(
                      endsAt.toLocaleString("en-US", { timeZone: timezone })
                    );
                    
                    // Verificar si la cita ya pasó (para decolorarla)
                    const now = new Date();
                    const isPast = localEndsAt < now;
                    
                    // Calcular precios
                    const totalPrice = booking.service?.price_cents || 0;
                    const paidAmount = booking.status === "paid" || booking.status === "completed" 
                      ? totalPrice 
                      : 0;
                    
                    if (!showInThisColumn) return null;
                    
                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ 
                          duration: 0.15, 
                          delay: bookingIndex * 0.02,
                          ease: "easeOut" 
                        }}
                        whileHover={!isDragging ? { 
                          y: -2, 
                          scale: 1.01,
                          boxShadow: "0px 4px 20px rgba(58,109,255,0.25), inset 0px 1px 0px rgba(255,255,255,0.1)"
                        } : {}}
                        data-booking
                        tabIndex={0}
                        role="button"
                        aria-label={`Cita de ${booking.customer?.name || "cliente"} de ${format(localStartsAt, "HH:mm")} a ${format(localEndsAt, "HH:mm")}`}
                        ref={(el) => {
                          if (el) {
                            bookingRefs.current.set(booking.id, el);
                          } else {
                            bookingRefs.current.delete(booking.id);
                          }
                        }}
                        onFocus={() => setFocusedBookingId(booking.id)}
                        onBlur={() => {
                          // Solo limpiar focus si no estamos moviendo el focus a otro booking
                          setTimeout(() => {
                            if (document.activeElement && !bookingRefs.current.has(booking.id)) {
                              setFocusedBookingId(null);
                            }
                          }, 0);
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                          // Verificar si el usuario está escribiendo en un input
                          const target = e.target as HTMLElement;
                          const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
                          if (isInput) return;
                          
                          // Manejar Enter/Space para abrir detalles
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onBookingClick?.(booking);
                            return;
                          }
                          
                          // Manejar flechas para navegar entre bookings
                          if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const direction = e.key === "ArrowUp" ? "up" 
                              : e.key === "ArrowDown" ? "down"
                              : e.key === "ArrowLeft" ? "left"
                              : "right";
                            
                            const nextBookingId = findNextBooking(booking.id, direction);
                            if (nextBookingId) {
                              const nextBookingRef = bookingRefs.current.get(nextBookingId);
                              if (nextBookingRef) {
                                nextBookingRef.focus();
                                // Scroll para hacer visible el booking enfocado
                                nextBookingRef.scrollIntoView({ behavior: "smooth", block: "nearest" });
                              }
                            }
                            return;
                          }
                        }}
                        onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
                          // Si se hace clic en un handle de resize, no iniciar drag
                          if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
                            return;
                          }
                          if (!onBookingMove) return; // Solo permitir drag si hay callback
                          
                          // Prevenir el onClick si vamos a hacer drag
                          e.stopPropagation();
                          handleBookingMouseDown(e, booking, top);
                        }}
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                          // Verificar si realmente hubo un drag o resize significativo
                          // Solo bloquear onClick si el movimiento fue mayor a 5px
                          const wasDragged = draggingRef.current && 
                            Math.abs((draggingRef.current.currentTop || 0) - (draggingRef.current.originalTop || 0)) > 5;
                          const wasResized = resizingRef.current && 
                            Math.abs((resizingRef.current.currentHeight || 0) - (resizingRef.current.originalHeight || 0)) > 5;
                          
                          // Si se hizo drag o resize significativo, no ejecutar onClick
                          if (wasDragged || wasResized) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          
                          // Si acabamos de terminar un drag o resize, no ejecutar onClick
                          // Los flags solo se setean si realmente hubo movimiento
                          if (justFinishedDragRef.current || justFinishedResizeRef.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          
                          // Si hay un drag/resize activo PERO no hubo movimiento significativo, limpiar y permitir onClick
                          // Esto maneja el caso donde onMouseDown inicializó el drag pero no hubo movimiento
                          if (draggingRef.current || resizingRef.current) {
                            // Limpiar estados si no hubo movimiento real
                            draggingRef.current = null;
                            setDraggingBooking(null);
                            resizingRef.current = null;
                            setResizingBooking(null);
                            // Continuar con el onClick normalmente
                          }
                          
                          e.stopPropagation();
                          
                          // Obtener posición del clic para el popover
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const x = e.clientX;
                          const y = e.clientY;
                          
                          // Si hay handlers de acciones, mostrar popover; sino, usar callback normal
                          if (onBookingEdit || onBookingCancel || onBookingSendMessage || onBookingStatusChange) {
                            setBookingActionPopover({
                              isOpen: true,
                              position: { x, y },
                              booking,
                            });
                          } else {
                            onBookingClick?.(booking);
                          }
                        }}
                        className={`
                          absolute left-3 right-3 rounded-xl border relative transition-all duration-150
                          hover:z-20
                          focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/50 focus:ring-offset-2 focus:ring-offset-[#15171A] focus:z-30
                          ${statusColors[booking.status] || statusColors.pending}
                          ${isGhost ? "opacity-30 border-dashed" : ""}
                          ${isPast && !isDragging ? "opacity-50 grayscale-[0.2]" : ""}
                          ${isDragging && !isGhost ? "cursor-grabbing opacity-85 z-50" : isDragging ? "" : "cursor-grab z-10"}
                          ${focusedBookingId === booking.id ? "ring-2 ring-[#3A6DFF]/50 ring-offset-2 ring-offset-[#15171A]" : ""}
                          backdrop-blur-md group
                          ${displayHeight >= 80 ? "p-3" : displayHeight >= 64 ? "p-2.5" : "p-2"}
                        `}
                        style={{
                          borderRadius: "14px",
                          top: `${displayTop}px`,
                          height: `${Math.max(displayHeight, 48)}px`,
                          minHeight: "48px",
                          boxShadow: isDragging && !isGhost 
                            ? "0px 8px 32px rgba(58, 109, 255, 0.4)" 
                            : "0px 2px 8px rgba(0,0,0,0.25), inset 0px 1px 0px rgba(255,255,255,0.08)",
                        }}
                        title={`${booking.customer?.name || "Sin cliente"} - ${booking.service?.name || "Sin servicio"} (${format(localStartsAt, "HH:mm")} - ${format(localEndsAt, "HH:mm")})`}
                      >
                        {/* Handles para redimensionar (solo si hay callback) - Premium */}
                        {onBookingResize && !isDragging && (
                          <>
                            {/* Handle superior */}
                            <div
                              data-resize-handle="top"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleBookingResizeStart(e, booking, height, top, "start");
                              }}
                              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[#3A6DFF]/30 z-20 rounded-t-xl transition-colors duration-150"
                              title="Redimensionar desde el inicio"
                            />
                            {/* Handle inferior */}
                            <div
                              data-resize-handle="bottom"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleBookingResizeStart(e, booking, height, top, "end");
                              }}
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[#3A6DFF]/30 z-20 rounded-b-xl transition-colors duration-150"
                              title="Redimensionar duración"
                            />
                          </>
                        )}
                        {/* Contenedor principal con layout flexible y responsive */}
                        <div className="flex flex-col h-full min-h-0 overflow-hidden">
                          {/* Header: Horario y Estado (siempre visible, compacto) */}
                          <div className="flex items-center justify-between gap-2 flex-shrink-0 mb-0.5">
                            <span className="text-[10px] font-mono font-semibold text-white/80 font-['Plus_Jakarta_Sans'] leading-tight whitespace-nowrap">
                              {format(localStartsAt, "HH:mm")} – {format(localEndsAt, "HH:mm")}
                            </span>
                            {/* Estado compacto - solo visible si hay espacio mínimo */}
                            {displayHeight >= 64 && (
                              <StatusBadge status={booking.status} size="xs" />
                            )}
                          </div>

                          {/* Contenido principal: Cliente y Servicio (flexible, se adapta al espacio) */}
                          <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
                            {/* Nombre del cliente - siempre visible, tamaño adaptativo según altura */}
                            <div 
                              className={`font-semibold text-white truncate font-['Plus_Jakarta_Sans'] tracking-tight ${
                                displayHeight >= 80 ? "text-sm leading-snug" : displayHeight >= 64 ? "text-xs leading-snug" : "text-[11px] leading-snug"
                              }`}
                              title={booking.customer?.name || "Sin cliente"}
                            >
                              {booking.customer?.name || "Sin cliente"}
                            </div>
                            
                            {/* Servicio - solo visible si hay espacio suficiente (≥64px) */}
                            {displayHeight >= 64 && (
                              <div 
                                className="text-[11px] text-white/70 truncate font-['Plus_Jakarta_Sans'] leading-tight mt-0.5"
                                title={booking.service?.name || "Sin servicio"}
                              >
                                {booking.service?.name || "Sin servicio"}
                              </div>
                            )}
                          </div>

                          {/* Footer: Precios (solo si hay espacio suficiente ≥80px y hay precios) */}
                          {displayHeight >= 80 && (paidAmount > 0 || totalPrice > 0) && (
                            <div className="flex items-center justify-end gap-1.5 flex-shrink-0 mt-auto pt-1.5 border-t border-white/5">
                              {paidAmount > 0 && (
                                <span className="text-[#4FE3C1] font-semibold text-[11px] font-['Plus_Jakarta_Sans'] leading-tight whitespace-nowrap">
                                  {(paidAmount / 100).toFixed(2)}€
                                </span>
                              )}
                              {totalPrice > 0 && (
                                <span className={`font-medium text-[11px] font-['Plus_Jakarta_Sans'] leading-tight whitespace-nowrap ${
                                  paidAmount > 0 ? "text-white/60" : "text-white/70"
                                }`}>
                                  {(totalPrice / 100).toFixed(2)}€
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Línea de ahora - Premium (ya renderizada dentro de cada columna) */}

      {/* Popover de acciones para slots vacíos */}
      {popoverState.isOpen && popoverState.slot && (
        <AgendaActionPopover
          isOpen={popoverState.isOpen}
          position={popoverState.position}
          onClose={() => setPopoverState({ isOpen: false, position: { x: 0, y: 0 }, slot: null })}
          onNewBooking={() => {
            if (popoverState.slot) {
              onNewBooking?.(popoverState.slot);
            }
            setPopoverState({ isOpen: false, position: { x: 0, y: 0 }, slot: null });
          }}
          onUnavailability={() => {
            if (popoverState.slot) {
              onUnavailability?.({ ...popoverState.slot, type: "block" });
            }
            setPopoverState({ isOpen: false, position: { x: 0, y: 0 }, slot: null });
          }}
          onAbsence={() => {
            if (popoverState.slot) {
              onAbsence?.({ ...popoverState.slot, type: "absence" });
            }
            setPopoverState({ isOpen: false, position: { x: 0, y: 0 }, slot: null });
          }}
        />
      )}

      {/* Popover de acciones para bookings */}
      {bookingActionPopover.isOpen && bookingActionPopover.booking && (
        <BookingActionPopover
          isOpen={bookingActionPopover.isOpen}
          position={bookingActionPopover.position}
          onClose={() => setBookingActionPopover({ isOpen: false, position: { x: 0, y: 0 }, booking: null })}
          onEdit={() => {
            if (bookingActionPopover.booking) {
              onBookingEdit?.(bookingActionPopover.booking);
            }
            setBookingActionPopover({ isOpen: false, position: { x: 0, y: 0 }, booking: null });
          }}
          onCancel={() => {
            if (bookingActionPopover.booking) {
              onBookingCancel?.(bookingActionPopover.booking.id);
            }
            setBookingActionPopover({ isOpen: false, position: { x: 0, y: 0 }, booking: null });
          }}
          onSendMessage={() => {
            if (bookingActionPopover.booking) {
              onBookingSendMessage?.(bookingActionPopover.booking);
            }
            setBookingActionPopover({ isOpen: false, position: { x: 0, y: 0 }, booking: null });
          }}
          onStatusChange={(newStatus) => {
            if (bookingActionPopover.booking) {
              onBookingStatusChange?.(bookingActionPopover.booking.id, newStatus);
            }
            setBookingActionPopover({ isOpen: false, position: { x: 0, y: 0 }, booking: null });
          }}
          currentStatus={bookingActionPopover.booking?.status}
          canCancel={canCancel}
        />
      )}

      {/* Modal de confirmación para mover citas */}
      {moveConfirmModal.isOpen && moveConfirmModal.booking && (
        <BookingMoveConfirmModal
          isOpen={moveConfirmModal.isOpen}
          onClose={() => setMoveConfirmModal({ isOpen: false, booking: null, newStartTime: "", newEndTime: "", newStaffId: "" })}
          onConfirm={() => {
            if (moveConfirmModal.booking && onBookingMove) {
              onBookingMove(
                moveConfirmModal.booking.id,
                moveConfirmModal.newStaffId,
                moveConfirmModal.newStartTime,
                moveConfirmModal.newEndTime
              );
            }
            setMoveConfirmModal({ isOpen: false, booking: null, newStartTime: "", newEndTime: "", newStaffId: "" });
          }}
          booking={moveConfirmModal.booking}
          newStartTime={moveConfirmModal.newStartTime}
          newEndTime={moveConfirmModal.newEndTime}
        />
      )}

      {/* Modal de confirmación para redimensionar citas */}
      {resizeConfirmModal.isOpen && resizeConfirmModal.booking && (
        <BookingResizeConfirmModal
          isOpen={resizeConfirmModal.isOpen}
          onClose={() => setResizeConfirmModal({ isOpen: false, booking: null, newStartTime: "", newEndTime: "" })}
          onConfirm={() => {
            if (resizeConfirmModal.booking && onBookingResize) {
              onBookingResize(
                resizeConfirmModal.booking.id,
                resizeConfirmModal.newStartTime,
                resizeConfirmModal.newEndTime
              );
            }
            setResizeConfirmModal({ isOpen: false, booking: null, newStartTime: "", newEndTime: "" });
          }}
          booking={resizeConfirmModal.booking}
          newStartTime={resizeConfirmModal.newStartTime}
          newEndTime={resizeConfirmModal.newEndTime}
        />
      )}
    </div>
  );
}

