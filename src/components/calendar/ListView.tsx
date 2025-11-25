"use client";

import { useMemo } from "react";
import React from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BookingCard } from "@/components/agenda/BookingCard";
import { motion } from "framer-motion";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking, ViewMode } from "@/types/agenda";
import { cn } from "@/lib/utils";
import { getMotionSafeProps } from "@/components/agenda/motion/presets";

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
        <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] backdrop-blur-md rounded-[var(--radius-xl)] p-6 text-center shadow-[var(--shadow-premium)]">
          {isEmptySearch ? (
            <>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                "text-[var(--text-primary)] font-[var(--font-heading)]"
              )}>
                No hay coincidencias
              </h3>
              <p className={cn(
                "text-sm",
                "text-[var(--text-secondary)] font-[var(--font-body)]"
              )}>
                No se encontraron reservas que coincidan con "{searchTerm}"
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">📅</div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                "text-[var(--text-primary)] font-[var(--font-heading)]"
              )}>
                No hay reservas
              </h3>
              <p className={cn(
                "text-sm",
                "text-[var(--text-secondary)] font-[var(--font-body)]"
              )}>
                No hay reservas para el rango seleccionado.
              </p>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0B0C10] relative p-4" role="region" aria-label="Lista de reservas">
      {/* Radial Gradient Overlay for Neo-Glass effect */}
      <div 
        className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none z-0"
        style={{ transform: 'translate(-20%, -20%)' }}
      />
      
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide">
        {/* Vista Desktop: Tabla */}
        <div className="hidden md:block overflow-x-auto">
          <div className="bg-[var(--glass-bg-default)] border border-[var(--glass-border)] backdrop-blur-md rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-premium)]">
            <table className="w-full" role="table" aria-label="Tabla de reservas">
              <thead className="border-b border-[var(--glass-border-subtle)]" role="rowgroup">
                <tr role="row">
                  <th className={cn(
                    "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )} scope="col" role="columnheader">
                    Hora
                  </th>
                  <th className={cn(
                    "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )} scope="col" role="columnheader">
                    Cliente
                  </th>
                  <th className={cn(
                    "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )} scope="col" role="columnheader">
                    Servicio
                  </th>
                  <th className={cn(
                    "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )} scope="col" role="columnheader">
                    Barbero
                  </th>
                  <th className={cn(
                    "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )} scope="col" role="columnheader">
                    Estado
                  </th>
                  <th className={cn(
                    "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider",
                    "text-[var(--text-tertiary)] font-[var(--font-body)]"
                  )} scope="col" role="columnheader">
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border-subtle)]" role="rowgroup">
                {bookingsByDate.map(([dateKey, dateBookings]) => {
                  const dateObj = parseISO(dateKey);
                  const showDateSeparator = bookingsByDate.length > 1;

                  return (
                    <React.Fragment key={dateKey}>
                      {/* Separador de fecha cuando hay múltiples días */}
                      {showDateSeparator && (
                        <tr className="bg-[var(--glass-bg-subtle)] sticky top-0 z-10">
                          <td colSpan={6} className="px-6 py-3 border-b border-[var(--glass-border-hover)]">
                            <div className={cn(
                              "text-xs font-semibold uppercase tracking-wider",
                              "text-[var(--text-tertiary)] font-[var(--font-body)]"
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
                            className={cn(
                              "hover:bg-[var(--glass-bg-subtle)] focus:bg-[var(--glass-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/50 focus:ring-offset-2 focus:ring-offset-[#0B0C10] transition-colors duration-200 cursor-pointer",
                              "text-[var(--text-primary)]"
                            )}
                            role="row"
                            aria-label={`Reserva de ${booking.customer?.name || "cliente"} a las ${startTime} - ${endTime}`}
                          >
                            <td className="px-6 py-4" role="cell">
                              <div className={cn(
                                "text-sm font-semibold font-[var(--font-mono)]",
                                "text-[var(--text-primary)]"
                              )}>
                                {startTime} - {endTime}
                              </div>
                            </td>
                            <td className="px-6 py-4" role="cell">
                              <div className={cn(
                                "text-sm font-semibold",
                                "text-[var(--text-primary)] font-[var(--font-heading)]"
                              )}>
                                {booking.customer?.name || "Sin cliente"}
                              </div>
                              {booking.customer?.phone && (
                                <div className={cn(
                                  "text-xs mt-1",
                                  "text-[var(--text-tertiary)] font-[var(--font-body)]"
                                )}>
                                  {booking.customer.phone}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4" role="cell">
                              <div className={cn(
                                "text-sm font-semibold",
                                "text-[var(--text-primary)] font-[var(--font-heading)]"
                              )}>
                                {booking.service?.name || "Sin servicio"}
                              </div>
                              {booking.service && (
                                <div className={cn(
                                  "text-xs mt-1",
                                  "text-[var(--text-tertiary)] font-[var(--font-body)]"
                                )}>
                                  {booking.service.duration_min} min
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4" role="cell">
                              <div className={cn(
                                "text-sm font-semibold",
                                "text-[var(--text-primary)] font-[var(--font-heading)]"
                              )}>
                                {booking.staff?.name || "Sin asignar"}
                              </div>
                            </td>
                            <td className="px-6 py-4" role="cell">
                              <div className="w-fit">
                                <BookingCard
                                  booking={booking}
                                  timezone={timezone}
                                  variant="list"
                                  onClick={() => onBookingClick(booking)}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4" role="cell">
                              <div className={cn(
                                "text-sm font-semibold",
                                "text-[var(--text-primary)] font-[var(--font-heading)]"
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
          </div>
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
                  <div className="sticky top-0 z-10 py-2 bg-[#0B0C10] border-b border-[var(--glass-border-subtle)] mb-2">
                    <div className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      "text-[var(--text-tertiary)] font-[var(--font-body)]"
                    )}>
                      {format(dateObj, "EEEE, d 'de' MMMM", { locale: es })}
                    </div>
                  </div>
                )}

                {dateBookings.map((booking, index) => (
                    <motion.div
                      key={booking.id}
                      {...getMotionSafeProps({
                        initial: { opacity: 0, y: 8 },
                        animate: { opacity: 1, y: 0 },
                        transition: { delay: index * 0.02, duration: 0.15, ease: "easeOut" },
                      })}
                    >
                      <BookingCard
                        booking={booking}
                        timezone={timezone}
                        variant="list"
                        onClick={() => onBookingClick(booking)}
                      />
                    </motion.div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

