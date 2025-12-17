"use client";

import { GlassModal, GlassButton, GlassBadge } from "@/components/ui/glass";
import { Service } from "../types";
import { getServiceTotalDuration } from "@/lib/services";

type Props = {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (service: Service) => void;
  onDuplicate: (service: Service) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (service: Service) => void;
  onSyncStripe?: (service: Service) => void;
  syncingServiceId?: string | null;
};

const formatPrice = (priceCents: number) =>
  `${(priceCents / 100).toFixed(2)} €`;

export function ServicePreviewModal({
  service,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
  onSyncStripe,
  syncingServiceId,
}: Props) {
  if (!service) return null;

  const stripeSynced = Boolean(
    service.stripe_product_id && service.stripe_price_id
  );

  const pricingEntries = Object.entries(service.pricing_levels ?? {}).filter(
    ([, value]) => typeof value === "number" && value !== null
  );

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Resumen del servicio"
      description="Detalles, precios y configuración del servicio."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <GlassButton variant="danger" onClick={() => onDelete(service)}>
            Eliminar
          </GlassButton>
          <div className="flex flex-wrap gap-2">
            <GlassButton variant="secondary" onClick={() => onDuplicate(service)}>
              Duplicar
            </GlassButton>
            <GlassButton variant="secondary" onClick={() => onEdit(service)}>
              Editar
            </GlassButton>
            <GlassButton
              variant={service.active ? "danger" : "primary"}
              onClick={() => onToggleActive(service.id, service.active)}
            >
              {service.active ? "Desactivar" : "Activar"}
            </GlassButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-white">
        <div>
          <h3 className="text-xl font-semibold">{service.name}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{service.category ?? "Otros"}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Duración total</p>
            <p className="mt-2 text-lg font-semibold">
              {service.duration_min} min
              {service.buffer_min ? ` + ${service.buffer_min} min buffer` : ""}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Total: {getServiceTotalDuration(service)} min
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Precio base</p>
            <p className="mt-2 text-lg font-semibold">
              {formatPrice(service.price_cents)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-[var(--text-secondary)] uppercase">
            Precios por nivel
          </p>
          {pricingEntries.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              No hay tarifas diferenciadas. Todos los niveles usan el precio
              base.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pricingEntries.map(([level, value]) => (
                <div key={level}>
                  <p className="text-sm text-[var(--text-secondary)] capitalize">{level}</p>
                  <p className="text-base font-semibold">
                    {value ? formatPrice(value) : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <GlassBadge variant={service.active ? "success" : "neutral"}>
            {service.active ? "Activo" : "Inactivo"}
          </GlassBadge>

          <GlassBadge variant={stripeSynced ? "success" : "warning"}>
            {stripeSynced ? "Stripe sincronizado" : "Stripe pendiente"}
          </GlassBadge>

          {!stripeSynced && onSyncStripe && (
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={() => onSyncStripe(service)}
              isLoading={syncingServiceId === service.id}
              disabled={syncingServiceId === service.id}
            >
              {syncingServiceId === service.id
                ? "Sincronizando..."
                : "Sincronizar con Stripe"}
            </GlassButton>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          La sincronización individual con Stripe estará disponible en breve.
        </p>
        <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-4">
          <p className="text-xs text-[var(--text-secondary)] uppercase">Roadmap</p>
          <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <div>
              <span className="font-semibold text-white">Descripción:</span>{" "}
              {service.description?.trim()
                ? service.description
                : "Pendiente de definir."}
            </div>
            <div>
              <span className="font-semibold text-white">VIP tier:</span>{" "}
              {service.vip_tier ?? "standard"}
            </div>
            <div>
              <span className="font-semibold text-white">Servicios combinados:</span>{" "}
              {service.combo_service_ids && service.combo_service_ids.length > 0
                ? service.combo_service_ids.join(", ")
                : "sin configurar"}
            </div>
            <div>
              <span className="font-semibold text-white">Staff específico:</span>{" "}
              {service.assignedStaffIds && service.assignedStaffIds.length > 0
                ? service.assignedStaffIds.join(", ")
                : "cualquiera"}
            </div>
          </div>
        </div>
      </div>
    </GlassModal>
  );
}

