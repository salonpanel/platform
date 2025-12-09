"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Service } from "../types";
import { ServiceStatusBadge } from "./ServiceStatusBadge";
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resumen del servicio"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="danger" onClick={() => onDelete(service)}>
            Eliminar
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onDuplicate(service)}>
              Duplicar
            </Button>
            <Button variant="secondary" onClick={() => onEdit(service)}>
              Editar
            </Button>
            <Button
              variant={service.active ? "danger" : "primary"}
              onClick={() => onToggleActive(service.id, service.active)}
            >
              {service.active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-white">
        <div>
          <p className="text-sm text-white/60 uppercase tracking-wide">
            Información
          </p>
          <h3 className="mt-2 text-xl font-semibold">{service.name}</h3>
          <p className="text-sm text-white/70">{service.category ?? "Otros"}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[12px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60 uppercase">Duración total</p>
            <p className="mt-2 text-lg font-semibold">
              {service.duration_min} min
              {service.buffer_min ? ` + ${service.buffer_min} min buffer` : ""}
            </p>
            <p className="text-xs text-white/60">
              Total: {getServiceTotalDuration(service)} min
            </p>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60 uppercase">Precio base</p>
            <p className="mt-2 text-lg font-semibold">
              {formatPrice(service.price_cents)}
            </p>
          </div>
        </div>

        <div className="rounded-[12px] border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/60 uppercase">
            Precios por nivel
          </p>
          {pricingEntries.length === 0 ? (
            <p className="mt-2 text-sm text-white/70">
              No hay tarifas diferenciadas. Todos los niveles usan el precio
              base.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pricingEntries.map(([level, value]) => (
                <div key={level}>
                  <p className="text-sm text-white/70 capitalize">{level}</p>
                  <p className="text-base font-semibold">
                    {value ? formatPrice(value) : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <ServiceStatusBadge
            label={service.active ? "Activo" : "Inactivo"}
            tone={service.active ? "success" : "neutral"}
          />
          <ServiceStatusBadge
            label={
              stripeSynced ? "Stripe sincronizado" : "Stripe pendiente"
            }
            tone={stripeSynced ? "success" : "warning"}
          />
          {!stripeSynced && onSyncStripe && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSyncStripe(service)}
              isLoading={syncingServiceId === service.id}
              disabled={syncingServiceId === service.id}
            >
              {syncingServiceId === service.id
                ? "Sincronizando..."
                : "Sincronizar con Stripe"}
            </Button>
          )}
        </div>
        <p className="text-xs text-white/60">
          La sincronización individual con Stripe estará disponible en breve.
        </p>
        <div className="rounded-[12px] border border-dashed border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/60 uppercase">Roadmap</p>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            <div>
              <span className="font-semibold">Descripción:</span>{" "}
              {service.description?.trim()
                ? service.description
                : "Pendiente de definir."}
            </div>
            <div>
              <span className="font-semibold">VIP tier:</span>{" "}
              {service.vip_tier ?? "standard"}
            </div>
            <div>
              <span className="font-semibold">Servicios combinados:</span>{" "}
              {service.combo_service_ids && service.combo_service_ids.length > 0
                ? service.combo_service_ids.join(", ")
                : "sin configurar"}
            </div>
            <div>
              <span className="font-semibold">Staff específico:</span>{" "}
              {/* Mostrar info canónica: staff asignado vía staff_provides_services */}
              {service.assignedStaffIds && service.assignedStaffIds.length > 0
                ? service.assignedStaffIds.join(", ")
                : "cualquiera"}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

