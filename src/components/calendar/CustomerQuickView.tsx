"use client";

import { Phone, Mail, Calendar, TrendingUp, AlertCircle, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes?: string;
  allergies?: string;
  isVip?: boolean;
  isNew?: boolean;
}

interface CustomerQuickViewProps {
  customer: Customer;
  onClose: () => void;
  onCreateBooking?: () => void;
  stats?: {
    totalBookings: number;
    noShows: number;
    cancellations: number;
    totalSpent: number;
  };
  upcomingBookings?: Array<{
    id: string;
    date: string;
    service: string;
    amount: number;
  }>;
  pastBookings?: Array<{
    id: string;
    date: string;
    service: string;
    amount: number;
  }>;
}

export function CustomerQuickView({
  customer,
  onClose,
  onCreateBooking,
  stats,
  upcomingBookings = [],
  pastBookings = [],
}: CustomerQuickViewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-[#15171A] border border-white/10 rounded-2xl shadow-[0px_8px_32px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[rgba(58,109,255,0.2)] flex items-center justify-center text-lg font-semibold text-[#3A6DFF] font-['Plus_Jakarta_Sans']">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white font-['Plus_Jakarta_Sans']">
                {customer.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {customer.isNew && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(58,109,255,0.15)] border border-[#3A6DFF]/30 text-[#3A6DFF] font-['Plus_Jakarta_Sans'] font-semibold">
                    Nuevo
                  </span>
                )}
                {customer.isVip && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,193,7,0.15)] border border-[#FFC107]/30 text-[#FFC107] font-['Plus_Jakarta_Sans'] font-semibold">
                    VIP
                  </span>
                )}
                {!customer.isNew && !customer.isVip && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#9ca3af] font-['Plus_Jakarta_Sans'] font-semibold">
                    Habitual
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[10px] text-[#d1d4dc] hover:text-white hover:bg-white/5 transition-all duration-150"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contacto */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">
              Contacto
            </h3>
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                  <Phone className="h-4 w-4 text-[#9ca3af]" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                  <Mail className="h-4 w-4 text-[#9ca3af]" />
                  <span>{customer.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Salud / Alergias */}
          {customer.allergies && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                <AlertCircle className="h-4 w-4 text-[#FFC107]" />
                Salud / Alergias
              </h3>
              <div className="p-3 bg-[rgba(255,193,7,0.08)] border border-[#FFC107]/30 rounded-[14px]">
                <p className="text-sm text-[#FFC107] font-['Plus_Jakarta_Sans']">{customer.allergies}</p>
              </div>
            </div>
          )}

          {/* Notas clave */}
          {customer.notes && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">
                Notas clave
              </h3>
              <div className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                <p className="text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">{customer.notes}</p>
              </div>
            </div>
          )}

          {/* Métricas */}
          {stats && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                <TrendingUp className="h-4 w-4 text-[#4FE3C1]" />
                Métricas
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                  <div className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Total citas</div>
                  <div className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {stats.totalBookings}
                  </div>
                </div>
                <div className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                  <div className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">No shows</div>
                  <div className="text-lg font-semibold text-[#EF4444] font-['Plus_Jakarta_Sans']">{stats.noShows}</div>
                </div>
                <div className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                  <div className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Cancelaciones</div>
                  <div className="text-lg font-semibold text-[#FFC107] font-['Plus_Jakarta_Sans']">
                    {stats.cancellations}
                  </div>
                </div>
                <div className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                  <div className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Gasto total</div>
                  <div className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {(stats.totalSpent / 100).toFixed(2)} €
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Próximas citas */}
          {upcomingBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 font-['Plus_Jakarta_Sans']">
                <Calendar className="h-4 w-4 text-[#3A6DFF]" />
                Próximas citas
              </h3>
              <div className="space-y-2">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                          {booking.service}
                        </div>
                        <div className="text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                          {format(new Date(booking.date), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {(booking.amount / 100).toFixed(2)} €
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial */}
          {pastBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">
                Historial reciente
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {pastBookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="p-3 bg-white/3 border border-white/5 rounded-[14px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                          {booking.service}
                        </div>
                        <div className="text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                          {format(new Date(booking.date), "dd/MM/yyyy")}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {(booking.amount / 100).toFixed(2)} €
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-white/5">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {onCreateBooking && (
            <Button onClick={onCreateBooking}>
              Crear cita ahora
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

