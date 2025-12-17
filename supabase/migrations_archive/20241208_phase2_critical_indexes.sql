-- FASE 2: Índices críticos para agenda y disponibilidad

-- Índice para carga de agenda en tiempo real
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_starts
  ON public.bookings (tenant_id, starts_at);

-- Índice para schedules por tenant, staff y tiempo
CREATE INDEX IF NOT EXISTS idx_staff_schedules_tenant_staff_start
  ON public.staff_schedules (tenant_id, staff_id, start_time);

-- Índice para blockings
CREATE INDEX IF NOT EXISTS idx_staff_blockings_tenant_staff_start
  ON public.staff_blockings (tenant_id, staff_id, start_time);

-- Índice para staff_provides_services
CREATE INDEX IF NOT EXISTS idx_staff_provides_services_tenant_service
  ON public.staff_provides_services (tenant_id, service_id);

CREATE INDEX IF NOT EXISTS idx_staff_provides_services_staff
  ON public.staff_provides_services (staff_id);