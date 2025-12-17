-- 0062_auto_access_admin_email.sql
-- Configura acceso automático sin magic link para u0136986872@gmail.com
-- Este usuario tendrá acceso completo como platform admin y podrá acceder a cualquier interfaz
--
-- INSTRUCCIONES:
-- 1. PRIMERO: Crea el usuario manualmente en Supabase Dashboard > Authentication > Users
--    - Email: u0136986872@gmail.com
--    - Auto-confirm: ON (para que no necesite magic link)
-- 2. Luego ejecuta este script para configurarlo como platform admin
-- 3. Si el usuario ya existe, este script lo actualizará automáticamente

-- Función para configurar usuario existente como platform admin
CREATE OR REPLACE FUNCTION public.setup_admin_user_access(p_email text)
RETURNS TABLE(
  user_id uuid,
  email text,
  email_confirmed boolean,
  is_platform_admin boolean,
  platform_role text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_user_exists boolean;
  v_now timestamptz := now();
BEGIN
  -- Buscar usuario por email
  SELECT u.id, (u.email_confirmed_at IS NOT NULL) INTO v_user_id, v_user_exists
  FROM auth.users u
  WHERE u.email = p_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::uuid as user_id,
      p_email::text as email,
      false as email_confirmed,
      false as is_platform_admin,
      'none'::text as platform_role,
      'Usuario no encontrado. Crea el usuario primero en Supabase Dashboard > Authentication > Users con Auto-confirm activado.'::text as message;
    RETURN;
  END IF;

  -- Confirmar email si no está confirmado (requiere permisos elevados)
  BEGIN
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, v_now),
      confirmed_at = COALESCE(confirmed_at, v_now),
      updated_at = v_now
    WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Si no se puede actualizar auth.users directamente, continuar
    RAISE NOTICE 'No se pudo actualizar auth.users directamente. El usuario debe estar confirmado manualmente.';
  END;

  -- Asegurar que esté en platform.platform_users como admin
  INSERT INTO platform.platform_users (id, email, name, role, active)
  VALUES (
    v_user_id,
    p_email,
    COALESCE(split_part(p_email, '@', 1), 'Admin'),
    'admin',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, platform.platform_users.name),
    role = 'admin',
    active = true;

  -- También actualizar por email si el ID cambió
  UPDATE platform.platform_users pu
  SET 
    id = v_user_id,
    role = 'admin',
    active = true
  WHERE pu.email = p_email AND pu.id != v_user_id;

  -- Crear/actualizar perfil en public.profiles si la tabla existe
  -- Usar EXECUTE para evitar ambigüedad con la columna user_id de retorno
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    BEGIN
      EXECUTE 'INSERT INTO public.profiles (user_id, created_at) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING'
        USING v_user_id, v_now;
    EXCEPTION WHEN OTHERS THEN
      -- Si hay conflicto o error, ignorar silenciosamente
      NULL;
    END;
  END IF;

  -- Retornar estado final
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    (u.email_confirmed_at IS NOT NULL) as email_confirmed,
    EXISTS(SELECT 1 FROM platform.platform_users pu WHERE pu.id = u.id AND pu.active = true) as is_platform_admin,
    COALESCE(pu.role, 'none')::text as platform_role,
    'Usuario configurado correctamente como platform admin.'::text as message
  FROM auth.users u
  LEFT JOIN platform.platform_users pu ON pu.id = u.id
  WHERE u.id = v_user_id;
END;
$$;

COMMENT ON FUNCTION public.setup_admin_user_access(text) IS 
'Configura un usuario existente como platform admin con acceso completo.
Requiere que el usuario ya exista en auth.users (creado manualmente o por magic link).';

-- Ejecutar la configuración para el email específico
DO $$
DECLARE
  v_result record;
BEGIN
  SELECT * INTO v_result FROM public.setup_admin_user_access('u0136986872@gmail.com');
  
  IF v_result.user_id IS NULL THEN
    RAISE WARNING '%', v_result.message;
    RAISE NOTICE '';
    RAISE NOTICE 'PASOS PARA CREAR EL USUARIO:';
    RAISE NOTICE '1. Ve a Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '2. Click en "Add User" o "Invite User"';
    RAISE NOTICE '3. Email: u0136986872@gmail.com';
    RAISE NOTICE '4. Activa "Auto Confirm User" (esto evita el magic link)';
    RAISE NOTICE '5. Guarda el usuario';
    RAISE NOTICE '6. Vuelve a ejecutar este script';
  ELSE
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Usuario Admin Configurado:';
    RAISE NOTICE '  ID: %', v_result.user_id;
    RAISE NOTICE '  Email: %', v_result.email;
    RAISE NOTICE '  Email Confirmado: %', v_result.email_confirmed;
    RAISE NOTICE '  Platform Admin: %', v_result.is_platform_admin;
    RAISE NOTICE '  Rol: %', v_result.platform_role;
    RAISE NOTICE '========================================';
    
    IF NOT v_result.email_confirmed THEN
      RAISE WARNING 'El email no está confirmado. El usuario puede necesitar confirmar manualmente o usar magic link una vez.';
    END IF;
    
    IF NOT v_result.is_platform_admin THEN
      RAISE WARNING 'No se pudo configurar como platform admin. Verifica los permisos.';
    END IF;
  END IF;
END;
$$;

-- Función helper para verificar el estado del usuario admin
CREATE OR REPLACE FUNCTION public.check_admin_user_status()
RETURNS TABLE(
  user_id uuid,
  email text,
  email_confirmed boolean,
  is_platform_admin boolean,
  platform_role text,
  profile_exists boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    (u.email_confirmed_at IS NOT NULL) as email_confirmed,
    EXISTS(SELECT 1 FROM platform.platform_users pu WHERE pu.id = u.id AND pu.active = true) as is_platform_admin,
    COALESCE(pu.role, 'none')::text as platform_role,
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id = u.id) as profile_exists
  FROM auth.users u
  LEFT JOIN platform.platform_users pu ON pu.id = u.id
  WHERE u.email = 'u0136986872@gmail.com';
END;
$$;

COMMENT ON FUNCTION public.check_admin_user_status() IS 
'Verifica el estado completo del usuario admin u0136986872@gmail.com. 
Útil para diagnosticar problemas de acceso.';

-- Mostrar estado final
SELECT * FROM public.check_admin_user_status();

