-- Script para crear la tabla memberships y vincular usuario al tenant demo
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Crear tabla memberships si no existe
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','staff','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 2. Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON public.memberships(tenant_id, user_id);

-- 3. Habilitar RLS si no está habilitado
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS básicas si no existen
-- Política para que los usuarios vean sus propios memberships
DO $$
BEGIN
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
END $$;

-- Política para que admins puedan gestionar memberships de su tenant
DO $$
BEGIN
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

-- 5. Vincular usuario al tenant demo
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
    RAISE EXCEPTION 'Usuario con email u0136986872@gmail.com no encontrado en auth.users. Verifica que el usuario existe en Authentication > Users';
  END IF;

  -- Verificar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant demo (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa) no encontrado. Asegúrate de que las migraciones de seeds se han aplicado.';
  END IF;

  -- Crear membership si no existe
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id) 
  DO UPDATE SET role = 'owner';

  RAISE NOTICE '✅ Usuario % vinculado al tenant demo con rol owner', v_user_id;
END $$;

-- 6. Verificar que se creó correctamente
SELECT 
  m.id as membership_id,
  m.tenant_id,
  m.user_id,
  m.role,
  t.name as tenant_name,
  t.slug as tenant_slug,
  u.email as user_email,
  m.created_at
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com';








