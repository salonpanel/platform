-- Add buffer_min, category y pricing_levels a services si no existieran
alter table public.services
  add column if not exists buffer_min integer default 0;

alter table public.services
  alter column buffer_min set not null;

update public.services
set buffer_min = 0
where buffer_min is null;

alter table public.services
  add column if not exists category text default 'Otros';

update public.services
set category = 'Otros'
where category is null;

alter table public.services
  alter column category set not null;

alter table public.services
  add column if not exists pricing_levels jsonb;



