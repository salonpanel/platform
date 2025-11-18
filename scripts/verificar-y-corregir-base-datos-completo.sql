-- ============================================================================
-- SCRIPT COMPLETO DE VERIFICACIÓN Y CORRECCIÓN DE BASE DE DATOS
-- ============================================================================
-- Este script verifica y crea/corrige TODO lo necesario para que /panel funcione
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAR Y CREAR ESQUEMA APP
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================================
-- PARTE 2: VERIFICAR Y CREAR TABLA TENANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Añadir columnas que pueden faltar
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Madrid';

-- Generar slugs únicos para tenants sin slug
DO $$
DECLARE
  r record;
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  FOR r IN SELECT id, name FROM public.tenants WHERE slug IS NULL OR slug = '' LOOP
    base_slug := lower(regexp_replace(r.name, '[^a-z0-9]+', '-', 'g'));
    final_slug := base_slug;
    counter := 0;
    
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = final_slug AND id != r.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    
    UPDATE public.tenants SET slug = final_slug WHERE id = r.id;
  END LOOP;
END $$;

-- Añadir constraint unique de slug si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_slug_key'
  ) THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Crear índice de slug si no existe
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);

-- ============================================================================
-- PARTE 3: VERIFICAR Y CREAR TABLA MEMBERSHIPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','staff','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON public.memberships(tenant_id, user_id);

-- Habilitar RLS si no está habilitado
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS básicas si no existen
DO $$
BEGIN
  -- Política para que los usuarios vean sus propios memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'memberships' 
    AND policyname = 'users_read_own_memberships'
  ) THEN
    CREATE POLICY "users_read_own_memberships" ON public.memberships
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  -- Política para que admins puedan gestionar memberships de su tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'memberships' 
    AND policyname = 'admins_manage_memberships'
  ) THEN
    CREATE POLICY "admins_manage_memberships" ON public.memberships
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.memberships m2
        WHERE m2.user_id = auth.uid()
        AND m2.tenant_id = memberships.tenant_id
        AND m2.role IN ('owner', 'admin')
      )
    );
  END IF;
END $$;

-- ============================================================================
-- PARTE 4: CREAR/ACTUALIZAR FUNCIÓN app.current_tenant_id()
-- ============================================================================
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Primero intentar buscar en memberships
  SELECT tenant_id INTO v_tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si no se encuentra en memberships, intentar en users (compatibilidad)
  IF v_tenant_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
      SELECT tenant_id INTO v_tenant_id
      FROM public.users
      WHERE id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.current_tenant_id IS 
  'Retorna el tenant_id del usuario actual basado en memberships. Si el usuario tiene múltiples tenants, retorna el primero.';

-- ============================================================================
-- PARTE 5: CORREGIR POLÍTICAS RLS DE TENANTS
-- ============================================================================
-- Habilitar RLS si no está habilitado
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "users_read_tenant_membership" ON public.tenants;
DROP POLICY IF EXISTS "public_read_tenants" ON public.tenants;

-- Crear política simple que use memberships directamente
CREATE POLICY "tenant_read_tenants" ON public.tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.memberships 
    WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = tenants.id
  )
);

-- ============================================================================
-- PARTE 6: CREAR TENANT DEMO SI NO EXISTE
-- ============================================================================
INSERT INTO public.tenants (id, slug, name, timezone)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'barberia-demo', 'Barbería Demo', 'Europe/Madrid')
ON CONFLICT (id) DO UPDATE
SET 
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  timezone = COALESCE(EXCLUDED.timezone, tenants.timezone);

-- ============================================================================
-- PARTE 7: VINCULAR USUARIO DE PRUEBA AL TENANT DEMO
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_membership_exists boolean;
BEGIN
  -- Buscar el usuario por email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  -- Si no se encuentra el usuario, mostrar advertencia
  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ Usuario con email u0136986872@gmail.com no encontrado en auth.users';
    RAISE NOTICE '   Verifica que el usuario existe en Authentication > Users';
    RAISE NOTICE '   O crea el usuario primero desde el panel de Supabase';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Usuario encontrado: %', v_user_id;

  -- Verificar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant demo (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa) no encontrado. Esto no debería pasar.';
  END IF;

  RAISE NOTICE '✅ Tenant demo existe';

  -- Verificar si ya existe membership
  SELECT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id
  ) INTO v_membership_exists;

  IF v_membership_exists THEN
    RAISE NOTICE '✅ Membership ya existe, actualizando rol a owner...';
    UPDATE public.memberships 
    SET role = 'owner'
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id;
  ELSE
    RAISE NOTICE '📝 Creando membership...';
    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'owner');
  END IF;

  RAISE NOTICE '✅ Usuario % vinculado al tenant demo con rol owner', v_user_id;
END $$;

-- ============================================================================
-- PARTE 8: VERIFICACIÓN FINAL
-- ============================================================================
DO $$
DECLARE
  v_tenant_exists boolean;
  v_membership_exists boolean;
  v_user_exists boolean;
  v_function_exists boolean;
  v_policy_exists boolean;
  v_user_id uuid;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN FINAL';
  RAISE NOTICE '========================================';

  -- Verificar tenant
  SELECT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = v_tenant_id
  ) INTO v_tenant_exists;
  
  RAISE NOTICE 'Tenant demo existe: %', CASE WHEN v_tenant_exists THEN '✅' ELSE '❌' END;

  -- Verificar usuario
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';
  
  v_user_exists := v_user_id IS NOT NULL;
  RAISE NOTICE 'Usuario existe: %', CASE WHEN v_user_exists THEN '✅' ELSE '❌' END;

  -- Verificar membership
  IF v_user_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM public.memberships 
      WHERE tenant_id = v_tenant_id AND user_id = v_user_id
    ) INTO v_membership_exists;
    
    RAISE NOTICE 'Membership existe: %', CASE WHEN v_membership_exists THEN '✅' ELSE '❌' END;
  ELSE
    v_membership_exists := false;
    RAISE NOTICE 'Membership existe: ❌ (usuario no encontrado)';
  END IF;

  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'app'
    AND routine_name = 'current_tenant_id'
  ) INTO v_function_exists;
  
  RAISE NOTICE 'Función app.current_tenant_id existe: %', CASE WHEN v_function_exists THEN '✅' ELSE '❌' END;

  -- Verificar política RLS
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'tenants'
    AND policyname = 'tenant_read_tenants'
  ) INTO v_policy_exists;
  
  RAISE NOTICE 'Política RLS tenant_read_tenants existe: %', CASE WHEN v_policy_exists THEN '✅' ELSE '❌' END;

  -- Resumen
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  IF v_tenant_exists AND v_user_exists AND v_membership_exists AND v_function_exists AND v_policy_exists THEN
    RAISE NOTICE '✅ TODO CORRECTO - La base de datos está lista';
    RAISE NOTICE '   Puedes recargar /panel en el navegador';
  ELSE
    RAISE NOTICE '⚠️ ALGUNOS ELEMENTOS FALTAN';
    RAISE NOTICE '   Revisa los errores arriba y corrige manualmente';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTE 9: MOSTRAR ESTADO ACTUAL
-- ============================================================================
SELECT 
  'Estado actual' as seccion,
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.timezone as tenant_timezone,
  u.email as user_email,
  m.role as user_role,
  m.created_at as membership_created
FROM public.tenants t
LEFT JOIN public.memberships m ON m.tenant_id = t.id
LEFT JOIN auth.users u ON u.id = m.user_id
WHERE t.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY m.created_at DESC;






