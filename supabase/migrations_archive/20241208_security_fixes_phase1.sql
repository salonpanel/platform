-- Security fixes: Remove dangerous public policies
-- FASE 1: Eliminar políticas públicas peligrosas

-- Drop dangerous public read policies that allow access without tenant_id
DROP POLICY IF EXISTS "public_read_staff_active" ON public.staff;
DROP POLICY IF EXISTS "public_read_services_active" ON public.services;

-- Note: Keeping public_create_payment_intents as it may be needed for booking flow,
-- but ensure it's properly secured in application logic.