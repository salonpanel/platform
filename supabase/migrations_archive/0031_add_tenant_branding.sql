-- 0031_add_tenant_branding.sql
-- Añadir campos de branding y contacto a tenants

alter table public.tenants
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#4cb3ff',
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address text,
  add column if not exists portal_url text;

comment on column public.tenants.logo_url is 'URL del logo de la barbería';
comment on column public.tenants.primary_color is 'Color primario de la marca (hex)';
comment on column public.tenants.contact_email is 'Email de contacto público';
comment on column public.tenants.contact_phone is 'Teléfono de contacto público';
comment on column public.tenants.address is 'Dirección física de la barbería';
comment on column public.tenants.portal_url is 'URL del portal público de reservas (/r/[slug])';

-- Generar portal_url automáticamente si no existe
update public.tenants
set portal_url = '/r/' || slug
where portal_url is null and slug is not null;








