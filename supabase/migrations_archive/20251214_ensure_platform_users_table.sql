-- 20251214_ensure_platform_users_table.sql
-- Crea la tabla platform.platform_users con todas sus columnas críticas si no existe
CREATE SCHEMA IF NOT EXISTS platform;
CREATE TABLE IF NOT EXISTS platform.platform_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'support', 'viewer')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
-- Asegura la columna 'active' existe
ALTER TABLE platform.platform_users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
