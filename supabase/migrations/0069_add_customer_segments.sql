-- Adds segmentation fields to customers

alter table public.customers
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists is_vip boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists marketing_opt_in boolean not null default true;

-- If there are helper views/materializations that mirror customers (e.g. customer_stats),
-- ensure their definitions are rebuilt elsewhere to include these columns.

