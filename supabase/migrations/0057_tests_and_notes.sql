-- 0057_tests_and_notes.sql
-- Solo comentarios: consultas sugeridas para probar RPCs, auditoría y métricas (no DDL)

-- RPC servicios públicos:
-- SELECT * FROM public.get_public_services('<TENANT_ID>'::uuid);

-- RPC ventanas operativas:
-- SELECT * FROM public.get_public_daily_staff_windows('<TENANT_ID>'::uuid, current_date);

-- Auditoría: realizar UPDATE en bookings/services/tenant_settings y ver audit_logs
-- UPDATE public.services SET name = name WHERE tenant_id = '<TENANT_ID>' LIMIT 1;
-- SELECT * FROM public.audit_logs ORDER BY occurred_at DESC LIMIT 10;

-- Métricas: crear/actualizar/borrar un booking y comprobar org_metrics_daily
-- INSERT INTO public.bookings (id, tenant_id, customer_id, staff_id, service_id, starts_at, ends_at, status)
-- VALUES (gen_random_uuid(), '<TENANT_ID>'::uuid, '<CUSTOMER_ID>'::uuid, '<STAFF_ID>'::uuid, '<SERVICE_ID>'::uuid, now(), now() + interval '30 min', 'paid');
-- SELECT * FROM public.org_metrics_daily WHERE tenant_id = '<TENANT_ID>' ORDER BY metric_date DESC LIMIT 3;







