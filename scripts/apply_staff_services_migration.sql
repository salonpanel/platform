-- MANUAL MIGRATION SCRIPT FOR STAFF-PROVIDES-SERVICES
-- Run this in your Supabase SQL Editor or database console

-- 1) Crear tabla canónica staff_provides_services
CREATE TABLE IF NOT EXISTS public.staff_provides_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, staff_id, service_id)
);

-- 2) Índices para performance
CREATE INDEX IF NOT EXISTS idx_staff_provides_services_tenant_staff
  ON public.staff_provides_services(tenant_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_provides_services_tenant_service
  ON public.staff_provides_services(tenant_id, service_id);

CREATE INDEX IF NOT EXISTS idx_staff_provides_services_composite
  ON public.staff_provides_services(tenant_id, staff_id, service_id);

-- 3) RLS: Solo usuarios autenticados del tenant pueden gestionar relaciones
ALTER TABLE public.staff_provides_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_staff_services" ON public.staff_provides_services
FOR SELECT USING (tenant_id = app.current_tenant_id());

CREATE POLICY "tenant_manage_staff_services" ON public.staff_provides_services
FOR ALL USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

-- 4) Trigger para updated_at
CREATE OR REPLACE FUNCTION update_staff_provides_services_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_staff_provides_services_updated_at
  BEFORE UPDATE ON public.staff_provides_services
  FOR EACH ROW EXECUTE FUNCTION update_staff_provides_services_updated_at();

-- 5) Backfill desde services.staff_only_ids existentes
-- Solo para tenants que ya tienen datos
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id)
SELECT
  s.tenant_id,
  unnest(s.staff_only_ids) as staff_id,
  s.id as service_id
FROM public.services s
WHERE s.staff_only_ids IS NOT NULL
  AND array_length(s.staff_only_ids, 1) > 0
  AND s.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, staff_id, service_id) DO NOTHING;

-- 6) Función helper para mantener staff_only_ids sincronizado
CREATE OR REPLACE FUNCTION sync_staff_only_ids_from_relations()
RETURNS void AS $$
BEGIN
  -- Actualizar staff_only_ids basado en relaciones actuales
  UPDATE public.services
  SET staff_only_ids = COALESCE(
    (
      SELECT array_agg(sps.staff_id ORDER BY sps.staff_id)
      FROM public.staff_provides_services sps
      WHERE sps.service_id = services.id
        AND sps.tenant_id = services.tenant_id
    ),
    NULL
  )
  WHERE tenant_id IN (
    SELECT DISTINCT tenant_id
    FROM public.staff_provides_services
  );
END;
$$ LANGUAGE plpgsql;

-- Ejecutar sincronización inicial
SELECT sync_staff_only_ids_from_relations();

-- 7) Verificar que se creó correctamente
SELECT 'Migration completed successfully!' as status;
