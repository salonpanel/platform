"use client";

import { useMemo } from "react";
import React from "react";
import { format, parseISO, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { motion } from "framer-motion";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking, ViewMode } from "@/types/agenda";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { getMotionSafeProps, interactionPresets } from "@/components/agenda/motion/presets";

interface ListViewProps {
  bookings: Booking[];
  selectedDate: string;
  viewMode: ViewMode;
  timezone: string;
  onBookingClick: (booking: Booking) => void;
  searchTerm?: string;
}

export function ListView({
  bookings,
  selectedDate,
  viewMode,
  timezone,
  onBookingClick,
  searchTerm = "",
}: ListViewProps) {
  // Ordenar bookings por hora de inicio (por defecto: ascendente)
  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  }, [bookings]);

  // Agrupar bookings por fecha para mostrar separadores cuando hay múltiples días
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    
    sortedBookings.forEach((booking) => {
      const bookingDate = new Date(booking.starts_at);
      const localBookingDate = toTenantLocalDate(bookingDate, timezone);
      const dateKey = format(localBookingDate, "yyyy-MM-dd");
      
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(booking);
    });

    // Convertir a array ordenado por fecha
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedBookings, timezone]);

  // Estado vacío mejorado
  if (sortedBookings.length === 0) {
    const isEmptySearch = searchTerm.trim().length > 0;
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.2, ease: "easeOut" },
        })}
        className="flex items-center justify-center h-full p-6"
      >
        <GlassCard variant="elevated" padding="xl" className="text-center">
          {isEmptySearch ? (
            <>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                "text-primary font-sans"
              )}>
                No hay coincidencias
              </h3>
              <p className={cn(
                "text-sm",
                "text-secondary font-sans"
              )}>
                No se encontraron reservas que coincidan con "{searchTerm}"
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">📅</div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                "text-primary font-sans"
              )}>
                No hay reservas
              </h3>
              <p className={cn(
                "text-sm",
                "text-secondary font-sans"
              )}>
                No hay reservas para el rango seleccionado.
              </p>
            </>
          )}
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3 h-full overflow-y-auto scrollbar-hide p-4">
      {/* Vista Desktop: Tabla */}
      <div className="hidden md:block overflow-x-auto">
        <GlassCard variant="elevated" padding="none" className="overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border-default">
              <tr>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-tertiary font-sans"
                )}>
                  Hora
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-tertiary font-sans"
                )}>
                  Cliente
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-tertiary font-sans"
                )}>
                  Servicio
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-tertiary font-sans"
                )}>
                  Barbero
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-tertiary font-sans"
                )}>
                  Estado
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                  "text-tertiary font-sans"
                )}>
                  Precio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {bookingsByDate.map(([dateKey, dateBookings]) => {
                const dateObj = parseISO(dateKey);
                const showDateSeparator = bookingsByDate.length > 1;

                return (
                  <React.Fragment key={dateKey}>
                    {/* Separador de fecha cuando hay múltiples días */}
                    {showDateSeparator && (
                      <tr className="bg-glass sticky top-0 z-10">
                        <td colSpan={6} className="px-6 py-3 border-b border-border-hover">
                          <div className={cn(
                            "text-xs font-semibold uppercase tracking-wider",
                            "text-tertiary font-sans"
                          )}>
                            {format(dateObj, "EEEE, d 'de' MMMM", { locale: es })}
                          </div>
                        </td>
                      </tr>
                    )}

                    {dateBookings.map((booking, index) => {
                      const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
                      const endTime = formatInTenantTz(booking.ends_at, timezone, "HH:mm");

                      return (
                        <motion.tr
                          key={booking.id}
                          {...getMotionSafeProps({
                            initial: { opacity: 0, x: -12 },
                            animate: { opacity: 1, x: 0 },
                            transition: { delay: index * 0.02, duration: 0.15, ease: "easeOut" },
                          })}
                          onClick={() => onBookingClick(booking)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onBookingClick(booking);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
                          className={cn(
                            "hover:bg-glass focus:bg-glass focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:ring-offset-2 focus:ring-offset-primary transition-colors cursor-pointer",
                            "text-primary"
                          )}
                        >
                    <td className="px-6 py-4">
                      <div className={cn(
                        "text-sm font-semibold font-mono",
                        "text-primary font-sans"
                      )}>
                        {startTime} - {endTime}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "text-sm font-semibold",
                        "text-primary font-sans"
                      )}>
                        {booking.customer?.name || "Sin cliente"}
                      </div>
                      {booking.customer?.phone && (
                        <div className={cn(
                          "text-xs mt-1",
                          "text-tertiary font-sans"
                        )}>
                          {booking.customer.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "text-sm font-semibold",
                        "text-primary font-sans"
                      )}>
                        {booking.service?.name || "Sin servicio"}
                      </div>
                      {booking.service && (
                        <div className={cn(
                          "text-xs mt-1",
                          "text-tertiary font-sans"
                        )}>
                          {booking.service.duration_min} min
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "text-sm font-semibold",
                        "text-primary font-sans"
                      )}>
                        {booking.staff?.name || "Sin asignar"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "text-sm font-semibold",
                        "text-primary font-sans"
                      )}>
                        {booking.service
                          ? `${(booking.service.price_cents / 100).toFixed(2)} €`
                          : "-"}
                      </div>
                    </td>
                      </motion.tr>
                    );
                  })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      </div>

      {/* Vista Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {bookingsByDate.map(([dateKey, dateBookings]) => {
          const dateObj = parseISO(dateKey);
          const showDateSeparator = bookingsByDate.length > 1;

          return (
            <div key={dateKey} className="space-y-3">
              {/* Separador de fecha cuando hay múltiples días */}
              {showDateSeparator && (
                <div className="sticky top-0 z-10 py-2 bg-primary border-b border-border-default mb-2">
                  <div className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    "text-tertiary font-sans"
                  )}>
                    {format(dateObj, "EEEE, d 'de' MMMM", { locale: es })}
                  </div>
                </div>
              )}

              {dateBookings.map((booking, index) => {
                const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
                const endTime = formatInTenantTz(booking.ends_at, timezone, "HH:mm");

                return (
                  <motion.div
                    key={booking.id}
                    {...getMotionSafeProps({
                      initial: { opacity: 0, y: 8 },
                      animate: { opacity: 1, y: 0 },
                      transition: { delay: index * 0.02, duration: 0.15, ease: "easeOut" },
                    })}
                  >
                    <div
                      onClick={() => onBookingClick(booking)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onBookingClick(booking);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
                      className="cursor-pointer"
                    >
                      <motion.div
                        {...getMotionSafeProps({
                          whileHover: interactionPresets.appointmentCard.hover,
                          whileTap: interactionPresets.appointmentCard.tap,
                        })}
                        className="focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:ring-offset-2 focus:ring-offset-primary"
                      >
                        <GlassCard
                          variant="elevated"
                          padding="md"
                        >
                        {/* Fila superior: Hora + Estado */}
                        <div className="flex items-start justify-between mb-2">
                          <div className={cn(
                            "text-sm font-semibold font-mono",
                            "text-primary font-sans"
                          )}>
                            {startTime} - {endTime}
                          </div>
                          <StatusBadge status={booking.status} size="xs" />
                        </div>
                        {/* Fila media: Cliente + Servicio */}
                        <div className={cn(
                          "text-base font-semibold mb-1.5",
                          "text-primary font-sans"
                        )}>
                          {booking.customer?.name || "Sin cliente"}
                        </div>
                        <div className={cn(
                          "text-sm mb-2",
                          "text-secondary font-sans"
                        )}>
                          {booking.service?.name || "Sin servicio"}
                          {booking.service && ` • ${booking.service.duration_min} min`}
                          {booking.staff && ` • ${booking.staff.name}`}
                        </div>
                        {/* Fila inferior: Precio */}
                        {booking.service && (
                          <div className={cn(
                            "text-sm font-semibold pt-2 border-t border-border-default",
                            "text-primary font-sans"
                          )}>
                            {(booking.service.price_cents / 100).toFixed(2)} €
                          </div>
                        )}
                      </GlassCard>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

