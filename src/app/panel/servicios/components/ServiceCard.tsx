"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Service } from "../types";
import { ServiceStatusBadge } from "./ServiceStatusBadge";
import { getServiceTotalDuration } from "@/lib/services";

type Props = {
  service: Service;
  onPreview: (service: Service) => void;
  onEdit: (service: Service) => void;
  onDuplicate: (service: Service) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
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
        className="flex h-full cursor-pointer flex-col gap-4 rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass transition hover:glow-card"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-white truncate">
              {service.name}
            </p>
            <p className="text-xs text-white/60">
              {service.category ?? "Otros"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ServiceStatusBadge
              label={service.active ? "Activo" : "Inactivo"}
              tone={service.active ? "success" : "neutral"}
            />
            <ServiceStatusBadge
              label={stripeSynced ? "Stripe listo" : "Stripe pendiente"}
              tone={stripeSynced ? "success" : "warning"}
            />
          </div>
        </div>
        <div className="space-y-1 text-sm text-white/80">
          <div className="flex items-center justify-between text-white">
            <span className="text-2xl font-semibold">
              {formatPrice(service.price_cents)}
            </span>
            <span className="text-xs text-white/70">
              {service.duration_min} min{bufferText}
            </span>
          </div>
          <p className="text-xs text-white/60">Total: {totalDuration} min</p>
          {pricingEntries.length > 0 && (
            <p className="text-xs text-white/60">
              {pricingEntries
                .map(([level, value]) => `${level}: ${formatPrice(value)}`)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <Button variant="ghost" size="sm" onClick={() => onEdit(service)}>
              Editar
            </Button>
          </span>
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDuplicate(service)}
            >
              Duplicar
            </Button>
          </span>
          <span
            className="contents"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              variant={service.active ? "secondary" : "primary"}
              size="sm"
              isLoading={isToggling}
              disabled={isToggling}
              onClick={() => onToggleActive(service.id, service.active)}
            >
              {service.active ? "Desactivar" : "Activar"}
            </Button>
          </span>
        </div>
      </div>
    </motion.div>
  );
});

ServiceCard.displayName = "ServiceCard";

