-- 0072_add_user_profiles_and_nicknames.sql
-- Extiende perfiles de usuario y añade sistema de apodos personalizados

-- 1. Extender tabla profiles con campos de perfil personalizable
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.profiles.display_name IS 'Nombre personalizado del usuario (sobrescribe el de staff si existe)';
COMMENT ON COLUMN public.profiles.profile_photo_url IS 'URL de la foto de perfil del usuario';
COMMENT ON COLUMN public.profiles.bio IS 'Biografía o descripción personal del usuario';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.profiles_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_update_updated_at();

-- 2. Crear tabla para apodos personalizados (nombres que un usuario ve para otro)
CREATE TABLE IF NOT EXISTS public.user_display_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(viewer_user_id, target_user_id)
);

COMMENT ON TABLE public.user_display_names IS 'Nombres personalizados que un usuario ve para otros usuarios (apodos)';
COMMENT ON COLUMN public.user_display_names.custom_name IS 'Nombre personalizado que viewer_user_id ve para target_user_id';

CREATE INDEX IF NOT EXISTS idx_user_display_names_viewer ON public.user_display_names(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_user_display_names_target ON public.user_display_names(target_user_id);

-- Habilitar RLS
ALTER TABLE public.user_display_names ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_display_names
-- Solo puedes ver tus propios apodos
DROP POLICY IF EXISTS user_display_names_select ON public.user_display_names;
CREATE POLICY user_display_names_select
ON public.user_display_names
FOR SELECT
TO authenticated
USING (viewer_user_id = auth.uid());

-- Solo puedes crear/actualizar tus propios apodos
DROP POLICY IF EXISTS user_display_names_insert ON public.user_display_names;
CREATE POLICY user_display_names_insert
ON public.user_display_names
FOR INSERT
TO authenticated
WITH CHECK (viewer_user_id = auth.uid());

DROP POLICY IF EXISTS user_display_names_update ON public.user_display_names;
CREATE POLICY user_display_names_update
ON public.user_display_names
FOR UPDATE
TO authenticated
USING (viewer_user_id = auth.uid())
WITH CHECK (viewer_user_id = auth.uid());

DROP POLICY IF EXISTS user_display_names_delete ON public.user_display_names;
CREATE POLICY user_display_names_delete
ON public.user_display_names
FOR DELETE
TO authenticated
USING (viewer_user_id = auth.uid());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.user_display_names_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_display_names_updated_at ON public.user_display_names;
CREATE TRIGGER trg_user_display_names_updated_at
  BEFORE UPDATE ON public.user_display_names
  FOR EACH ROW
  EXECUTE FUNCTION public.user_display_names_update_updated_at();

-- 3. Función helper para obtener el nombre a mostrar de un usuario
-- Prioridad: apodo personalizado > profile.display_name > staff.display_name > staff.name > email
CREATE OR REPLACE FUNCTION public.get_user_display_name(
  p_viewer_user_id UUID,
  p_target_user_id UUID,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custom_name TEXT;
  v_profile_name TEXT;
  v_staff_name TEXT;
  v_staff_display_name TEXT;
  v_email TEXT;
BEGIN
  -- 1. Buscar apodo personalizado
  SELECT custom_name INTO v_custom_name
  FROM public.user_display_names
  WHERE viewer_user_id = p_viewer_user_id
    AND target_user_id = p_target_user_id;

  IF v_custom_name IS NOT NULL THEN
    RETURN v_custom_name;
  END IF;

  -- 2. Buscar nombre en profile
  SELECT display_name INTO v_profile_name
  FROM public.profiles
  WHERE user_id = p_target_user_id;

  IF v_profile_name IS NOT NULL AND v_profile_name != '' THEN
    RETURN v_profile_name;
  END IF;

  -- 3. Buscar en staff
  SELECT s.display_name, s.name INTO v_staff_display_name, v_staff_name
  FROM public.staff s
  WHERE s.user_id = p_target_user_id
    AND s.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_staff_display_name IS NOT NULL AND v_staff_display_name != '' THEN
    RETURN v_staff_display_name;
  END IF;

  IF v_staff_name IS NOT NULL AND v_staff_name != '' THEN
    RETURN v_staff_name;
  END IF;

  -- 4. Fallback: email
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_target_user_id;

  IF v_email IS NOT NULL THEN
    RETURN SPLIT_PART(v_email, '@', 1);
  END IF;

  RETURN CONCAT('Usuario ', LEFT(p_target_user_id::text, 8));
END;
$$;

COMMENT ON FUNCTION public.get_user_display_name(UUID, UUID, UUID) IS 'Obtiene el nombre a mostrar de un usuario según prioridad: apodo > profile > staff > email';

GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID, UUID, UUID) TO authenticated;

-- 4. Función helper para obtener foto de perfil
CREATE OR REPLACE FUNCTION public.get_user_profile_photo(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_photo TEXT;
  v_staff_photo TEXT;
BEGIN
  -- 1. Buscar en profile
  SELECT profile_photo_url INTO v_profile_photo
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_profile_photo IS NOT NULL AND v_profile_photo != '' THEN
    RETURN v_profile_photo;
  END IF;

  -- 2. Buscar en staff
  SELECT profile_photo_url INTO v_staff_photo
  FROM public.staff
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
  LIMIT 1;

  RETURN v_staff_photo;
END;
$$;

COMMENT ON FUNCTION public.get_user_profile_photo(UUID, UUID) IS 'Obtiene la foto de perfil de un usuario (profile > staff)';

GRANT EXECUTE ON FUNCTION public.get_user_profile_photo(UUID, UUID) TO authenticated;

