-- 20251213_fix_platform_users_active_column.sql
-- Asegura que la columna 'active' existe en platform.platform_users
ALTER TABLE platform.platform_users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
