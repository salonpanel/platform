"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfDay, startOfDay, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AgendaTimeline } from "@/components/panel/AgendaTimeline";
import { AgendaCalendarView } from "@/components/panel/AgendaCalendarView";
import { AgendaDayStrip } from "@/components/panel/AgendaDayStrip";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  tenant_id: string;
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

type Staff = {
  id: string;
  name: string;
  active: boolean;
};

type Service = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function AgendaPage() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(["all"]);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "timeline">("calendar");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para el modal de nueva cita
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newBookingForm, setNewBookingForm] = useState({
    customer_id: "",
    service_id: "",
    staff_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: format(new Date(), "HH:mm"),
    status: "paid" as "paid" | "pending" | "hold",
  });
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Formateador de tiempo usando timezone del tenant
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

  // Cargar tenant y staff
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const impersonateOrgId = searchParams?.get("impersonate");
        const { tenant, role } = await getCurrentTenant(impersonateOrgId);

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

        // Cargar servicios activos
        const { data: servicesData } = await supabase
          .from("services")
          .select("id, name, duration_min, price_cents, active")
          .eq("tenant_id", tenant.id)
          .eq("active", true)
          .order("name");

        if (servicesData) {
          setServices(servicesData as Service[]);
        }

        // Cargar clientes
        const { data: customersData } = await supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("tenant_id", tenant.id)
          .order("name");

        if (customersData) {
          setCustomers(customersData as Customer[]);
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
        setLoading(false);
      }
    };

    loadTenant();
  }, [supabase, searchParams]);

  // Cargar bookings cuando cambia la fecha o el filtro de staff
  useEffect(() => {
    if (!tenantId) return;

    let mounted = true;
    const loadBookings = async () => {
      try {
        setLoading(true);
        const selectedDateObj = parseISO(selectedDate);
        const from = startOfDay(selectedDateObj).toISOString();
        const to = endOfDay(selectedDateObj).toISOString();

        // Construir query base
        let query = supabase
          .from("bookings")
          .select(
            `
            *,
            customer:customers(id, name, email, phone),
            service:services(id, name, duration_min, price_cents),
            staff:staff(id, name)
          `
          )
          .eq("tenant_id", tenantId)
          .gte("starts_at", from)
          .lt("starts_at", to)
          .order("starts_at", { ascending: true });

        // Aplicar filtro de staff si está seleccionado
        if (selectedStaffId && !selectedStaffIds.includes("all")) {
          query = query.eq("staff_id", selectedStaffId);
        } else if (selectedStaffIds.length > 0 && !selectedStaffIds.includes("all")) {
          query = query.in("staff_id", selectedStaffIds);
        }

        const { data, error: bookingsError } = await query;

        if (bookingsError) {
          throw new Error(bookingsError.message);
        }

        if (mounted) {
          setBookings((data as Booking[]) || []);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Error al cargar reservas");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadBookings();

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel("rt-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // Recargar cuando hay cambios
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, selectedDate, selectedStaffId, selectedStaffIds]);

  // Función para abrir el modal de edición
  const handleEditBooking = (booking: Booking) => {
    if (!booking.starts_at || !booking.service_id || !booking.customer_id || !booking.staff_id) {
      setError("No se puede editar esta cita: faltan datos necesarios");
      return;
    }

    const startsAt = new Date(booking.starts_at);
    
    // Convertir a timezone del tenant para mostrar en el formulario
    const localDate = new Date(startsAt.toLocaleString("en-US", { timeZone: tenantTimezone }));
    const dateStr = format(localDate, "yyyy-MM-dd");
    const timeStr = format(localDate, "HH:mm");

    setEditingBooking(booking);
    setNewBookingForm({
      customer_id: booking.customer_id,
      service_id: booking.service_id,
      staff_id: booking.staff_id,
      date: dateStr,
      time: timeStr,
      status: booking.status as "paid" | "pending" | "hold",
    });
    setBookingError(null);
    setShowNewBookingModal(true);
  };

  // Función para crear o actualizar una cita
  const handleCreateBooking = async () => {
    if (!tenantId || !newBookingForm.customer_id || !newBookingForm.service_id || !newBookingForm.staff_id) {
      setBookingError("Por favor completa todos los campos obligatorios");
      return;
    }

    setBookingError(null);
    setSavingBooking(true);

    try {
      // Obtener duración del servicio
      const selectedService = services.find((s) => s.id === newBookingForm.service_id);
      if (!selectedService) {
        throw new Error("Servicio no encontrado");
      }

      // Construir fecha/hora en timezone del tenant
      // El usuario selecciona fecha/hora en el timezone del tenant
      // Necesitamos convertirla a UTC para almacenarla en la BD
      const dateTimeString = `${newBookingForm.date}T${newBookingForm.time}`;
      
      // Crear un objeto Date interpretando la fecha/hora como local
      // Luego ajustamos para que represente la hora correcta en el timezone del tenant
      // Nota: Esta es una aproximación. Para mayor precisión, usar date-fns-tz
      const localDate = new Date(dateTimeString);
      
      // Obtener el offset del timezone del tenant
      // Creamos una fecha de referencia en el timezone del tenant y comparamos con UTC
      const testDate = new Date("2024-01-01T12:00:00");
      const tenantTime = new Date(testDate.toLocaleString("en-US", { timeZone: tenantTimezone }));
      const utcTime = new Date(testDate.toLocaleString("en-US", { timeZone: "UTC" }));
      const offsetMs = tenantTime.getTime() - utcTime.getTime();
      
      // Ajustar el timestamp: si el tenant está adelantado respecto a UTC, restamos el offset
      const startsAt = new Date(localDate.getTime() - offsetMs);
      
      // Calcular ends_at sumando la duración
      const endsAt = new Date(startsAt.getTime() + selectedService.duration_min * 60 * 1000);

      // Verificar disponibilidad usando la función SQL
      // Si estamos editando, verificamos que no haya solapamiento con otras citas
      // (la constraint de BD también lo validará, pero es mejor dar feedback antes)
      const { data: isAvailable, error: availabilityError } = await supabase.rpc(
        "check_staff_availability",
        {
          p_staff_id: newBookingForm.staff_id,
          p_starts_at: startsAt.toISOString(),
          p_ends_at: endsAt.toISOString(),
        }
      );

      if (availabilityError) {
        console.error("Error al verificar disponibilidad:", availabilityError);
        // Continuar de todas formas, la constraint de BD lo evitará
      }

      // Si estamos editando y el horario/staff no cambió, no necesitamos verificar disponibilidad
      // porque es la misma cita. Si cambió, verificamos.
      const hasTimeOrStaffChanged = editingBooking
        ? (editingBooking.staff_id !== newBookingForm.staff_id ||
           new Date(editingBooking.starts_at).getTime() !== startsAt.getTime())
        : true;

      if (hasTimeOrStaffChanged && isAvailable === false) {
        setBookingError("El horario seleccionado ya está ocupado. Por favor elige otro.");
        setSavingBooking(false);
        return;
      }

      if (editingBooking) {
        // Actualizar la cita existente
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .update({
            customer_id: newBookingForm.customer_id,
            staff_id: newBookingForm.staff_id,
            service_id: newBookingForm.service_id,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            status: newBookingForm.status,
          })
          .eq("id", editingBooking.id)
          .select("*")
          .single();

        if (bookingError) {
          // Si es un error de solapamiento, dar mensaje más claro
          if (bookingError.code === "23505" || bookingError.message.includes("overlap")) {
            throw new Error("El horario seleccionado ya está ocupado. Por favor elige otro.");
          }
          throw new Error(bookingError.message || "Error al actualizar la cita");
        }
      } else {
        // Crear nueva cita
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert([
            {
              tenant_id: tenantId,
              customer_id: newBookingForm.customer_id,
              staff_id: newBookingForm.staff_id,
              service_id: newBookingForm.service_id,
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
              status: newBookingForm.status,
            },
          ])
          .select("*")
          .single();

        if (bookingError) {
          // Si es un error de solapamiento, dar mensaje más claro
          if (bookingError.code === "23505" || bookingError.message.includes("overlap")) {
            throw new Error("El horario seleccionado ya está ocupado. Por favor elige otro.");
          }
          throw new Error(bookingError.message || "Error al crear la cita");
        }
      }

      // Cerrar modal y resetear formulario
      setShowNewBookingModal(false);
      setEditingBooking(null);
      setNewBookingForm({
        customer_id: "",
        service_id: "",
        staff_id: "",
        date: selectedDate,
        time: format(new Date(), "HH:mm"),
        status: "paid",
      });

      // Los bookings se recargarán automáticamente por la suscripción en tiempo real
    } catch (err: any) {
      setBookingError(err?.message || "Error al crear la cita");
    } finally {
      setSavingBooking(false);
    }
  };

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <div className="text-red-400">
          <h3 className="mb-2 font-semibold">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  // Navegación de fechas
  const navigateDate = (direction: "prev" | "next" | "today") => {
    const date = parseISO(selectedDate);
    if (direction === "prev") {
      date.setDate(date.getDate() - 1);
    } else if (direction === "next") {
      date.setDate(date.getDate() + 1);
    } else {
      return setSelectedDate(format(new Date(), "yyyy-MM-dd"));
    }
    setSelectedDate(format(date, "yyyy-MM-dd"));
  };

  // Toggle staff selection
  const toggleStaff = (staffId: string) => {
    if (staffId === "all") {
      setSelectedStaffIds(["all"]);
      setSelectedStaffId(null);
    } else {
      setSelectedStaffIds((prev) => {
        const filtered = prev.filter((id) => id !== "all");
        if (filtered.includes(staffId)) {
          const newIds = filtered.filter((id) => id !== staffId);
          return newIds.length === 0 ? ["all"] : newIds;
        } else {
          return [...filtered, staffId];
        }
      });
      setSelectedStaffId(staffId);
    }
  };

  const selectedDateObj = parseISO(selectedDate);
  const formattedDate = dateFormatter.format(selectedDateObj);

  return (
    <div className="space-y-6">
      {/* Header Sticky */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 -mx-6 px-6 py-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* Título y acciones */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Agenda</h1>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                {bookings.length} {bookings.length === 1 ? "reserva" : "reservas"}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white p-1">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`
                    px-3 py-1.5 text-xs font-medium rounded-md transition-all
                    ${
                      viewMode === "calendar"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }
                  `}
                >
                  Calendario
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`
                    px-3 py-1.5 text-xs font-medium rounded-md transition-all
                    ${
                      viewMode === "list"
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }
                  `}
                >
                  Lista
                </button>
              </div>
            </div>
          </div>

          {/* Selector de fecha */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDate("prev")}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => navigateDate("today")}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
            >
              Hoy
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-900 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
            <button
              onClick={() => navigateDate("next")}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
            <div className="ml-4 text-sm text-gray-600">
              {formattedDate}
            </div>
            <div className="ml-auto text-sm text-gray-500">
              9:00 – 19:00
            </div>
          </div>

          {/* Selector de staff (pills) */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => toggleStaff("all")}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all
                ${
                  selectedStaffIds.includes("all")
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
            >
              Todos
            </button>
            {staffList.map((staff) => (
              <button
                key={staff.id}
                onClick={() => toggleStaff(staff.id)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2
                  ${
                    selectedStaffIds.includes(staff.id)
                      ? "bg-[var(--color-accent)] text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }
                `}
              >
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                  {staff.name.charAt(0).toUpperCase()}
                </div>
                {staff.name}
              </button>
            ))}
          </div>

          {/* Strip de días de la semana */}
          <AgendaDayStrip
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            timezone={tenantTimezone}
          />
        </div>
      </div>

      {/* Vista de calendario o lista */}
      {loading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-600">Cargando reservas...</p>
            </div>
          </div>
        </Card>
      ) : viewMode === "calendar" ? (
        bookings.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="No hay reservas para esta fecha"
              description="Prueba a cambiar la fecha o añade tu primera reserva."
            />
            <div className="mt-6 text-center">
              <Button onClick={() => setShowNewBookingModal(true)}>
                + Añadir primera reserva
              </Button>
            </div>
          </Card>
        ) : (
          <AgendaCalendarView
            bookings={bookings}
            staffList={staffList}
            selectedDate={selectedDate}
            selectedStaffIds={selectedStaffIds}
            timezone={tenantTimezone}
            onBookingClick={handleEditBooking}
          />
        )
      ) : viewMode === "list" ? (
        bookings.length === 0 ? (
          <Card className="p-12">
            <EmptyState
              title="No hay reservas para esta fecha"
              description="Prueba a cambiar la fecha o revisa el portal de reservas."
            />
          </Card>
        ) : (
          <>
            {/* Vista Desktop: Tabla */}
            <div className="hidden md:block overflow-x-auto">
              <Card padding="none">
                <table className="w-full">
                  <thead className="border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Servicio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Staff
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {bookings.map((booking) => (
                      <tr
                        key={booking.id}
                        className="hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm font-semibold text-slate-100">
                            {timeFormatter.format(new Date(booking.starts_at))} -{" "}
                            {timeFormatter.format(new Date(booking.ends_at))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-100">
                            {booking.customer?.name || "Sin cliente"}
                          </div>
                          {booking.customer?.email && (
                            <div className="text-xs text-slate-400">
                              {booking.customer.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-100">
                            {booking.service?.name || "Sin servicio"}
                          </div>
                          {booking.service && (
                            <div className="text-xs text-slate-400">
                              {booking.service.duration_min} min ·{" "}
                              {(booking.service.price_cents / 100).toFixed(2)} €
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-300">
                            {booking.staff?.name || "Sin asignar"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={booking.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBooking(booking)}
                            >
                              Editar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            {/* Vista Mobile: Cards */}
            <div className="md:hidden space-y-3">
              {bookings.map((booking) => (
                <Card key={booking.id}>
                  <div className="space-y-3">
                    {/* Header: Hora y Estado */}
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-base font-semibold text-slate-100">
                        {timeFormatter.format(new Date(booking.starts_at))} -{" "}
                        {timeFormatter.format(new Date(booking.ends_at))}
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    {/* Cliente */}
                    {booking.customer && (
                      <div>
                        <div className="text-sm font-medium text-slate-100">
                          {booking.customer.name}
                        </div>
                        {booking.customer.email && (
                          <div className="text-xs text-slate-400">
                            {booking.customer.email}
                          </div>
                        )}
                        {booking.customer.phone && (
                          <div className="text-xs text-slate-400">
                            {booking.customer.phone}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Servicio */}
                    {booking.service && (
                      <div>
                        <div className="text-sm font-medium text-slate-100">
                          {booking.service.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {booking.service.duration_min} min ·{" "}
                          {(booking.service.price_cents / 100).toFixed(2)} €
                        </div>
                      </div>
                    )}

                    {/* Staff */}
                    {booking.staff && (
                      <div className="text-xs text-slate-400">
                        Staff: <span className="text-slate-300">{booking.staff.name}</span>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="pt-2 border-t border-slate-800">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditBooking(booking)}
                        className="w-full"
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      ) : (
        <AgendaTimeline
          bookings={bookings}
          selectedDate={selectedDate}
          timezone={tenantTimezone}
          onBookingClick={handleEditBooking}
        />
      )}

      {/* Botón flotante FAB */}
      <button
        onClick={() => setShowNewBookingModal(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-warm)] text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center z-50"
        aria-label="Nueva reserva"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Modal de nueva cita */}
      <Modal
        isOpen={showNewBookingModal}
        onClose={() => {
          setShowNewBookingModal(false);
          setEditingBooking(null);
          setBookingError(null);
          setNewBookingForm({
            customer_id: "",
            service_id: "",
            staff_id: "",
            date: selectedDate,
            time: format(new Date(), "HH:mm"),
            status: "paid",
          });
        }}
        title={editingBooking ? "Editar Cita" : "Nueva Cita"}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowNewBookingModal(false)}
              disabled={savingBooking}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={savingBooking || !newBookingForm.customer_id || !newBookingForm.service_id || !newBookingForm.staff_id}
              isLoading={savingBooking}
            >
              {editingBooking ? "Guardar Cambios" : "Crear Cita"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {bookingError && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{bookingError}</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Cliente <span className="text-red-400">*</span>
            </label>
            <select
              value={newBookingForm.customer_id}
              onChange={(e) =>
                setNewBookingForm({ ...newBookingForm, customer_id: e.target.value })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              required
            >
              <option value="">Selecciona un cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.email ? ` (${customer.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Servicio <span className="text-red-400">*</span>
            </label>
            <select
              value={newBookingForm.service_id}
              onChange={(e) =>
                setNewBookingForm({ ...newBookingForm, service_id: e.target.value })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              required
            >
              <option value="">Selecciona un servicio</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.duration_min} min -{" "}
                  {(service.price_cents / 100).toFixed(2)} €)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Staff <span className="text-red-400">*</span>
            </label>
            <select
              value={newBookingForm.staff_id}
              onChange={(e) =>
                setNewBookingForm({ ...newBookingForm, staff_id: e.target.value })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              required
            >
              <option value="">Selecciona un barbero</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={newBookingForm.date}
                onChange={(e) =>
                  setNewBookingForm({ ...newBookingForm, date: e.target.value })
                }
                min={format(new Date(), "yyyy-MM-dd")}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Hora <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={newBookingForm.time}
                onChange={(e) =>
                  setNewBookingForm({ ...newBookingForm, time: e.target.value })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Estado
            </label>
            <select
              value={newBookingForm.status}
              onChange={(e) =>
                setNewBookingForm({
                  ...newBookingForm,
                  status: e.target.value as "paid" | "pending" | "hold",
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
              <option value="hold">Reservado (Hold)</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Para citas en persona, normalmente se marca como "Pagado"
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
