"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { endOfDay, startOfDay, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Booking, Staff } from "@/types/agenda";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { AgendaStats } from "@/components/agenda/AgendaStats";
import { AgendaContent } from "@/components/agenda/AgendaContent";
import { HeightAwareContainer, useHeightAware } from "@/components/panel/HeightAwareContainer";

/**
 * AgendaContainer - Orquestador principal premium
 * Maneja toda la lógica de estado, suscripciones y coordinación de componentes
 */
export function AgendaContainer() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();

  // Estados principales
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "list">("day");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de UI
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  const heightAware = useHeightAware();
  const { density: rawDensity } = heightAware;
  const density = rawDensity === "normal" ? "default" : rawDensity;

  // Formateadores memoizados
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: tenantTimezone,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [tenantTimezone]
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: tenantTimezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [tenantTimezone]
  );

  // Cargar tenant y staff inicial
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const impersonateOrgId = searchParams?.get("impersonate");
        const { tenant } = await getCurrentTenant(impersonateOrgId);

        if (!tenant) {
          setError("No tienes acceso a ninguna barbería");
          setLoading(false);
          return;
        }

        setTenantId(tenant.id);
        setTenantTimezone(tenant.timezone);

        // Cargar staff del tenant
        const { data: staffData } = await supabase
          .from("staff")
          .select("id, name, active")
          .eq("tenant_id", tenant.id)
          .eq("active", true)
          .order("name");

        if (staffData) {
          setStaffList(staffData as Staff[]);
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
        setLoading(false);
      }
    };

    loadTenant();
  }, [supabase, searchParams]);

  // Cargar bookings optimizado con memoización
  const loadBookings = useCallback(async () => {
    if (!tenantId || !selectedDate) return;

    try {
      setLoading(true);
      const from = startOfDay(selectedDate).toISOString();
      const to = endOfDay(selectedDate).toISOString();

      let query = supabase
        .from("bookings")
        .select(`
          *,
          customer:customers(id, name, email, phone),
          service:services(id, name, duration_min, price_cents),
          staff:staff(id, name)
        `)
        .eq("tenant_id", tenantId)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at", { ascending: true });

      if (selectedStaffId) {
        query = query.eq("staff_id", selectedStaffId);
      }

      const { data, error: bookingsError } = await query;

      if (bookingsError) {
        throw new Error(bookingsError.message);
      }

      setBookings((data as Booking[]) || []);
    } catch (err: any) {
      setError(err?.message || "Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  }, [supabase, tenantId, selectedDate, selectedStaffId]);

  // Suscripción optimizada
  useEffect(() => {
    if (!tenantId || !selectedDate) return;

    loadBookings();

    const channel = supabase
      .channel("rt-bookings-optimized")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `tenant_id=eq.${tenantId}&starts_at=gte.${startOfDay(selectedDate).toISOString()}&starts_at=lt.${endOfDay(selectedDate).toISOString()}`,
        },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, selectedDate, loadBookings]);

  // Callbacks optimizados
  const handleDateChange = useCallback((dateStr: string) => {
    setSelectedDate(parseISO(dateStr));
  }, []);

  const handleBookingClick = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
  }, []);

  const handleNewBooking = useCallback(() => {
    setNewBookingOpen(true);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedDate(new Date());
    setSelectedStaffId(null);
    setSearchTerm("");
  }, []);

  // Handlers para drag & drop premium
  const handleBookingDrag = useCallback(async (bookingId: string, newTime: string, newStaffId?: string) => {
    try {
      console.log('🎯 Booking drag operation:', { bookingId, newTime, newStaffId });

      // TODO: Implementar actualización en base de datos
      // const { error } = await supabase
      //   .from('bookings')
      //   .update({ starts_at: newTime, staff_id: newStaffId })
      //   .eq('id', bookingId);

      // Por ahora, recargar para mostrar cambios
      await loadBookings();

      // TODO: Mostrar toast de éxito
      // showToast('Cita movida correctamente', 'success');

    } catch (error) {
      console.error('❌ Error updating booking position:', error);
      // TODO: Mostrar toast de error
      // showToast('Error al mover la cita', 'error');
    }
  }, [loadBookings]);

  const handleBookingResize = useCallback(async (bookingId: string, newEndTime: string) => {
    try {
      console.log('📏 Booking resize operation:', { bookingId, newEndTime });

      // TODO: Implementar lógica de resize
      // const { error } = await supabase
      //   .from('bookings')
      //   .update({ ends_at: newEndTime })
      //   .eq('id', bookingId);

      await loadBookings();

      // TODO: Mostrar toast de éxito

    } catch (error) {
      console.error('❌ Error updating booking duration:', error);
      // TODO: Mostrar toast de error
    }
  }, [loadBookings]);

  // Filtros aplicados actualmente
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedStaffId) {
      const staff = staffList.find((s) => s.id === selectedStaffId);
      if (staff) {
        filters.push({
          id: "staff",
          label: `Staff: ${staff.name}`,
          onRemove: () => setSelectedStaffId(null),
        });
      }
    }
    return filters;
  }, [selectedStaffId, staffList]);

  // Estadísticas rápidas memoizadas
  const quickStats = useMemo(() => {
    if (!bookings.length) return undefined;

    const totalAmount = bookings.reduce((sum, b) => sum + (b.service?.price_cents || 0), 0);
    const totalMinutes = bookings.reduce((sum, b) => sum + (b.service?.duration_min || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    return {
      totalBookings: bookings.length,
      totalHours,
      totalAmount,
      rangeLabel: viewMode === "day" ? dateFormatter.format(selectedDate!) : undefined
    };
  }, [bookings, viewMode, dateFormatter, selectedDate]);

  // Utilización de staff memoizada
  const staffUtilization = useMemo(() => {
    if (!bookings.length || !staffList.length) return [];

    return staffList.map(staff => {
      const staffBookings = bookings.filter(b => b.staff_id === staff.id);
      const staffMinutes = staffBookings.reduce((sum, b) => sum + (b.service?.duration_min || 0), 0);
      const totalWorkMinutes = 8 * 60; // 8 horas jornada
      const utilization = Math.round((staffMinutes / totalWorkMinutes) * 100);

      return {
        staffId: staff.id,
        staffName: staff.name,
        utilization: Math.min(100, utilization)
      };
    });
  }, [bookings, staffList]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <HeightAwareContainer className="h-full">
      <div className="h-full flex flex-col min-h-0 overflow-hidden bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
        {/* Filtros inteligentes */}
        <AgendaFilters
          staffList={staffList}
          selectedStaffId={selectedStaffId}
          onStaffChange={setSelectedStaffId}
          searchOpen={searchOpen}
          searchTerm={searchTerm}
          onSearchToggle={() => setSearchOpen(!searchOpen)}
          onSearchChange={setSearchTerm}
          onSearchClose={() => setSearchOpen(false)}
          activeFilters={activeFilters}
          onResetFilters={handleResetFilters}
          density={density}
        />

        {/* Estadísticas premium */}
        {quickStats && (
          <AgendaStats
            stats={quickStats}
            staffUtilization={staffUtilization}
            density={density}
          />
        )}

        {/* Contenido principal */}
        <AgendaContent
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDate={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
          onDateChange={handleDateChange}
          bookings={bookings}
          staffList={staffList}
          loading={loading}
          error={error}
          tenantTimezone={tenantTimezone}
          onBookingClick={handleBookingClick}
          onNewBooking={handleNewBooking}
          density={density}
          timeFormatter={timeFormatter}
          heightAware={heightAware}
          // Props premium para interactividad
          onBookingDrag={handleBookingDrag}
          onBookingResize={handleBookingResize}
          enableDragDrop={true}
          showConflicts={true}
        />
      </div>
    </HeightAwareContainer>
  );
}
