"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { GlassButton, GlassBadge } from "@/components/ui/glass";
import { Service } from "../types";
import { getServiceTotalDuration } from "@/lib/services";

type Props = {
  service: Service;
  onPreview: (service: Service) => void;
  onEdit: (service: Service) => void;
  onDuplicate: (service: Service) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (service: Service) => void;
  isToggling: boolean;
};

const formatPrice = (priceCents: number) =>
  `${(priceCents / 100).toFixed(2)} €`;

export const ServiceCard = memo(function ServiceCard({
  service,
  onPreview,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
  isToggling,
}: Props) {
  const stripeSynced = Boolean(
    service.stripe_product_id && service.stripe_price_id
  );
  const bufferText = service.buffer_min
    ? ` + ${service.buffer_min} min buffer`
    : "";
  const totalDuration = getServiceTotalDuration(service);

  const pricingEntries = useMemo(
    () =>
      Object.entries(service.pricing_levels ?? {}).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && entry[1] !== null
      ),
    [service.pricing_levels]
  );

  const handleCardClick = () => onPreview(service);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="h-full"
    >
      <div
        className="flex h-full cursor-pointer flex-col gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 shadow-sm transition-all hover:bg-white/[0.05] hover:border-white/10 hover:shadow-md hover:scale-[1.01]"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-white truncate font-satoshi">
              {service.name}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {service.category ?? "Otros"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <GlassBadge variant={service.active ? "success" : "neutral"}>
              {service.active ? "Activo" : "Inactivo"}
            </GlassBadge>
            <GlassBadge variant={stripeSynced ? "success" : "warning"}>
              {stripeSynced ? "Stripe listo" : "Stripe pendiente"}
            </GlassBadge>
          </div>
        </div>
        <div className="space-y-1 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center justify-between text-white">
            <span className="text-2xl font-semibold font-satoshi">
              {formatPrice(service.price_cents)}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {service.duration_min} min{bufferText}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">Total: {totalDuration} min</p>
          {pricingEntries.length > 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              {pricingEntries
                .map(([level, value]) => `${level}: ${formatPrice(value)}`)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 border-t border-white/5 pt-3">
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <GlassButton variant="ghost" size="sm" onClick={() => onEdit(service)}>
              Editar
            </GlassButton>
          </span>
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => onDuplicate(service)}
            >
              Duplicar
            </GlassButton>
          </span>
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <GlassButton
              variant={service.active ? "secondary" : "primary"}
              size="sm"
              isLoading={isToggling}
              disabled={isToggling}
              onClick={() => onToggleActive(service.id, service.active)}
            >
              {service.active ? "Desactivar" : "Activar"}
            </GlassButton>
          </span>
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <GlassButton
              variant="danger"
              size="sm"
              isLoading={isToggling}
              disabled={isToggling}
              onClick={() => onDelete(service)}
            >
              {service.active ? "Archivar" : "Eliminar"}
            </GlassButton>
          </span>
        </div>
      </div>
    </motion.div>
  );
});

ServiceCard.displayName = "ServiceCard";

