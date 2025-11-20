-- ============================================================================
-- SCRIPT DE VERIFICACIÓN DE TENANT Y MEMBERSHIP
-- ============================================================================
-- Este script verifica que el tenant demo existe y que el usuario tiene membership
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- IMPORTANTE: Reemplaza 'u0136986872@gmail.com' con tu email de prueba si es diferente

-- A) Confirmar que el tenant demo existe
SELECT 
  'Tenant demo' as check_item,
  id,
  name,
  slug,
  timezone,
  created_at,
  CASE 
    WHEN id IS NOT NULL THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as status
FROM public.tenants
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- B) Confirmar que el usuario logueado tiene membership
--    Sustituye el email por el que ESTÁS usando en el login (el de Supabase Auth)
SELECT 
  'Membership del usuario' as check_item,
  m.id as membership_id,
  m.tenant_id,
  m.user_id,
  m.role,
  u.email,
  t.name as tenant_name,
  t.slug as tenant_slug,
  CASE 
    WHEN m.id IS NOT NULL THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as status
FROM auth.users u
LEFT JOIN public.memberships m ON m.user_id = u.id
LEFT JOIN public.tenants t ON t.id = m.tenant_id
WHERE u.email = 'u0136986872@gmail.com';  -- cambia aquí si toca

-- C) Si falta membership, ejecuta esto (descomenta si es necesario):
/*
INSERT INTO public.memberships (tenant_id, user_id, role)
SELECT 
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, -- tenant demo
  id,                                          -- id del usuario
  'owner'
FROM auth.users
WHERE email = 'u0136986872@gmail.com'           -- ajusta email
ON CONFLICT (tenant_id, user_id) 
DO UPDATE SET role = 'owner';
*/

-- D) Verificación final: ¿Puede el usuario leer el tenant?
--    Esto simula lo que hace el cliente cuando consulta /rest/v1/tenants
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_count int;
BEGIN
  -- Obtener user_id del email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ Usuario no encontrado';
    RETURN;
  END IF;

  -- Simular la consulta que hace el cliente (con RLS activo)
  -- Nota: Esto solo funciona si ejecutas como el usuario autenticado
  -- En el SQL Editor, esto puede no funcionar porque no estás autenticado como ese usuario
  -- Pero sirve para verificar la estructura
  
  RAISE NOTICE '✅ Usuario encontrado: %', v_user_id;
  RAISE NOTICE '📋 Para verificar RLS, prueba desde el cliente (navegador)';
  RAISE NOTICE '   La consulta debería devolver 1 fila si RLS está correcto';
END $$;








