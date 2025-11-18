import {
  DEFAULT_CATEGORY as BASE_DEFAULT_CATEGORY,
  DEFAULT_PRICING_LEVELS as BASE_DEFAULT_PRICING_LEVELS,
  type PricingLevels,
  type Service as ServiceRecord,
} from "@/types/services";

export type Service = ServiceRecord;
export type { PricingLevels };

export const DEFAULT_CATEGORY = BASE_DEFAULT_CATEGORY;
export const DEFAULT_PRICING_LEVELS = BASE_DEFAULT_PRICING_LEVELS;

export type ServiceFormState = {
  name: string;
  duration_min: number;
  buffer_min: number;
  price_cents: number;
  category: string;
  pricing_levels: PricingLevels;
  active: boolean;
  description: string;
  media_url: string;
  vip_tier: "standard" | "vip" | "premium";
  combo_service_ids: string[];
  staff_only_ids: string[];
  duration_variants: {
    min: number;
    max: number;
  } | null;
};

export type ServiceFilters = {
  status: "all" | "active" | "inactive";
  stripe: "all" | "synced" | "pending";
  category: string;
  priceRange: [number, number];
  buffer: "all" | "no_buffer";
};

export type SortOption = "name" | "duration" | "price";

