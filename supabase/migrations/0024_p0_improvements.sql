-- 0024_p0_improvements.sql
-- Mejoras P0 según especificaciones operativas

-- P0.1: Mejorar idempotencia Stripe
-- Asegurar que la tabla tiene índices para métricas
create index if not exists idx_stripe_events_processed_type_created 
  on public.stripe_events_processed(event_type, created_at desc);

-- P0.2: Mejorar función de limpieza de holds
-- Asegurar que limpia correctamente holds expirados (bookings + appointments)
create or replace function public.release_expired_holds()
returns int
language plpgsql
security definer
as $$
declare
  v_bookings_count int := 0;
  v_appointments_count int := 0;
begin
  -- Actualizar holds expirados en bookings a cancelled
  update public.bookings
  set status = 'cancelled',
      expires_at = null,
      updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
  
  get diagnostics v_bookings_count = row_count;
  
  -- También limpiar appointments (legacy) si existe
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    update public.appointments
    set status = 'cancelled',
        expires_at = null,
        updated_at = now()
    where status = 'hold'
      and expires_at is not null
      and expires_at < now();
    
    get diagnostics v_appointments_count = row_count;
  end if;
  
  -- Retornar el total de holds liberados
  return v_bookings_count + v_appointments_count;
end;
$$;

comment on function public.release_expired_holds is 
  'Libera holds expirados cambiándolos a cancelled. Retorna el número de holds liberados.';




-- Eliminar todas las variantes posibles de la función check_staff_availability
drop function if exists public.check_staff_availability(uuid, timestamp with time zone, timestamp with time zone);
drop function if exists public.check_staff_availability(uuid, uuid, timestamptz, timestamptz);
drop function if exists public.check_staff_availability(uuid, uuid, timestamp with time zone, timestamp with time zone);
drop function if exists public.check_staff_availability(uuid, uuid, timestamp, timestamp);
drop function if exists public.check_staff_availability(uuid, uuid, pg_catalog.timestamptz, pg_catalog.timestamptz);
drop function if exists public.check_staff_availability(uuid, uuid, pg_catalog.timestamp, pg_catalog.timestamp);

create or replace function public.check_staff_availability(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_overlap_count integer;
begin
  -- Verificar solapes en bookings (nuevo modelo)
  select count(*) into v_overlap_count
  from public.bookings
  where tenant_id = p_tenant_id
    and staff_id = p_staff_id
    and status in ('pending', 'paid')
    and tstzrange(p_starts_at, p_ends_at, '[)') && slot;
  
  if v_overlap_count > 0 then
    return false;
  end if;
  
  -- Verificar solapes en appointments si existe (legacy)
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    select count(*) into v_overlap_count
    from public.appointments
    where org_id = p_tenant_id
      and staff_id = p_staff_id
      and status in ('hold', 'confirmed')
      and tstzrange(p_starts_at, p_ends_at, '[)') && slot;
    
    if v_overlap_count > 0 then
      return false;
    end if;
  end if;
  
  return true;
end;
$$;

comment on function public.check_staff_availability is 
  'Verifica si un staff está disponible en un rango de tiempo para un tenant específico. Retorna true si está disponible, false si hay solape. Incluye tenant_id para aislamiento multi-tenant.';

-- P0.3: Función helper para obtener mensaje de error 409
create or replace function public.get_overlap_error_message(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns text
language plpgsql
security definer
stable
as $$
declare
  v_staff_name text;
  v_message text;
begin
  -- Obtener nombre del staff
  select display_name into v_staff_name
  from public.staff
  where id = p_staff_id
    and tenant_id = p_tenant_id;
  
  if v_staff_name is null then
    v_staff_name := 'barbero';
  end if;
  
  -- Construir mensaje de error
  v_message := format(
    'El intervalo seleccionado para %s ya está ocupado. Por favor, elige otro horario.',
    v_staff_name
  );
  
  return v_message;
end;
$$;

comment on function public.get_overlap_error_message is 
  'Genera un mensaje de error amigable para solapes de slots. Incluye el nombre del staff.';

