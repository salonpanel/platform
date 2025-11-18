-- 0013_create_first_platform_admin.sql
-- Script para crear el primer platform admin
-- NOTA: Ejecuta esto manualmente después de crear tu usuario en auth.users
-- Reemplaza 'YOUR_USER_ID_HERE' con el UUID de tu usuario de auth.users

-- Ejemplo de uso:
-- 1. Crea un usuario en Supabase Dashboard > Authentication > Users
-- 2. Copia el UUID del usuario
-- 3. Ejecuta este script reemplazando YOUR_USER_ID_HERE con el UUID

-- INSERT INTO platform.platform_users (id, email, name, role, active)
-- VALUES (
--   'YOUR_USER_ID_HERE', -- UUID del usuario de auth.users
--   'admin@tu-dominio.com', -- Email del admin
--   'Administrador Principal', -- Nombre
--   'admin', -- Rol: 'admin', 'support', o 'viewer'
--   true -- Activo
-- );

-- Función helper para crear platform admin (opcional, para uso desde API)
create or replace function public.create_platform_admin(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role text default 'admin'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_admin_id uuid;
begin
  -- Verificar que el usuario existe en auth.users (solo service_role puede hacerlo)
  -- Por ahora, confiamos en que se pasa el ID correcto
  
  insert into platform.platform_users (id, email, name, role, active)
  values (p_user_id, p_email, p_name, p_role, true)
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    active = true
  returning id into v_admin_id;
  
  return v_admin_id;
end;
$$;







