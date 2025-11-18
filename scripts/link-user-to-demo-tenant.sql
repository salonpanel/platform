-- Script para vincular un usuario al tenant demo
-- ⚠️ IMPORTANTE: Si obtienes error "relation memberships does not exist", 
--    usa el script: scripts/create-memberships-and-link-user.sql
--    que crea la tabla primero y luego vincula el usuario.

-- 1. Obtener el ID del usuario desde su email
-- Reemplaza 'u0136986872@gmail.com' con el email del usuario que quieres vincular
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; -- ID del tenant demo
BEGIN
  -- Buscar el usuario por email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  -- Si no se encuentra el usuario, mostrar error
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario con email u0136986872@gmail.com no encontrado en auth.users';
  END IF;

  -- Crear membership si no existe
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) 
  DO UPDATE SET role = 'owner';

  RAISE NOTICE 'Usuario % vinculado al tenant demo con rol owner', v_user_id;
END $$;

-- 2. Verificar que se creó correctamente
SELECT 
  m.id,
  m.tenant_id,
  m.user_id,
  m.role,
  t.name as tenant_name,
  t.slug as tenant_slug,
  u.email as user_email
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com';

