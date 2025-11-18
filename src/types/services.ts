export type PricingLevels = Record<string, number | null>;

export type Service = {
  id: string;
  tenant_id: string;
  name: string;
  duration_min: number;
  buffer_min: number;
  price_cents: number;
  active: boolean;
  category: string | null;
  pricing_levels: PricingLevels | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  description?: string | null;
  media_url?: string | null;
  vip_tier?: "standard" | "vip" | "premium" | null;
  combo_service_ids?: string[] | null;
  staff_only_ids?: string[] | null;
  duration_variants?: {
    min: number;
    max: number;
  } | null;
};

export const DEFAULT_CATEGORY = "Otros";

export const DEFAULT_PRICING_LEVELS: PricingLevels = {
  standard: null,
  junior: null,
  senior: null,
  master: null,
};

