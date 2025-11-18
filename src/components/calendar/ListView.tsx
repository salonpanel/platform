"use client";

import { useMemo } from "react";
import React from "react";
import { format, parseISO, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { motion } from "framer-motion";
import { toTenantLocalDate, formatInTenantTz } from "@/lib/timezone";
import { Booking, ViewMode } from "@/types/agenda";

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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-center justify-center h-full p-6"
      >
        <div className="bg-[#15171A] rounded-2xl p-12 border border-white/5 shadow-[0px_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md text-center">
          {isEmptySearch ? (
            <>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-white mb-2 font-['Plus_Jakarta_Sans']">
                No hay coincidencias
              </h3>
              <p className="text-sm text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                No se encontraron reservas que coincidan con "{searchTerm}"
              </p>
            </>
          ) : (
            <EmptyState
              title="No hay reservas"
              description="No hay reservas para el rango seleccionado."
            />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3 h-full overflow-y-auto scrollbar-hide p-4">
      {/* Vista Desktop: Tabla */}
      <div className="hidden md:block overflow-x-auto">
        <div className="bg-[#15171A] rounded-2xl border border-white/5 shadow-[0px_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/5 bg-[#15171A]">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                  Hora
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                  Servicio
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                  Barbero
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                  Precio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bookingsByDate.map(([dateKey, dateBookings]) => {
                const dateObj = parseISO(dateKey);
                const showDateSeparator = bookingsByDate.length > 1;
                
                return (
                  <React.Fragment key={dateKey}>
                    {/* Separador de fecha cuando hay múltiples días */}
                    {showDateSeparator && (
                      <tr className="bg-white/3 sticky top-0 z-10">
                        <td colSpan={6} className="px-6 py-3 border-b border-white/10">
                          <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
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
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02, duration: 0.15, ease: "easeOut" }}
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
                          className="hover:bg-white/3 focus:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/50 transition-colors cursor-pointer group"
                        >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-white font-mono font-['Plus_Jakarta_Sans']">
                        {startTime} - {endTime}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {booking.customer?.name || "Sin cliente"}
                      </div>
                      {booking.customer?.phone && (
                        <div className="text-xs text-[#9ca3af] mt-1 font-['Plus_Jakarta_Sans']">
                          {booking.customer.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {booking.service?.name || "Sin servicio"}
                      </div>
                      {booking.service && (
                        <div className="text-xs text-[#9ca3af] mt-1 font-['Plus_Jakarta_Sans']">
                          {booking.service.duration_min} min
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {booking.staff?.name || "Sin asignar"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
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
                <div className="sticky top-0 z-10 py-2 bg-[#15171A] border-b border-white/10 mb-2">
                  <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider font-['Plus_Jakarta_Sans']">
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.15, ease: "easeOut" }}
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
                      className="p-4 cursor-pointer bg-[#15171A] border border-white/5 hover:border-white/10 hover:bg-white/3 focus:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/50 transition-all rounded-2xl backdrop-blur-md shadow-[0px_2px_8px_rgba(0,0,0,0.25)]"
                    >
                      {/* Fila superior: Hora + Estado */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm font-semibold text-white font-mono font-['Plus_Jakarta_Sans']">
                          {startTime} - {endTime}
                        </div>
                        <StatusBadge status={booking.status} size="xs" />
                      </div>
                      {/* Fila media: Cliente + Servicio */}
                      <div className="text-base font-semibold text-white mb-1.5 font-['Plus_Jakarta_Sans']">
                        {booking.customer?.name || "Sin cliente"}
                      </div>
                      <div className="text-sm text-[#d1d4dc] mb-2 font-['Plus_Jakarta_Sans']">
                        {booking.service?.name || "Sin servicio"}
                        {booking.service && ` • ${booking.service.duration_min} min`}
                        {booking.staff && ` • ${booking.staff.name}`}
                      </div>
                      {/* Fila inferior: Precio */}
                      {booking.service && (
                        <div className="text-sm font-semibold text-white pt-2 border-t border-white/5 font-['Plus_Jakarta_Sans']">
                          {(booking.service.price_cents / 100).toFixed(2)} €
                        </div>
                      )}
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

