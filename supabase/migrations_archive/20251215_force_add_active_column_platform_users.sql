-- 20251215_force_add_active_column_platform_users.sql
-- Fuerza la adición de la columna 'active' en platform.platform_users si no existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'platform' AND table_name = 'platform_users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'platform' AND table_name = 'platform_users' AND column_name = 'active'
    ) THEN
      EXECUTE 'ALTER TABLE platform.platform_users ADD COLUMN active boolean DEFAULT true';
    END IF;
  END IF;
END $$;
