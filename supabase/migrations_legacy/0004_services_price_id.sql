alter table public.services
  add column if not exists stripe_price_id text,
  add column if not exists stripe_product_id text;

