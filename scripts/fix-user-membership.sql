-- Script para diagnosticar y corregir el problema de membership
-- Ejecutar en Supabase SQL Editor
-- Este script obtiene automáticamente el user_id del email

-- 1. Verificar y corregir automáticamente
DO $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_membership_count integer;
  v_tenant_count integer;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  rec RECORD;
BEGIN
  -- Obtener el ID del usuario por email
  SELECT id, email INTO v_user_id, v_user_email
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró usuario con email: u0136986872@gmail.com';
    RAISE NOTICE '💡 Verifica que el email sea correcto o cambia el email en el script';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Usuario encontrado: % (ID: %)', v_user_email, v_user_id;

  -- Verificar memberships existentes
  SELECT COUNT(*) INTO v_membership_count
  FROM public.memberships
  WHERE user_id = v_user_id;

  RAISE NOTICE '📊 Memberships encontrados: %', v_membership_count;

  IF v_membership_count > 0 THEN
    RAISE NOTICE '✅ El usuario ya tiene % membership(s):', v_membership_count;
    
    -- Mostrar los memberships existentes
    FOR rec IN
      SELECT tenant_id, role, created_at
      FROM public.memberships
      WHERE user_id = v_user_id
    LOOP
      RAISE NOTICE '   - Tenant: %, Role: %, Creado: %', rec.tenant_id, rec.role, rec.created_at;
    END LOOP;
  ELSE
    RAISE NOTICE '⚠️ El usuario NO tiene ningún membership';
  END IF;

  -- Verificar si existe el tenant
  SELECT COUNT(*) INTO v_tenant_count
  FROM public.tenants
  WHERE id = v_tenant_id;

  IF v_tenant_count = 0 THEN
    RAISE NOTICE '⚠️ El tenant % NO existe, creándolo...', v_tenant_id;
    
    -- Crear el tenant si no existe
    INSERT INTO public.tenants (id, name, slug, timezone)
    VALUES (
      v_tenant_id,
      'Barbería Demo',
      'barberia-demo',
      'Europe/Madrid'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE '✅ Tenant creado exitosamente';
  ELSE
    RAISE NOTICE '✅ El tenant % ya existe', v_tenant_id;
  END IF;

  -- Verificar si ya existe membership para este tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_user_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE NOTICE '📝 Creando membership: usuario -> tenant (owner)...';
    
    INSERT INTO public.memberships (user_id, tenant_id, role)
    VALUES (
      v_user_id,
      v_tenant_id,
      'owner'
    )
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
    
    RAISE NOTICE '✅ Membership creado exitosamente';
  ELSE
    RAISE NOTICE 'ℹ️ Ya existe membership para este tenant, no se creó uno nuevo';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🎉 Proceso completado. El usuario ahora debería poder acceder al panel.';

END $$;

-- 2. Verificar el resultado final
SELECT 
  u.email as usuario_email,
  u.id as usuario_id,
  m.tenant_id,
  m.role as rol,
  t.name as tenant_nombre,
  t.slug as tenant_slug,
  m.created_at as membership_creado
FROM auth.users u
LEFT JOIN public.memberships m ON m.user_id = u.id
LEFT JOIN public.tenants t ON t.id = m.tenant_id
WHERE u.email = 'u0136986872@gmail.com'
ORDER BY m.created_at DESC;

