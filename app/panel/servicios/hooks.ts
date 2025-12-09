"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CATEGORY,
  DEFAULT_PRICING_LEVELS,
  type PricingLevels,
  type Service,
} from "@/types/services";

export { DEFAULT_CATEGORY, DEFAULT_PRICING_LEVELS };
import type {
  ServiceFormState,
  ServiceFilters,
  SortOption,
} from "./types";
import { getServiceTotalDuration } from "@/lib/services";

export const DEFAULT_FORM_STATE: ServiceFormState = {
  name: "",
  duration_min: 30,
  buffer_min: 0,
  price_cents: 2500,
  category: DEFAULT_CATEGORY,
  pricing_levels: { ...DEFAULT_PRICING_LEVELS },
  active: true,
  description: "",
  media_url: "",
  vip_tier: "standard",
  combo_service_ids: [],
  duration_variants: null,
};

export const SERVICE_PRESET_CATEGORIES = [
  "Corte",
  "Barba",
  "Color",
  "Tratamientos",
  "Pack Corte + Barba",
  DEFAULT_CATEGORY,
] as const;

export function buildDefaultFormState(): ServiceFormState {
  return {
    ...DEFAULT_FORM_STATE,
    pricing_levels: { ...DEFAULT_PRICING_LEVELS },
  };
}

export function normalizeService(service: Service): Service {
  return {
    ...service,
    buffer_min: service.buffer_min ?? 0,
    category: service.category ?? DEFAULT_CATEGORY,
    pricing_levels: {
      ...DEFAULT_PRICING_LEVELS,
      ...(service.pricing_levels ?? {}),
    },
    description: service.description ?? "",
    media_url: service.media_url ?? "",
    vip_tier: service.vip_tier ?? "standard",
    combo_service_ids: service.combo_service_ids ?? [],
    duration_variants: service.duration_variants ?? null,
  };
}

const hasStripeSync = (service: Service) =>
  Boolean(service.stripe_product_id && service.stripe_price_id);

export function useServiceStats(services: Service[]) {
  return useMemo(() => {
    const total = services.length;
    const activeCount = services.filter((service) => service.active).length;
    const inactiveCount = total - activeCount;
    const syncedCount = services.filter(hasStripeSync).length;
    const pendingCount = total - syncedCount;

    const priceSum = services.reduce(
      (sum, service) => sum + service.price_cents,
      0
    );
    const durationSum = services.reduce(
      (sum, service) => sum + service.duration_min,
      0
    );
    const totalDurationSum = services.reduce(
      (sum, service) => sum + getServiceTotalDuration(service),
      0
    );

    const priceAvg = total ? priceSum / total / 100 : 0;
    const durationAvg = total ? durationSum / total : 0;
    const totalDurationAvg = total ? totalDurationSum / total : 0;

    const withoutCategory = services.filter(
      (service) =>
        !service.category ||
        service.category.trim().length === 0 ||
        service.category === DEFAULT_CATEGORY
    ).length;
    const withoutBuffer = services.filter(
      (service) => (service.buffer_min ?? 0) === 0
    ).length;

    return {
      total,
      activeCount,
      inactiveCount,
      syncedCount,
      pendingCount,
      priceAvg,
      durationAvg,
      totalDurationAvg,
      withoutCategory,
      withoutBuffer,
    };
  }, [services]);
}

const buildPricingSearchString = (pricing?: PricingLevels | null) => {
  if (!pricing) return "";
  return Object.values(pricing)
    .filter((value): value is number => typeof value === "number")
    .map((value) => (value / 100).toFixed(2))
    .join(" ");
};

export function useFilteredServices({
  items,
  filters,
  searchTerm,
  sortBy,
}: {
  items: Service[];
  filters: ServiceFilters;
  searchTerm: string;
  sortBy: SortOption;
}) {
  return useMemo(() => {
    const term = searchTerm.toLowerCase();

    const matchesSearch = (service: Service) => {
      if (!term) return true;
      const pricingString = buildPricingSearchString(service.pricing_levels);
      return (
        service.name.toLowerCase().includes(term) ||
        (service.category ?? DEFAULT_CATEGORY).toLowerCase().includes(term) ||
        pricingString.includes(term)
      );
    };

    const filtered = items.filter((service) => {
      if (filters.status === "active" && !service.active) return false;
      if (filters.status === "inactive" && service.active) return false;

      const synced = hasStripeSync(service);
      if (filters.stripe === "synced" && !synced) return false;
      if (filters.stripe === "pending" && synced) return false;

      const category = service.category ?? DEFAULT_CATEGORY;
      if (filters.category !== "all" && category !== filters.category) {
        return false;
      }

      const price = service.price_cents / 100;
      if (
        price < filters.priceRange[0] ||
        price > filters.priceRange[1]
      ) {
        return false;
      }

      if (
        filters.buffer === "no_buffer" &&
        (service.buffer_min ?? 0) > 0
      ) {
        return false;
      }

      return matchesSearch(service);
    });

    filtered.sort((a, b) => {
      if (sortBy === "duration") {
        return a.duration_min - b.duration_min;
      }
      if (sortBy === "price") {
        return a.price_cents - b.price_cents;
      }
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });

    return filtered;
  }, [items, filters, searchTerm, sortBy]);
}

export function usePagination<T>(items: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    setCurrentPage,
  };
}

