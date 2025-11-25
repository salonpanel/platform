"use client";

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameWeek, isSameMonth } from 'date-fns';
import { SupabaseClient } from '@supabase/supabase-js';
import { Booking, Staff, StaffBlocking, StaffSchedule, ViewMode } from '@/types/agenda';
import { toTenantLocalDate } from '@/lib/timezone';
import { calculateStaffUtilization } from '@/lib/agenda-insights';

interface UseAgendaDataProps {
  tenantId: string | null;
  supabase: SupabaseClient;
  selectedDate: string;
  viewMode: ViewMode;
  timezone: string;
  userRole: string | null;
}

interface AgendaFilters {
  payment: string[];
  status: string[];
  staff: string[];
  services: string[]; // NUEVO
  highlighted: boolean | null;
}

export function useAgendaData({
  tenantId,
  supabase,
  selectedDate,
  viewMode,
  timezone,
  userRole,
}: UseAgendaDataProps) {
  // Estado base
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffBlockings, setStaffBlockings] = useState<StaffBlocking[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string; duration_min: number; price_cents: number; buffer_min: number }>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null; notes?: string | null }>>([]);

  // Estado de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filters, setFilters] = useState<AgendaFilters>(() => {
    const defaultFilters: AgendaFilters = {
      payment: [],
      status: [],
      staff: [],
      services: [],
      highlighted: null,
    };
    
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_filters");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Ensure all required fields exist with proper defaults
          return {
            payment: Array.isArray(parsed.payment) ? parsed.payment : [],
            status: Array.isArray(parsed.status) ? parsed.status : [],
            staff: Array.isArray(parsed.staff) ? parsed.staff : [],
            services: Array.isArray(parsed.services) ? parsed.services : [],
            highlighted: parsed.highlighted === true || parsed.highlighted === false ? parsed.highlighted : null,
          };
        } catch {
          // Si hay error, usar valores por defecto
        }
      }
    }
    return defaultFilters;
  });

  // OPTIMIZACIÓN: Cargar datos críticos primero (staff) para mostrar UI rápidamente
  useEffect(() => {
    const loadCriticalData = async () => {
      if (!tenantId) return;
      
      try {
        // Paso 1: Cargar SOLO staff (datos mínimos para mostrar UI)
        const staffResult = await supabase
          .from("staff")
          .select("id, name, active")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name");

        if (staffResult.data) {
          setStaffList(staffResult.data);
          // Marcar como "parcialmente cargado" - podemos mostrar UI
          setLoading(false);
        }

        // Paso 2: Cargar servicios en segundo plano (no bloquea UI)
        supabase
          .from("services")
          .select("id, name, duration_min, price_cents, buffer_min")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name")
          .then((servicesResult) => {
            if (servicesResult.data) {
              setServices(servicesResult.data.map(s => ({ ...s, buffer_min: s.buffer_min ?? 0 })));
            }
          });

        // Paso 3: NO cargar todos los customers inicialmente
        // Solo se cargarán cuando se necesiten (en modales)
        setCustomers([]);

      } catch (err) {
        console.error("Error al cargar datos iniciales:", err);
        setError("Error al cargar los datos");
        setLoading(false);
      }
    };

    loadCriticalData();
  }, [tenantId, supabase]);

  // OPTIMIZACIÓN: Cargar bookings de forma progresiva
  useEffect(() => {
    const loadBookingsAndBlockings = async () => {
      if (!tenantId || !staffList.length) return; // Esperar a tener staff

      try {
        const start = startOfDay(parseISO(selectedDate));
        const end = endOfDay(parseISO(selectedDate));

        // Paso 1: Cargar SOLO bookings primero (lo más importante)
        const bookingsResult = await supabase
          .from("bookings")
          .select(`
            *,
            customer:customers(id, name, email, phone),
            service:services(id, name, duration_min, price_cents),
            staff:staff(id, name)
          `)
          .eq("tenant_id", tenantId)
          .gte("starts_at", start.toISOString())
          .lte("starts_at", end.toISOString())
          .order("starts_at");

        if (bookingsResult.data) {
          setBookings(bookingsResult.data);
        }

        // Paso 2: Cargar blockings y schedules en paralelo (menos crítico)
        Promise.all([
          supabase
            .from("staff_blockings")
            .select("*")
            .eq("tenant_id", tenantId)
            .gte("start_at", start.toISOString())
            .lte("end_at", end.toISOString())
            .order("start_at"),
          supabase
            .from("staff_schedules")
            .select("staff_id, start_time, end_time")
            .eq("tenant_id", tenantId)
            .eq("is_active", true),
        ]).then(([blockingsResult, schedulesResult]) => {
          if (blockingsResult.data) setStaffBlockings(blockingsResult.data);
          if (schedulesResult.data) setStaffSchedules(schedulesResult.data);
        });

      } catch (err) {
        console.error("Error al cargar bookings:", err);
        setError("Error al cargar las reservas");
      }
    };

    loadBookingsAndBlockings();
  }, [tenantId, selectedDate, supabase, staffList.length]);

  // Debounce del término de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filtrar bookings por búsqueda y filtros aplicados - MEJORADO
  const filteredBookings = useMemo(() => {
    let result = [...bookings];
    
    // BÚSQUEDA MEJORADA: Cliente, servicio, staff, teléfono, email
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase().trim();
      result = result.filter((booking) => {
        const customerName = booking.customer?.name?.toLowerCase() || "";
        const customerPhone = booking.customer?.phone?.toLowerCase() || "";
        const customerEmail = booking.customer?.email?.toLowerCase() || "";
        const serviceName = booking.service?.name?.toLowerCase() || "";
        const staffName = booking.staff?.name?.toLowerCase() || "";
        const internalNotes = booking.internal_notes?.toLowerCase() || "";
        const clientMessage = booking.client_message?.toLowerCase() || "";
        
        return (
          customerName.includes(term) ||
          customerPhone.includes(term) ||
          customerEmail.includes(term) ||
          serviceName.includes(term) ||
          staffName.includes(term) ||
          internalNotes.includes(term) ||
          clientMessage.includes(term)
        );
      });
    }
    
    // Aplicar filtros de estado de pago
    if (filters.payment.length > 0) {
      result = result.filter((booking) => {
        const isPaid = booking.status === "paid";
        const isUnpaid = booking.status !== "paid";
        
        if (filters.payment.includes("paid") && isPaid) {
          return true;
        }
        if (filters.payment.includes("unpaid") && isUnpaid) {
          return true;
        }
        return false;
      });
    }
    
    // Aplicar filtros de estado de reserva
    if (filters.status.length > 0) {
      result = result.filter((booking) => {
        return filters.status.includes(booking.status);
      });
    }
    
    // Aplicar filtro de staff
    if (filters.staff.length > 0 && !filters.staff.includes("all")) {
      result = result.filter((booking) => {
        return booking.staff_id && filters.staff.includes(booking.staff_id);
      });
    }
    
    // NUEVO: Aplicar filtro de servicios
    if (filters.services.length > 0) {
      result = result.filter((booking) => {
        return booking.service_id && filters.services.includes(booking.service_id);
      });
    }
    
    // Aplicar filtro de destacados
    if (filters.highlighted !== null) {
      result = result.filter((booking) => {
        return booking.is_highlighted === filters.highlighted;
      });
    }
    
    return result;
  }, [bookings, debouncedSearchTerm, filters]);

  // Helper para obtener bookings en el rango actual
  const getBookingsInCurrentRange = useMemo(() => {
    return (bookings: Booking[], selectedDate: string, viewMode: ViewMode, timezone: string): Booking[] => {
      const selectedDateObj = parseISO(selectedDate);

      const filterByRange = (rangeStart: Date, rangeEnd: Date) => {
        return bookings.filter((booking) => {
          const bookingDate = toTenantLocalDate(new Date(booking.starts_at), timezone);
          return bookingDate >= rangeStart && bookingDate <= rangeEnd;
        });
      };

      switch (viewMode) {
        case "day": {
          const dayStart = startOfDay(selectedDateObj);
          const dayEnd = endOfDay(selectedDateObj);
          return filterByRange(dayStart, dayEnd);
        }
        case "week": {
          const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });
          return filterByRange(weekStart, weekEnd);
        }
        case "month": {
          const monthStart = startOfMonth(selectedDateObj);
          const monthEnd = endOfMonth(selectedDateObj);
          return filterByRange(monthStart, monthEnd);
        }
        case "list": {
          const dayStart = startOfDay(selectedDateObj);
          const dayEnd = endOfDay(selectedDateObj);
          return filterByRange(dayStart, dayEnd);
        }
        default:
          return bookings;
      }
    };
  }, []);

  // Quick stats range-aware
  const quickStats = useMemo(() => {
    const rangeBookings = getBookingsInCurrentRange(bookings, selectedDate, viewMode, timezone);
    const statsBookings = searchTerm.trim() 
      ? rangeBookings.filter((b) => {
          const term = searchTerm.toLowerCase();
          return (
            b.customer?.name?.toLowerCase().includes(term) ||
            b.customer?.phone?.toLowerCase().includes(term) ||
            b.customer?.email?.toLowerCase().includes(term) ||
            b.service?.name?.toLowerCase().includes(term) ||
            b.internal_notes?.toLowerCase().includes(term) ||
            b.client_message?.toLowerCase().includes(term)
          );
        })
      : rangeBookings;
    
    const totalBookings = statsBookings.length;
    const totalMinutes = statsBookings.reduce((acc, b) => {
      const start = new Date(b.starts_at);
      const end = new Date(b.ends_at);
      return acc + Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }, 0);
    const totalAmount = statsBookings.reduce((acc, b) => {
      return acc + (b.service?.price_cents || 0);
    }, 0);

    // Calcular label del rango
    const selectedDateObj = parseISO(selectedDate);
    const tenantToday = startOfDay(toTenantLocalDate(new Date(), timezone));
    let rangeLabel = "";
    switch (viewMode) {
      case "day": {
        const selectedDay = startOfDay(selectedDateObj);
        const isToday = selectedDay.getTime() === tenantToday.getTime();
        rangeLabel = isToday ? "Hoy" : format(selectedDateObj, "d 'de' MMMM");
        break;
      }
      case "week": {
        const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });
        const isCurrentWeek = isSameWeek(selectedDateObj, tenantToday, { weekStartsOn: 1 });
        const prefix = isCurrentWeek ? "Esta semana" : "Semana";
        rangeLabel = `${prefix} (${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM")})`;
        break;
      }
      case "month": {
        const isCurrentMonth = isSameMonth(selectedDateObj, tenantToday);
        const monthLabel = format(selectedDateObj, "MMMM yyyy");
        rangeLabel = isCurrentMonth ? `Este mes (${monthLabel})` : monthLabel;
        break;
      }
      case "list":
        rangeLabel = format(selectedDateObj, "d 'de' MMMM");
        break;
    }

    return {
      totalBookings,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalAmount,
      rangeLabel,
    };
  }, [bookings, selectedDate, viewMode, timezone, searchTerm, getBookingsInCurrentRange]);

  // Calcular utilización por staff
  const staffUtilization = useMemo(() => {
    if (!(userRole === "owner" || userRole === "admin" || userRole === "manager")) {
      return [];
    }
    
    return calculateStaffUtilization({
      bookings,
      staffList,
      staffSchedules,
      selectedDate,
      viewMode,
      timezone,
    });
  }, [bookings, staffList, staffSchedules, selectedDate, viewMode, timezone, userRole]);

  // Calcular número de filtros activos - ACTUALIZADO
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.payment.length > 0) count += filters.payment.length;
    if (filters.status.length > 0) count += filters.status.length;
    if (filters.staff.length > 0 && !filters.staff.includes("all")) count += filters.staff.length;
    if (filters.services.length > 0) count += filters.services.length; // NUEVO
    if (filters.highlighted !== null) count += 1;
    return count;
  }, [filters]);

  // Filtrar staff visible según filtros
  const visibleStaff = useMemo(() => {
    if (filters.staff.length === 0 || filters.staff.includes("all")) {
      return staffList;
    }
    return staffList.filter((staff) => filters.staff.includes(staff.id));
  }, [staffList, filters.staff]);

  // Guardar filtros en localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agenda_filters", JSON.stringify(filters));
    }
  }, [filters]);

  // Función para refrescar datos
  const refreshDaySnapshots = async (targetDate?: string) => {
    if (!tenantId) return;
    
    const dateToRefresh = targetDate || selectedDate;
    const start = startOfDay(parseISO(dateToRefresh));
    const end = endOfDay(parseISO(dateToRefresh));

    const [bookingsResult, blockingsResult] = await Promise.all([
      supabase
        .from("bookings")
        .select(`
          *,
          customer:customers(id, name, email, phone),
          service:services(id, name, duration_min, price_cents),
          staff:staff(id, name)
        `)
        .eq("tenant_id", tenantId)
        .gte("starts_at", start.toISOString())
        .lte("starts_at", end.toISOString())
        .order("starts_at"),
      supabase
        .from("staff_blockings")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("start_at", start.toISOString())
        .lte("end_at", end.toISOString())
        .order("start_at"),
    ]);

    if (bookingsResult.data) setBookings(bookingsResult.data);
    if (blockingsResult.data) setStaffBlockings(blockingsResult.data);
  };

  return {
    // Estado
    loading,
    setLoading,
    error,
    setError,
    staffList,
    setStaffList,
    bookings,
    setBookings,
    staffBlockings,
    setStaffBlockings,
    staffSchedules,
    setStaffSchedules,
    services,
    setServices,
    customers,
    setCustomers,
    // Búsqueda y filtros
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    activeFiltersCount,
    // Datos filtrados
    filteredBookings,
    visibleStaff,
    // Stats
    quickStats,
    staffUtilization,
    // Funciones
    refreshDaySnapshots,
  };
}
