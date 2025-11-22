"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { endOfDay, startOfDay, format, parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { Card, StatusBadge, Spinner, EmptyState, Button, DatePicker, Select, FilterPanel, TitleBar, SectionHeading } from "@/components/ui";
import { HeightAwareContainer, useHeightAware } from "@/components/panel/HeightAwareContainer";
import { PanelSection } from "@/components/panel/PanelSection";
import { Timeline } from "@/components/agenda/Timeline";
import { MiniBookingCard } from "@/components/agenda/MiniBookingCard";
import { StaffSelector } from "@/components/agenda/StaffSelector";
import { DaySwitcher } from "@/components/agenda/DaySwitcher";
import { AgendaHeader } from "@/components/calendar/AgendaHeader";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ListView } from "@/components/calendar/ListView";
import { FloatingActionButton } from "@/components/calendar/FloatingActionButton";
import { BookingDetailPanel } from "@/components/calendar/BookingDetailPanel";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import type { Booking } from "@/types/agenda";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Settings, Bell, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Tipo adaptador para MiniBookingCard
type MiniBookingCardData = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
  customer?: {
    name: string;
    email?: string;
    phone?: string | null;
  };
  service?: { name: string; duration_min: number; price_cents?: number };
  staff?: { name: string };
};

// Función para adaptar Booking a MiniBookingCardData
const adaptBookingToMiniCard = (booking: Booking): MiniBookingCardData => ({
  id: booking.id,
  starts_at: booking.starts_at,
  ends_at: booking.ends_at,
  status: booking.status,
  customer: booking.customer ? {
    name: booking.customer.name,
    email: booking.customer.email || undefined,
    phone: booking.customer.phone
  } : undefined,
  service: booking.service ? {
    name: booking.service.name,
    duration_min: booking.service.duration_min,
    price_cents: booking.service.price_cents
  } : undefined,
  staff: booking.staff ? {
    name: booking.staff.name
  } : undefined
});

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
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "list">("day");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
            staff:staff(id, id, name)
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
          
          // Debug: mostrar información de reservas cargadas
          if (process.env.NODE_ENV === 'development') {
            console.log('Bookings loaded:', {
              count: (data as Booking[])?.length || 0,
              bookings: (data as Booking[])?.map(b => ({
                id: b.id,
                starts_at: b.starts_at,
                localHour: new Date(b.starts_at).getHours(),
                customer: b.customer?.name,
                service: b.service?.name
              }))
            });
          }
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
    setSearchTerm("");
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleNewBooking = () => {
    setNewBookingOpen(true);
  };

  const handleDateChange = (dateStr: string) => {
    setSelectedDate(parseISO(dateStr));
  };

  const handleCalendarClick = () => {
    // TODO: Implement calendar picker modal
  };

  const handleSearchClick = () => {
    setSearchOpen(!searchOpen);
  };

  const handleNotificationsClick = () => {
    setNotificationsOpen(!notificationsOpen);
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
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

  // Calcular estadísticas rápidas
  const quickStats = useMemo(() => {
    if (!bookings.length) return undefined;
    
    const totalAmount = bookings.reduce((sum, b) => sum + (b.service?.price_cents || 0), 0);
    const totalMinutes = bookings.reduce((sum, b) => sum + (b.service?.duration_min || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    
    return {
      totalBookings: bookings.length,
      totalHours,
      totalAmount,
      rangeLabel: viewMode === "day" ? formattedDate : undefined
    };
  }, [bookings, formattedDate, viewMode]);

  // Calcular utilización por staff
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

  // Layout según densidad
  const sectionPadding = density === "ultra-compact" ? "compact" : density === "compact" ? "sm" : "md";

  // Calcular hourHeight dinámicamente según altura disponible
  const availableHeight = heightAware.availableHeight;
  const hoursToShow = 24; // 0:00 a 23:00 = 24 horas
  const headerHeight = 200; // Aproximado: filtros + título + staff selector
  const availableForTimeline = Math.max(600, availableHeight - headerHeight); // Mínimo 600px
  const calculatedHourHeight = Math.max(
    30, // Mínimo 30px para mostrar todas las horas
    Math.floor(availableForTimeline / hoursToShow)
  );
  const hourHeight = density === "ultra-compact" 
    ? Math.min(40, calculatedHourHeight)
    : density === "compact" 
    ? Math.min(50, calculatedHourHeight)
    : Math.min(60, calculatedHourHeight);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
      <AnimatePresence mode="wait">
        <motion.div
          key="agenda-main"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* Premium Header */}
          <div className="flex-shrink-0 mb-4">
            <AgendaHeader
              selectedDate={selectedDateStr}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onDateChange={handleDateChange}
              timeRange="8:00 – 20:00"
              onNotificationsClick={handleNotificationsClick}
              onSearchClick={handleSearchClick}
              onCalendarClick={handleCalendarClick}
              quickStats={quickStats}
              searchOpen={searchOpen}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSearchClose={() => setSearchOpen(false)}
              staffUtilization={staffUtilization}
              onStaffFilterChange={setSelectedStaffId}
            />
          </div>

          {/* Staff Selector compacto */}
          {staffList.length > 0 && viewMode === "day" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-shrink-0 mb-4"
            >
              <StaffSelector
                staff={staffList}
                selectedStaffId={selectedStaffId}
                onSelect={setSelectedStaffId}
                density={density}
              />
            </motion.div>
          )}

          {/* Contenido principal según vista */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-1 min-h-0 overflow-hidden"
          >
            {loading ? (
              <Card variant="default" density={density} className="h-full flex items-center justify-center border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]">
                <div className="text-center">
                  <Spinner size="lg" className="text-[var(--accent-aqua)]" />
                  <p
                    className="mt-4 text-lg font-medium"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Cargando agenda...
                  </p>
                </div>
              </Card>
            ) : bookings.length === 0 ? (
              <Card variant="default" density={density} className="h-full flex items-center justify-center border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]">
                <div className="text-center max-w-md mx-auto px-6">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-aqua)] p-1">
                    <div className="w-full h-full rounded-2xl bg-[var(--bg-primary)] flex items-center justify-center">
                      <Calendar className="w-10 h-10 text-[var(--accent-aqua)]" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                    No hay reservas
                  </h3>
                  <p className="text-[var(--text-secondary)] mb-6" style={{ fontFamily: "var(--font-body)" }}>
                    {viewMode === "day" 
                      ? "No hay citas para este día. ¿Quieres crear una nueva reserva?"
                      : "No hay citas en este período."
                    }
                  </p>
                  {viewMode === "day" && (
                    <Button
                      onClick={handleNewBooking}
                      icon={<Plus className="w-4 h-4" />}
                      className="bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      Nueva Reserva
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="h-full flex flex-col">
                {/* Debug Info - Solo en desarrollo */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="p-4 bg-[var(--glass-bg)] border-b border-[var(--glass-border)]">
                    <div className="text-sm font-mono">
                      <div>Bookings Count: {bookings.length}</div>
                      <div>Selected Date: {selectedDate?.toISOString()}</div>
                      <div>Selected Staff: {selectedStaffId || 'All'}</div>
                      <div>View Mode: {viewMode}</div>
                      <div>Hour Height: {hourHeight}px</div>
                    </div>
                  </div>
                )}
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={viewMode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 min-h-0"
                  >
                  {viewMode === "day" && (
                    <div className="h-full flex flex-col min-h-0 overflow-hidden">
                      {/* Vista Timeline (Desktop/Tablet) */}
                      <div className="hidden md:flex flex-1 min-h-0">
                        <div 
                          className="flex-1 min-h-0 overflow-y-auto border border-red-500" // Debug border
                          style={{ maxHeight: '800px' }} // Debug height limit
                          ref={(el) => {
                            if (el && process.env.NODE_ENV === 'development') {
                              console.log('Timeline container:', {
                                scrollHeight: el.scrollHeight,
                                clientHeight: el.clientHeight,
                                offsetHeight: el.offsetHeight,
                                hourHeight: hourHeight,
                                totalHours: 24,
                                estimatedHeight: hourHeight * 24
                              });
                            }
                          }}
                        >
                          <Timeline
                            startHour={0}
                            endHour={23}
                            density={density}
                            hourHeight={hourHeight}
                          >
                            {(hour) => {
                              const hourBookings = bookings.filter((booking) => {
                                const bookingDate = new Date(booking.starts_at);
                                // Usar la hora local en lugar de UTC para mejor precisión
                                const bookingHour = bookingDate.getHours();
                                return bookingHour === hour;
                              });

                              // Debug: mostrar información
                              if (process.env.NODE_ENV === 'development') {
                                console.log(`Hour ${hour}: Found ${hourBookings.length} bookings`, {
                                  totalBookings: bookings.length,
                                  hourBookings: hourBookings.map(b => ({
                                    id: b.id,
                                    starts_at: b.starts_at,
                                    hour: new Date(b.starts_at).getHours(),
                                    customer: b.customer?.name,
                                    service: b.service?.name
                                  }))
                                });
                              }

                              // Siempre mostrar información de debug para esta hora
                              console.log(`Hour ${hour} - Bookings: ${hourBookings.length}`, {
                                hasBookings: hourBookings.length > 0,
                                bookingDetails: hourBookings.slice(0, 2)
                              });

                              if (hourBookings.length === 0) return null;

                              return (
                                <div className="space-y-2">
                                  {hourBookings.map((booking) => (
                                    <MiniBookingCard
                                      key={booking.id}
                                      booking={adaptBookingToMiniCard(booking)}
                                      density={density}
                                      onClick={() => handleBookingClick(booking)}
                                    />
                                  ))}
                                </div>
                              );
                            }}
                          </Timeline>
                        </div>
                      </div>

                      {/* Vista Lista (Mobile) */}
                      <div className="md:hidden flex-1 min-h-0 overflow-y-auto">
                        <div className="space-y-3 p-4">
                          {bookings.map((booking) => (
                            <MiniBookingCard
                              key={booking.id}
                              booking={adaptBookingToMiniCard(booking)}
                              density={density}
                              onClick={() => handleBookingClick(booking)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {viewMode === "week" && (
                    <WeekView
                      bookings={bookings}
                      staffList={staffList}
                      selectedDate={selectedDateStr}
                      timezone={tenantTimezone}
                      onBookingClick={handleBookingClick}
                    />
                  )}

                  {viewMode === "month" && (
                    <MonthView
                      bookings={bookings}
                      selectedDate={selectedDateStr}
                      onDateSelect={handleDateChange}
                      onBookingClick={handleBookingClick}
                      timezone={tenantTimezone}
                    />
                  )}

                  {viewMode === "list" && (
                    <ListView
                      bookings={bookings}
                      selectedDate={selectedDateStr}
                      viewMode="list"
                      timezone={tenantTimezone}
                      onBookingClick={handleBookingClick}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Floating Action Button */}
          {viewMode === "day" && (
            <FloatingActionButton
              onClick={handleNewBooking}
              className="fixed bottom-6 right-6 z-50"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailPanel
            booking={selectedBooking}
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            timezone={tenantTimezone}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newBookingOpen && (
          <NewBookingModal
            isOpen={newBookingOpen}
            onClose={() => setNewBookingOpen(false)}
            onSave={async (bookingData) => {
              // Aquí iría la lógica para guardar la reserva
              setNewBookingOpen(false);
              // Refresh bookings
            }}
            services={[]}
            staff={staffList}
            customers={[]}
            selectedDate={selectedDateStr}
            tenantId={tenantId || ''}
          />
        )}
      </AnimatePresence>
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
