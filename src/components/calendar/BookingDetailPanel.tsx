"use client";

import { useState } from "react";
import { Edit, Trash2, Phone, Mail, Calendar, User, Tag } from "lucide-react";
import { UiModal, UiButton, UiBadge } from "@/components/ui/apple-ui-kit";
import { formatInTenantTz } from "@/lib/timezone";
import { Booking } from "@/types/agenda";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

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

  const BookingContent = () => (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className={cn(
        "p-4 rounded-xl border backdrop-blur-sm",
        "bg-gradient-to-br from-[var(--accent-blue-glass)] to-[var(--accent-aqua-glass)]",
        "border-[var(--glass-border)]"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={cn(
              "text-xs uppercase tracking-wider font-semibold",
              "text-[var(--text-tertiary)] font-[var(--font-heading)]"
            )}>
              Cita
            </p>
            <p className={cn(
              "text-lg font-semibold",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
            )}>
              {booking.customer?.name || "Sin cliente"}
            </p>
          </div>
          <UiBadge tone="info" soft>
            {booking.status}
          </UiBadge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-[var(--glass-border-subtle)]">
          <div>
            <p className={cn(
              "text-xs uppercase tracking-wider font-semibold mb-1",
              "text-[var(--text-tertiary)] font-[var(--font-heading)]"
            )}>
              Fecha
            </p>
            <p className={cn(
              "text-sm font-semibold",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
            )}>
              {dateShort}
            </p>
          </div>
          <div>
            <p className={cn(
              "text-xs uppercase tracking-wider font-semibold mb-1",
              "text-[var(--text-tertiary)] font-[var(--font-heading)]"
            )}>
              Horario
            </p>
            <p className={cn(
              "text-sm font-semibold",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
            )}>
              {startTime} - {endTime}
            </p>
          </div>
          {booking.service && (
            <div>
              <p className={cn(
                "text-xs uppercase tracking-wider font-semibold mb-1",
                "text-[var(--text-tertiary)] font-[var(--font-heading)]"
              )}>
                Precio
              </p>
              <p className={cn(
                "text-sm font-semibold",
                "text-[var(--text-primary)] font-[var(--font-heading)]"
              )}>
                {(booking.service.price_cents / 100).toFixed(2)} €
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Information */}
        {booking.customer && (
          <div className="space-y-4">
            <div className={cn(
              "p-4 rounded-xl border",
              "bg-[var(--glass-bg-default)] border-[var(--glass-border)]"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-[var(--accent-blue)]" />
                <h4 className={cn(
                  "text-sm font-semibold",
                  "text-[var(--text-primary)] font-[var(--font-heading)]"
                )}>
                  Cliente
                </h4>
              </div>
              <div className="space-y-2.5">
                <div className={cn(
                  "text-base font-semibold",
                  "text-[var(--text-primary)] font-[var(--font-heading)]"
                )}>
                  {booking.customer.name}
                </div>
                {booking.customer.phone && (
                  <div className={cn(
                    "flex items-center gap-2 text-sm",
                    "text-[var(--text-secondary)] font-[var(--font-body)]"
                  )}>
                    <Phone className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <span>{booking.customer.phone}</span>
                  </div>
                )}
                {booking.customer.email && (
                  <div className={cn(
                    "flex items-center gap-2 text-sm",
                    "text-[var(--text-secondary)] font-[var(--font-body)]"
                  )}>
                    <Mail className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <span>{booking.customer.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Notes - Preserve special styling */}
            {booking.customer.internal_notes && (
              <div className={cn(
                "p-4 rounded-xl border backdrop-blur-sm",
                "bg-gradient-to-br from-amber-500/10 to-amber-600/5",
                "border-amber-500/30"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🤖</span>
                  <h4 className={cn(
                    "text-sm font-semibold text-amber-300",
                    "font-[var(--font-heading)]"
                  )}>
                    Notas para IA y Staff
                  </h4>
                </div>
                <p className={cn(
                  "text-sm leading-relaxed whitespace-pre-wrap",
                  "text-white/90 font-[var(--font-body)]"
                )}>
                  {booking.customer.internal_notes}
                </p>
                <p className={cn(
                  "mt-2 text-xs",
                  "text-amber-300/70 font-[var(--font-body)]"
                )}>
                  💡 La IA de voz usa estas notas para personalizar las llamadas
                </p>
              </div>
            )}
          </div>
        )}

        {/* Service Details */}
        <div className="space-y-4">
          <div className={cn(
            "p-4 rounded-xl border",
            "bg-[var(--glass-bg-default)] border-[var(--glass-border)]"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-[var(--accent-aqua)]" />
              <h4 className={cn(
                "text-sm font-semibold",
                "text-[var(--text-primary)] font-[var(--font-heading)]"
              )}>
                Detalles
              </h4>
            </div>
            <div className="space-y-3">
              {booking.service && (
                <div className={cn(
                  "flex items-center justify-between py-2 border-b",
                  "border-[var(--glass-border-subtle)]"
                )}>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      "text-[var(--text-tertiary)] font-[var(--font-heading)]"
                    )}>
                      Servicio
                    </span>
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    "text-[var(--text-primary)] font-[var(--font-heading)]"
                  )}>
                    {booking.service.name} ({booking.service.duration_min} min)
                  </div>
                </div>
              )}
              {booking.staff && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--text-tertiary)]" />
                    <span className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      "text-[var(--text-tertiary)] font-[var(--font-heading)]"
                    )}>
                      Barbero
                    </span>
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    "text-[var(--text-primary)] font-[var(--font-heading)]"
                  )}>
                    {booking.staff.name}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ActionButtons = () => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {onEdit && (
          <UiButton
            variant="ghost"
            size="sm"
            onClick={() => onEdit(booking)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </UiButton>
        )}
        {onDelete && (
          <UiButton
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </UiButton>
        )}
      </div>
      <UiButton
        variant="ghost"
        size="sm"
        onClick={onClose}
      >
        Cerrar
      </UiButton>
    </div>
  );

  return (
    <>
      <UiModal
        open={isOpen}
        onClose={onClose}
        title="Detalles de la cita"
        size="lg"
        footer={<ActionButtons />}
      >
        <BookingContent />
      </UiModal>

      {/* Delete Confirmation Modal - Keep separate */}
      {showDeleteConfirm && (
        <UiModal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Confirmar eliminación"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-3">
              <UiButton
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </UiButton>
              <UiButton
                variant="danger"
                onClick={handleDelete}
              >
                Eliminar cita
              </UiButton>
            </div>
          }
        >
          <p className="text-[var(--text-secondary)]">
            ¿Estás seguro de que deseas eliminar esta cita con {booking.customer?.name || "el cliente"}?
            Esta acción no se puede deshacer.
          </p>
        </UiModal>
      )}

      {ToastComponent}
    </>
  );
}

