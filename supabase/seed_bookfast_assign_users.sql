-- ============================================================================
-- HELPER: Obtener User IDs y Asignar Memberships
-- ============================================================================
-- Este script te ayuda a:
-- 1. Ver los usuarios existentes en auth.users
-- 2. Asignar esos usuarios como owners del tenant BookFast
--
-- PASO 1: Ejecutar la query de consulta
-- PASO 2: Copiar los UUIDs que necesites
-- PASO 3: Descomentar y ejecutar los INSERT con tus UUIDs
-- ============================================================================

-- ============================================================================
-- CONSULTA: Ver usuarios existentes
-- ============================================================================
-- Ejecutar esta query primero para ver qué usuarios tienes

SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- EJEMPLO DE RESULTADO:
-- ============================================================================
-- id                                   | email              | created_at          | full_name
-- -------------------------------------|--------------------|--------------------|------------
-- 12345678-1234-1234-1234-123456789abc | tu@email.com       | 2024-01-15 10:30:00 | Tu Nombre
-- 87654321-4321-4321-4321-cba987654321 | socio@email.com    | 2024-01-10 09:15:00 | Socio Nombre

-- ============================================================================
-- INSTRUCCIONES:
-- ============================================================================
-- 1. Ejecuta la query anterior
-- 2. Identifica tus usuarios (tú y tu socio)
-- 3. Copia los UUIDs (columna 'id')
-- 4. Reemplaza USER_ID_1 y USER_ID_2 abajo con los UUIDs reales
-- 5. Descomenta (quita los --) y ejecuta el bloque siguiente

-- ============================================================================
-- ASIGNAR MEMBERSHIPS: Descomentar y ejecutar después de obtener IDs
-- ============================================================================

/*
-- Reemplazar estos UUIDs con los reales de la query anterior:
DO $$
DECLARE
<<<<<<< Updated upstream
  v_tenant_id UUID := 'bf000000-0000-0000-0000-000000000001'; -- BookFast tenant ID
  v_user_id_1 UUID := 'REEMPLAZAR_CON_TU_USER_ID';           -- Tu usuario
  v_user_id_2 UUID := 'REEMPLAZAR_CON_SOCIO_USER_ID';        -- Usuario de tu socio
=======
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'; -- BookFast tenant ID
  v_user_id_1 UUID := 'db57dbd2-9a8c-4050-b77f-e2236300f448';  -- josep@bookfast.es
  v_user_id_2 UUID := 'e86c7e6e-71eb-48df-b7ff-451dec05ad8b';  -- sergi@bookfast.es
  v_staff_id_1 UUID := '00000002-0000-0000-0000-000000000001'; -- Josep (Owner/Senior)
  v_staff_id_2 UUID := '00000002-0000-0000-0000-000000000002'; -- Socio (Owner/Maestro)
  v_email_1 TEXT;
  v_email_2 TEXT;
  v_full_name_1 TEXT;
  v_full_name_2 TEXT;
>>>>>>> Stashed changes
BEGIN
  -- Obtener datos de auth.users (por si se necesitan después)
  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_email_1, v_full_name_1
  FROM auth.users
  WHERE id = v_user_id_1;
  
  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_email_2, v_full_name_2
  FROM auth.users
  WHERE id = v_user_id_2;
  
  -- Nota: Insertamos en public.users con id y tenant_id, ya que tenant_id es NOT NULL
  INSERT INTO public.users (id, tenant_id)
  VALUES (v_user_id_1, v_tenant_id)
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.users (id, tenant_id)
  VALUES (v_user_id_2, v_tenant_id)
  ON CONFLICT (id) DO NOTHING;
  -- Asignar primer usuario como owner
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id_1, 'owner')
  ON CONFLICT (tenant_id, user_id) 
  DO UPDATE SET role = 'owner', created_at = NOW();
  
  RAISE NOTICE 'Usuario 1 asignado como owner: %', v_user_id_1;
  
  -- Asignar segundo usuario como owner
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id_2, 'owner')
  ON CONFLICT (tenant_id, user_id) 
  DO UPDATE SET role = 'owner', created_at = NOW();
  
  RAISE NOTICE 'Usuario 2 asignado como owner: %', v_user_id_2;
  
  -- Crear permisos completos para ambos usuarios
  INSERT INTO public.user_permissions (user_id, tenant_id, permissions)
  VALUES 
    (v_user_id_1, v_tenant_id, '{
      "dashboard": true,
      "agenda": true,
      "clientes": true,
      "servicios": true,
      "staff": true,
      "marketing": true,
      "reportes": true,
      "ajustes": true
    }'::jsonb),
    (v_user_id_2, v_tenant_id, '{
      "dashboard": true,
      "agenda": true,
      "clientes": true,
      "servicios": true,
      "staff": true,
      "marketing": true,
      "reportes": true,
      "ajustes": true
    }'::jsonb)
  ON CONFLICT (user_id, tenant_id) 
  DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    updated_at = NOW();
  
  RAISE NOTICE 'Permisos asignados para ambos usuarios';
  
  -- Crear o actualizar profiles
  INSERT INTO public.profiles (user_id, default_org_id)
  VALUES 
    (v_user_id_1, v_tenant_id),
    (v_user_id_2, v_tenant_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    default_org_id = EXCLUDED.default_org_id,
    updated_at = NOW();
  
  RAISE NOTICE 'Profiles actualizados con default_org_id';
  
END $$;
*/

-- ============================================================================
-- VALIDACIÓN: Verificar memberships creadas
-- ============================================================================
-- Ejecutar después de crear las memberships para verificar

/*
SELECT 
  m.tenant_id,
  t.name as tenant_name,
  m.user_id,
  u.email,
  m.role,
  m.created_at
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE m.tenant_id = 'bf000000-0000-0000-0000-000000000001'
ORDER BY m.created_at DESC;
*/

-- ============================================================================
-- ALTERNATIVA: Si solo tienes un usuario
-- ============================================================================
-- Si solo quieres asignarte a ti mismo (sin socio):

/*
INSERT INTO public.memberships (tenant_id, user_id, role)
VALUES (
  'bf000000-0000-0000-0000-000000000001',
  'REEMPLAZAR_CON_TU_USER_ID',
  'owner'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';

INSERT INTO public.user_permissions (user_id, tenant_id, permissions)
VALUES (
  'REEMPLAZAR_CON_TU_USER_ID',
  'bf000000-0000-0000-0000-000000000001',
  '{
    "dashboard": true,
    "agenda": true,
    "clientes": true,
    "servicios": true,
    "staff": true,
    "marketing": true,
    "reportes": true,
    "ajustes": true
  }'::jsonb
)
ON CONFLICT (user_id, tenant_id) DO UPDATE SET permissions = EXCLUDED.permissions;
*/

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Si no ves usuarios en auth.users, puede que necesites crearlos primero
-- desde la interfaz de Supabase Auth o mediante signup.

-- Para verificar si la función app.current_tenant_id() funciona correctamente:
/*
SELECT app.current_tenant_id();
-- Debería retornar: bf000000-0000-0000-0000-000000000001
*/

-- Si retorna NULL, verifica que tu usuario esté en memberships:
/*
SELECT * FROM public.memberships WHERE user_id = auth.uid();
*/
