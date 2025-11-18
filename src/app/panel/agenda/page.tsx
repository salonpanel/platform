"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { endOfDay, startOfDay, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

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

export default function AgendaPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (selectedStaffId) {
          query = query.eq("staff_id", selectedStaffId);
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
  }, [supabase, tenantId, selectedDate, selectedStaffId]);

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

  const selectedDateObj = parseISO(selectedDate);
  const formattedDate = dateFormatter.format(selectedDateObj);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Fecha
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Staff
            </label>
            <select
              value={selectedStaffId || ""}
              onChange={(e) => setSelectedStaffId(e.target.value || null)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">Todos</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSelectedDate(format(new Date(), "yyyy-MM-dd"));
                setSelectedStaffId(null);
              }}
            >
              Hoy
            </Button>
          </div>
        </div>
      </Card>

      {/* Título y contador */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            {formattedDate}
          </h2>
        </div>
        <div className="text-sm text-slate-400">
          {bookings.length} {bookings.length === 1 ? "reserva" : "reservas"}
        </div>
      </div>

      {/* Lista de reservas */}
      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Spinner size="lg" />
              <p className="mt-4 text-slate-400">Cargando reservas...</p>
            </div>
          </div>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
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
                        {/* Acciones rápidas - preparado para implementar */}
                        <div className="flex items-center justify-end gap-2">
                          {/* Botones de acción futuros */}
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

                  {/* Acciones - preparado para implementar */}
                  <div className="pt-2 border-t border-slate-800">
                    {/* Botones de acción futuros */}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
