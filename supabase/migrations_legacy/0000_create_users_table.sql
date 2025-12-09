-- 0000_create_users_table.sql
-- Crea la tabla users si no existe, para soporte de migraciones legacy

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  role text NOT NULL
);
