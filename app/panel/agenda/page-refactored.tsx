"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgendaHeader } from "@/components/calendar/AgendaHeader";
import { AgendaSidebar } from "@/components/calendar/AgendaSidebar";
import { FloatingActionButton } from "@/components/calendar/FloatingActionButton";
import { AgendaCalendarView } from "@/components/panel/AgendaCalendarView";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
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

type ViewMode = "day" | "week" | "month" | "list";

export default function AgendaPage() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    payment: [] as string[],
    status: [] as string[],
    staff: [] as string[],
    highlighted: null as boolean | null,
  });

  // Cargar tenant y staff
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

  // Cargar bookings
  useEffect(() => {
    if (!tenantId) return;

    const loadBookings = async () => {
      try {
        setLoading(true);
        const start = startOfDay(parseISO(selectedDate));
        const end = endOfDay(parseISO(selectedDate));

        let query = supabase
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

        // Aplicar filtros
        if (filters.staff.length > 0 && !filters.staff.includes("all")) {
          query = query.in("staff_id", filters.staff);
        }

        if (filters.status.length > 0) {
          query = query.in("status", filters.status);
        }

        const { data, error: bookingsError } = await query;

        if (bookingsError) throw bookingsError;

        let filteredBookings = data || [];

        // Filtro de pago (client-side por ahora)
        if (filters.payment.length > 0) {
          filteredBookings = filteredBookings.filter((b) => {
            const isPaid = b.status === "paid" || b.status === "completed";
            return filters.payment.includes("paid") ? isPaid : !isPaid;
          });
        }

        setBookings(filteredBookings as Booking[]);
      } catch (err: any) {
        setError(err?.message || "Error al cargar reservas");
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [supabase, tenantId, selectedDate, filters]);

  // Staff IDs seleccionados para la vista
  const selectedStaffIds = useMemo(() => {
    if (filters.staff.length === 0 || filters.staff.includes("all")) {
      return ["all"];
    }
    return filters.staff;
  }, [filters.staff]);

  if (error && !tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <p className="text-red-400">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:block w-72 flex-shrink-0 border-r border-[var(--color-bg-tertiary)]">
        <AgendaSidebar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          filters={filters}
          onFiltersChange={setFilters}
          staffList={staffList}
        />
      </aside>

      {/* Sidebar - Mobile (Drawer) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-[var(--color-bg-secondary)]">
            <AgendaSidebar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              filters={filters}
              onFiltersChange={setFilters}
              staffList={staffList}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AgendaHeader
          selectedDate={selectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNotificationsClick={() => setNotificationsOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
          onFiltersClick={() => setSidebarOpen(true)}
          showFiltersButton={true}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner size="lg" />
            </div>
          ) : viewMode === "day" ? (
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
                onBookingClick={(booking) => {
                  // TODO: Abrir panel lateral con detalles
                  console.log("Booking clicked:", booking);
                }}
              />
            )
          ) : viewMode === "week" ? (
            <Card className="p-12">
              <p className="text-center text-[var(--color-text-secondary)]">
                Vista Semana - Próximamente
              </p>
            </Card>
          ) : viewMode === "month" ? (
            <Card className="p-12">
              <p className="text-center text-[var(--color-text-secondary)]">
                Vista Mes - Próximamente
              </p>
            </Card>
          ) : (
            <Card className="p-12">
              <p className="text-center text-[var(--color-text-secondary)]">
                Vista Lista - Próximamente
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* FAB */}
      <FloatingActionButton onClick={() => setShowNewBookingModal(true)} />

      {/* Modal de nueva cita (placeholder) */}
      <Modal
        isOpen={showNewBookingModal}
        onClose={() => setShowNewBookingModal(false)}
        title="Nueva cita"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-[var(--color-text-secondary)]">
            Formulario de nueva cita - En desarrollo
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowNewBookingModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={() => setShowNewBookingModal(false)}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Panel de notificaciones (placeholder) */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setNotificationsOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[var(--color-bg-secondary)] p-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Notificaciones
            </h3>
            <p className="text-[var(--color-text-secondary)]">
              Panel de notificaciones - En desarrollo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}






