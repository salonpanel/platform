-- 0029_add_customer_fields.sql
-- Añadir campos birth_date y notes a customers

alter table public.customers
  add column if not exists birth_date date,
  add column if not exists notes text;

comment on column public.customers.birth_date is 'Fecha de nacimiento del cliente (opcional, para fidelización y marketing)';
comment on column public.customers.notes is 'Notas internas sobre el cliente';








