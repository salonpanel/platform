-- 0104_services_staff_only_ids.sql
-- Añade columna staff_only_ids a services para limitar qué miembros del staff pueden prestar un servicio.
-- Pensado para usarse tanto desde la página de Staff como desde la página de Servicios.

begin;

-- 1) Asegurar columna staff_only_ids en services (array de uuid)
alter table public.services
  add column if not exists staff_only_ids uuid[];

-- Nota: dejamos staff_only_ids como NULL por defecto.
-- Semántica en la app:
-- - NULL o array vacío => servicio disponible para cualquier staff que provides_services = true.
-- - Array con ids => solo esos staff pueden prestar este servicio.

-- 2) Índice opcional para consultas por staff (future-proofing)
create index if not exists idx_services_staff_only_ids
  on public.services using gin (staff_only_ids);

commit;
