-- 0103_bookings_service_nullable_on_delete_set_null.sql
-- Permitir eliminar servicios archivados incluso si tienen reservas PASADAS,
-- manteniendo integridad referencial en bookings y bloqueando si hay reservas FUTURAS.
--
-- Cambio principal:
-- - bookings.service_id deja de ser NOT NULL
-- - foreign key pasa de ON DELETE RESTRICT a ON DELETE SET NULL
--
-- IMPORTANTE:
-- - La API de hard delete de servicios ya comprueba y bloquea la eliminación
--   si existen reservas FUTURAS para ese servicio (starts_at >= now()).
-- - Este cambio solo permite eliminar servicios cuando solo quedan reservas PASADAS.

begin;

-- Asegurarse de que la tabla existe antes de tocar nada
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'bookings'
  ) then
    raise notice 'Tabla public.bookings no existe, nada que modificar';
    return;
  end if;
end $$;

-- 1) Eliminar la foreign key actual (ON DELETE RESTRICT)
alter table public.bookings
  drop constraint if exists bookings_service_id_fkey;

-- 2) Permitir valores NULL en service_id para bookings históricos
alter table public.bookings
  alter column service_id drop not null;

-- 3) Crear de nuevo la foreign key usando ON DELETE SET NULL
alter table public.bookings
  add constraint bookings_service_id_fkey
  foreign key (service_id)
  references public.services(id)
  on delete set null;

commit;
