"use client";

import { useState } from "react";
import { X, Edit, Trash2, Phone, Mail, Calendar, Clock, User, DollarSign, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { formatInTenantTz } from "@/lib/timezone";
import { Booking } from "@/types/agenda";
import { useToast } from "@/components/ui/Toast";

// Booking type imported from @/types/agenda

interface BookingDetailPanelProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (booking: Booking) => void;
  onDelete?: (bookingId: string) => void;
  timezone: string;
}

export function BookingDetailPanel({
  booking,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  timezone,
}: BookingDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showToast, ToastComponent } = useToast();

  if (!isOpen || !booking) return null;

  const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
  const endTime = formatInTenantTz(booking.ends_at, timezone, "HH:mm");
  const date = formatInTenantTz(booking.starts_at, timezone, "EEEE, d 'de' MMMM");
  const dateShort = formatInTenantTz(booking.starts_at, timezone, "d MMM yyyy");

  const handleDelete = () => {
    if (onDelete) {
      onDelete(booking.id);
      onClose();
      showToast("Cita eliminada correctamente", "success");
    }
  };

  // Drawer móvil (md-)
  const MobileDrawer = (
    <div 
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-96 bg-[#15171A] border-l border-white/10 flex flex-col shadow-[0px_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 
            id="booking-detail-title"
            className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']"
          >
            Detalles de la cita
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-[10px] text-[#d1d4dc] hover:text-white hover:bg-white/5 transition-all duration-150"
            aria-label="Cerrar panel de detalles"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {/* Resumen principal */}
          <div className="p-4 rounded-[16px] border border-white/5 bg-gradient-to-br from-[rgba(58,109,255,0.08)] to-[rgba(79,227,193,0.05)] backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">Cita</p>
                <p className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">
                  {booking.customer?.name || "Sin cliente"}
                </p>
              </div>
              <StatusBadge status={booking.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] mb-1">Fecha</p>
                <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{dateShort}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] mb-1">Horario</p>
                <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{startTime} - {endTime}</p>
              </div>
            </div>
          </div>

          {/* Cliente */}
          {booking.customer && (
            <>
              <div className="p-4 bg-white/3 border border-white/5 rounded-[14px]">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-[#3A6DFF]" />
                  <h4 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    Cliente
                  </h4>
                </div>
                <div className="space-y-2.5">
                  <div className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {booking.customer.name}
                  </div>
                  {booking.customer.phone && (
                    <div className="flex items-center gap-2 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                      <Phone className="h-4 w-4 text-[#9ca3af]" />
                      <span>{booking.customer.phone}</span>
                    </div>
                  )}
                  {booking.customer.email && (
                    <div className="flex items-center gap-2 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                      <Mail className="h-4 w-4 text-[#9ca3af]" />
                      <span>{booking.customer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas internas del cliente (IA) - Mobile */}
              {booking.customer.internal_notes && (
                <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-[14px]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🤖</span>
                    <h4 className="text-sm font-semibold text-amber-300 font-['Plus_Jakarta_Sans']">Notas para IA y Staff</h4>
                  </div>
                  <p className="text-sm text-white/90 font-['Plus_Jakarta_Sans'] leading-relaxed whitespace-pre-wrap">
                    {booking.customer.internal_notes}
                  </p>
                  <p className="mt-2 text-xs text-amber-300/70 font-['Plus_Jakarta_Sans']">
                    💡 La IA de voz usa estas notas para personalizar las llamadas
                  </p>
                </div>
              )}
            </>
          )}

          {/* Detalles de la cita */}
          <div className="p-4 bg-white/3 border border-white/5 rounded-[14px]">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-[#4FE3C1]" />
              <h4 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                Detalles
              </h4>
            </div>
            <div className="space-y-3">
              {booking.service && (
                <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-[#9ca3af]" />
                    <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Servicio</span>
                  </div>
                  <div className="text-sm text-white font-semibold font-['Plus_Jakarta_Sans']">
                    {booking.service.name} ({(booking.service.duration_min)} min)
                  </div>
                </div>
              )}
              {booking.staff && (
                <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#9ca3af]" />
                    <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Barbero</span>
                  </div>
                  <div className="text-sm text-white font-semibold font-['Plus_Jakarta_Sans']">
                    {booking.staff.name}
                  </div>
                </div>
              )}
              {booking.service && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#9ca3af]" />
                    <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Precio</span>
                  </div>
                  <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {(booking.service.price_cents / 100).toFixed(2)} €
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="space-y-2 pt-2">
            {onEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  onEdit(booking);
                  onClose();
                }}
                className="w-full justify-start"
              >
                <Edit className="h-4 w-4" />
                Editar cita
              </Button>
            )}
            {onDelete && (
              <>
                {!showDeleteConfirm ? (
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full justify-start"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar cita
                  </Button>
                ) : (
                  <div className="p-3 rounded-[14px] bg-[rgba(239,68,68,0.08)] border border-[#EF4444]/30 space-y-2">
                    <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                      ¿Eliminar esta cita?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleDelete}
                        className="flex-1"
                      >
                        Eliminar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {ToastComponent}
    </div>
  );

  // Modal escritorio (md+)
  const DesktopModal = (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalles de la cita"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          {onDelete && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm("¿Estás seguro de eliminar esta cita?")) {
                  onDelete(booking.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          )}
          {onEdit && (
            <Button
              onClick={() => onEdit(booking)}
            >
              <Edit className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Resumen principal */}
        <div className="p-4 rounded-[16px] border border-white/5 bg-gradient-to-br from-[rgba(58,109,255,0.08)] to-[rgba(79,227,193,0.05)] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">Cita</p>
              <p className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">
                {booking.customer?.name || "Sin cliente"}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] mb-1">Fecha</p>
              <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{dateShort}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] mb-1">Horario</p>
              <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{startTime} - {endTime}</p>
            </div>
            {booking.service && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] mb-1">Precio</p>
                <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{(booking.service.price_cents / 100).toFixed(2)} €</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Columna izquierda */}
          <div className="space-y-4">
            {booking.customer && (
              <>
                <div className="p-4 bg-white/3 border border-white/5 rounded-[14px]">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-[#3A6DFF]" />
                    <h4 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Cliente</h4>
                  </div>
                  <div className="space-y-2.5">
                    <div className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
                      {booking.customer.name}
                    </div>
                    {booking.customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                        <Phone className="h-4 w-4 text-[#9ca3af]" />
                        <span>{booking.customer.phone}</span>
                      </div>
                    )}
                    {booking.customer.email && (
                      <div className="flex items-center gap-2 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                        <Mail className="h-4 w-4 text-[#9ca3af]" />
                        <span>{booking.customer.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notas internas del cliente (IA) */}
                {booking.customer.internal_notes && (
                  <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-[14px]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🤖</span>
                      <h4 className="text-sm font-semibold text-amber-300 font-['Plus_Jakarta_Sans']">Notas para IA y Staff</h4>
                    </div>
                    <p className="text-sm text-white/90 font-['Plus_Jakarta_Sans'] leading-relaxed whitespace-pre-wrap">
                      {booking.customer.internal_notes}
                    </p>
                    <p className="mt-2 text-xs text-amber-300/70 font-['Plus_Jakarta_Sans']">
                      💡 La IA de voz usa estas notas para personalizar las llamadas
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="p-4 bg-white/3 border border-white/5 rounded-[14px]">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-[#4FE3C1]" />
                <h4 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Detalles</h4>
              </div>
              <div className="space-y-3">
                {booking.service && (
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[#9ca3af]" />
                      <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Servicio</span>
                    </div>
                    <div className="text-sm text-white font-semibold font-['Plus_Jakarta_Sans']">
                      {booking.service.name} ({(booking.service.duration_min)} min)
                    </div>
                  </div>
                )}
                {booking.staff && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#9ca3af]" />
                      <span className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Barbero</span>
                    </div>
                    <div className="text-sm text-white font-semibold font-['Plus_Jakarta_Sans']">{booking.staff.name}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha: Acciones */}
          <div className="space-y-2">
            {onEdit && (
              <Button onClick={() => onEdit(booking)} className="w-full justify-start">
                <Edit className="h-4 w-4" /> Editar cita
              </Button>
            )}
            {onDelete && (
              <>
                {!showDeleteConfirm ? (
                  <Button
                    variant="danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full justify-start"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar cita
                  </Button>
                ) : (
                  <div className="p-3 rounded-[14px] bg-[rgba(239,68,68,0.08)] border border-[#EF4444]/30 space-y-2">
                    <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                      ¿Eliminar esta cita?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleDelete}
                        className="flex-1"
                      >
                        Eliminar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {ToastComponent}
    </Modal>
  );

  return (
    <>
      {/* Desktop modal visible en md+ */}
      <div className="hidden md:block">{DesktopModal}</div>
      {/* Mobile drawer visible en md- */}
      <div className="md:hidden">{MobileDrawer}</div>
    </>
  );
}

