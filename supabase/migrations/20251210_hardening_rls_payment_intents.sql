-- 0029_hardening_rls_payment_intents.sql
-- Hardening: Eliminar política pública de insert en payment_intents
-- Todas las escrituras deben pasar por el backend usando service_role

-- Solo ejecutar si la tabla payment_intents existe
do $$
begin
  -- Verificar si la tabla existe antes de intentar eliminar la política
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'payment_intents'
  ) then
    -- Eliminar política pública de creación
    drop policy if exists "public_create_payment_intents" on public.payment_intents;
  end if;
end $$;

-- Mantener solo política de lectura para usuarios del tenant
-- (La política tenant_read_payment_intents ya existe y es correcta)

-- Comentario: A partir de ahora, todas las operaciones de escritura (insert/update)
-- en payment_intents deben hacerse desde el backend usando supabaseServer()
-- (que usa SERVICE_ROLE_KEY), no desde el cliente.

-- Añadir comentario solo si la tabla existe
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = 'payment_intents'
  ) then
    comment on table public.payment_intents is 
      'Intentos de pago (mock o reales) para reservas. Estado: requires_payment -> paid -> booking creado. 
       IMPORTANTE: Solo el backend puede crear/actualizar payment_intents usando service_role. 
       Los usuarios solo pueden leer payment_intents de su tenant.';
  end if;
end $$;

