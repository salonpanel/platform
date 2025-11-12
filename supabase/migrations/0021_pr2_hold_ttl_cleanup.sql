-- 0021_pr2_hold_ttl_cleanup.sql
-- PR2: TTL de holds + función de limpieza automática

-- 1) Añadir expires_at a bookings si no existe
alter table public.bookings 
  add column if not exists expires_at timestamptz;

-- Índice para limpieza eficiente de holds expirados
create index if not exists idx_bookings_hold_expires 
  on public.bookings(expires_at) 
  where status = 'pending' and expires_at is not null;

-- 2) Función de limpieza: cancela holds expirados
create or replace function public.release_expired_holds()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  -- Actualizar holds expirados a cancelled
  with updated as (
    update public.bookings
    set status = 'cancelled',
        expires_at = null
    where status = 'pending'
      and expires_at is not null
      and now() >= expires_at
    returning 1
  )
  select count(*) into v_count from updated;
  
  return v_count;
end;
$$;

comment on function public.release_expired_holds is 
  'Cancela holds expirados (status=pending con expires_at pasado) y libera slots. Retorna el número de holds cancelados.';

-- 3) También actualizar appointments si existe (legacy)
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    -- Añadir expires_at a appointments si no existe
    alter table public.appointments 
      add column if not exists expires_at timestamptz;
    
    -- Índice para appointments
    create index if not exists idx_appointments_hold_expires 
      on public.appointments(expires_at) 
      where status = 'hold' and expires_at is not null;
    
    -- Función de limpieza para appointments (legacy)
    create or replace function public.release_expired_appointments()
    returns integer
    language plpgsql
    security definer
    as $$
    declare
      v_count integer;
    begin
      with updated as (
        update public.appointments
        set status = 'cancelled',
            expires_at = null
        where status = 'hold'
          and expires_at is not null
          and now() >= expires_at
        returning 1
      )
      select count(*) into v_count from updated;
      
      return v_count;
    end;
    $$;
    
    comment on function public.release_expired_appointments is 
      'Cancela appointments en hold expirados (legacy). Retorna el número de holds cancelados.';
  end if;
end $$;

-- 4) Función unificada que limpia ambos (bookings y appointments)
create or replace function public.cleanup_expired_holds()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_bookings_count integer;
  v_appointments_count integer;
begin
  -- Limpiar bookings
  select public.release_expired_holds() into v_bookings_count;
  
  -- Limpiar appointments si existe
  v_appointments_count := 0;
  if exists (
    select 1 from information_schema.routines 
    where routine_schema = 'public' 
      and routine_name = 'release_expired_appointments'
  ) then
    select public.release_expired_appointments() into v_appointments_count;
  end if;
  
  return jsonb_build_object(
    'bookings_cancelled', v_bookings_count,
    'appointments_cancelled', v_appointments_count,
    'total', v_bookings_count + v_appointments_count
  );
end;
$$;

comment on function public.cleanup_expired_holds is 
  'Limpia holds expirados en bookings y appointments (legacy). Retorna estadísticas de limpieza.';

