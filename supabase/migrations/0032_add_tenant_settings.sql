-- 0032_add_tenant_settings.sql
-- Tabla para configuraciones específicas de cada tenant

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Protección contra ausencias (no-show)
  no_show_protection_enabled boolean DEFAULT false,
  no_show_protection_mode text CHECK (no_show_protection_mode IN ('deposit', 'cancellation')) DEFAULT 'deposit',
  no_show_protection_percentage int DEFAULT 10 CHECK (no_show_protection_percentage >= 0 AND no_show_protection_percentage <= 100),
  no_show_cancellation_hours int DEFAULT 12 CHECK (no_show_cancellation_hours >= 0),
  
  -- Otras configuraciones futuras pueden ir aquí
  -- Ejemplo: auto_confirm_bookings, default_booking_duration, etc.
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Un tenant solo puede tener un registro de settings
  UNIQUE(tenant_id)
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON public.tenant_settings(tenant_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tenant_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger solo si no existe
DROP TRIGGER IF EXISTS trigger_update_tenant_settings_updated_at ON public.tenant_settings;
CREATE TRIGGER trigger_update_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_settings_updated_at();

-- RLS: Solo usuarios del tenant pueden leer/escribir sus settings
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios del tenant pueden leer sus settings
DROP POLICY IF EXISTS tenant_read_tenant_settings ON public.tenant_settings;
CREATE POLICY tenant_read_tenant_settings ON public.tenant_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.tenant_id = tenant_settings.tenant_id
      AND memberships.user_id = auth.uid()
    )
  );

-- Política: Solo owners/admins pueden modificar settings
DROP POLICY IF EXISTS tenant_write_tenant_settings ON public.tenant_settings;
CREATE POLICY tenant_write_tenant_settings ON public.tenant_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.tenant_id = tenant_settings.tenant_id
      AND memberships.user_id = auth.uid()
      AND memberships.role IN ('owner', 'admin')
    )
  );

-- Comentarios
COMMENT ON TABLE public.tenant_settings IS 'Configuraciones específicas de cada tenant';
COMMENT ON COLUMN public.tenant_settings.no_show_protection_enabled IS 'Activa/desactiva la protección contra ausencias';
COMMENT ON COLUMN public.tenant_settings.no_show_protection_mode IS 'Modo: deposit (depósito) o cancellation (tarifa de cancelación)';
COMMENT ON COLUMN public.tenant_settings.no_show_protection_percentage IS 'Porcentaje del depósito o tarifa (0-100)';
COMMENT ON COLUMN public.tenant_settings.no_show_cancellation_hours IS 'Horas de antelación mínimas para evitar penalización';

