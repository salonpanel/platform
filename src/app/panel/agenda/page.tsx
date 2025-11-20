"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { endOfDay, startOfDay } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card, StatusBadge, Spinner, EmptyState, Button, DatePicker, Select, FilterPanel, TitleBar, SectionHeading } from "@/components/ui";
import { HeightAwareContainer, useHeightAware } from "@/components/panel/HeightAwareContainer";
import { PanelSection } from "@/components/panel/PanelSection";
import { Timeline } from "@/components/agenda/Timeline";
import { MiniBookingCard } from "@/components/agenda/MiniBookingCard";
import { StaffSelector } from "@/components/agenda/StaffSelector";
import { DaySwitcher } from "@/components/agenda/DaySwitcher";
import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

function AgendaContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const heightAware = useHeightAware();
  const { density: rawDensity } = heightAware;
  // Mapear Density type a valores aceptados por componentes UI
  const density = rawDensity === "normal" ? "default" : rawDensity;

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

  // Cargar bookings cuando cambia la fecha o el filtro de staff
  useEffect(() => {
    if (!tenantId || !selectedDate) return;

    let mounted = true;
    const loadBookings = async () => {
      try {
        setLoading(true);
        const from = startOfDay(selectedDate).toISOString();
        const to = endOfDay(selectedDate).toISOString();

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
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, selectedDate, selectedStaffId]);

  const handleResetFilters = () => {
    setSelectedDate(new Date());
    setSelectedStaffId(null);
  };

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

  if (error) {
    return (
      <Card variant="default" className="border-[var(--color-danger)]/50 bg-[var(--color-danger-glass)]">
        <div className="text-[var(--color-danger)]">
          <h3 className="mb-2 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
            Error
          </h3>
          <p className="text-sm" style={{ fontFamily: "var(--font-body)" }}>
            {error}
          </p>
        </div>
      </Card>
    );
  }

  const formattedDate = selectedDate ? dateFormatter.format(selectedDate) : "";

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

  // Layout según densidad
  const sectionPadding = density === "ultra-compact" ? "compact" : density === "compact" ? "sm" : "md";

  // Calcular hourHeight dinámicamente según altura disponible
  const availableHeight = heightAware.availableHeight;
  const hoursToShow = 20 - 8 + 1; // 8:00 a 20:00 = 13 horas
  const headerHeight = 200; // Aproximado: filtros + título + staff selector
  const availableForTimeline = Math.max(400, availableHeight - headerHeight);
  const calculatedHourHeight = Math.max(
    40, // Mínimo 40px
    Math.floor(availableForTimeline / hoursToShow)
  );
  const hourHeight = density === "ultra-compact" 
    ? Math.min(48, calculatedHourHeight)
    : density === "compact" 
    ? Math.min(64, calculatedHourHeight)
    : Math.min(80, calculatedHourHeight);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {/* Zona superior fija: Filtros + Título */}
        <div className="flex-shrink-0 space-y-3 mb-4">
          {/* Filtros */}
          <motion.div variants={itemVariants}>
            <FilterPanel
              title="Filtros"
              activeFilters={activeFilters}
              onClearAll={handleResetFilters}
            >
              <div className={cn(
                "grid gap-3",
                density === "ultra-compact" ? "grid-cols-1" : density === "compact" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}>
                <DatePicker
                  label="Fecha"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  minDate={new Date(2020, 0, 1)}
                />
                <Select
                  label="Staff"
                  value={selectedStaffId || ""}
                  onChange={(e) => setSelectedStaffId(e.target.value || null)}
                >
                  <option value="">Todos</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </Select>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleResetFilters}
                    icon={<Calendar className="h-4 w-4" />}
                    density={rawDensity === "normal" ? "default" : rawDensity === "ultra-compact" ? "compact" : rawDensity}
                  >
                    Hoy
                  </Button>
                </div>
              </div>
            </FilterPanel>
          </motion.div>

          {/* Título y contador con TitleBar */}
          <motion.div variants={itemVariants}>
            <TitleBar
              title={formattedDate}
              subtitle={`${bookings.length} ${bookings.length === 1 ? "reserva" : "reservas"}`}
              density={density}
            >
              {selectedDate && (
                <DaySwitcher
                  selectedDate={selectedDate}
                  onDateChange={(date) => setSelectedDate(date)}
                  density={density}
                />
              )}
            </TitleBar>
          </motion.div>

          {/* Staff Selector compacto */}
          {staffList.length > 0 && (
            <motion.div variants={itemVariants}>
              <StaffSelector
                staff={staffList}
                selectedStaffId={selectedStaffId}
                onSelect={setSelectedStaffId}
                density={density}
              />
            </motion.div>
          )}
        </div>

        {/* Contenido principal: Timeline o Lista según vista */}
        <motion.div
          variants={itemVariants}
          className="flex-1 min-h-0 overflow-hidden"
        >
          {loading ? (
            <Card variant="default" density={density} className="h-full flex items-center justify-center">
              <div className="text-center">
                <Spinner size="lg" />
                <p
                  className="mt-4"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cargando reservas...
                </p>
              </div>
            </Card>
          ) : bookings.length === 0 ? (
            <Card variant="default" density={density} className="h-full flex items-center justify-center">
              <EmptyState
                title="No hay reservas para esta fecha"
                description="Prueba a cambiar la fecha o revisa el portal de reservas."
              />
            </Card>
          ) : (
            <div className="h-full flex flex-col min-h-0 overflow-hidden">
              {/* Vista Timeline (Desktop/Tablet) - Principal */}
              <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                  <Timeline
                    startHour={8}
                    endHour={20}
                    density={density}
                    hourHeight={hourHeight}
                  >
                    {(hour) => {
                      const hourBookings = bookings.filter((booking) => {
                        const bookingHour = new Date(booking.starts_at).getHours();
                        return bookingHour === hour;
                      });

                      if (hourBookings.length === 0) return null;

                      return (
                        <div className="space-y-2">
                          {hourBookings.map((booking) => (
                            <MiniBookingCard
                              key={booking.id}
                              booking={booking}
                              density={density}
                              onClick={() => {
                                // TODO: Abrir modal de detalle
                              }}
                            />
                          ))}
                        </div>
                      );
                    }}
                  </Timeline>
                </div>
              </div>

              {/* Vista Lista (Mobile) - Usa MiniBookingCard */}
              <div className="md:hidden flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <MiniBookingCard
                      key={booking.id}
                      booking={booking}
                      density={density}
                      onClick={() => {
                        // TODO: Abrir modal de detalle
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function AgendaWrapper() {
  return (
    <HeightAwareContainer className="h-full">
      <AgendaContent />
    </HeightAwareContainer>
  );
}

export default function AgendaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" />
        </div>
      }
    >
      <AgendaWrapper />
    </Suspense>
  );
}
