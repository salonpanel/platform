-- 0045_verification_notes.sql
-- NOTA: Este archivo contiene SOLO comentarios con consultas de verificación manual.
-- No ejecuta cambios de esquema. Úsalo en el editor SQL para comprobar RLS e integridad.

-- Verificar visibilidad por tenant (autenticado como usuario con membership)
-- Debes ver solo registros de tu tenant_id
-- SELECT * FROM public.bookings LIMIT 5;
-- SELECT * FROM public.appointments LIMIT 5;
-- SELECT * FROM public.staff_blockings LIMIT 5;
-- SELECT * FROM public.staff_schedules LIMIT 5;
-- SELECT * FROM public.customers LIMIT 5;

-- Verificar permisos de DELETE (staff no debería poder borrar bookings)
-- DELETE FROM public.bookings WHERE false; -- simular, o intenta borrar uno y debe fallar para roles no admin/owner

-- Verificar memberships:
-- - Un usuario normal ve sus memberships:
-- SELECT * FROM public.memberships WHERE user_id = auth.uid();
-- - Un owner/admin puede ver/gestionar memberships del tenant:
-- SELECT * FROM public.memberships WHERE tenant_id = '<tenant_uuid>';

-- Verificar tenants:
-- SELECT * FROM public.tenants WHERE id = '<tenant_uuid>'; -- Debe ser visible solo si tienes membership
-- UPDATE public.tenants SET name = name WHERE id = '<tenant_uuid>'; -- Solo owner/admin debería poder

-- Provisión de tenant (ejecutar con un usuario autenticado):
-- SELECT public.provision_tenant_for_user('<USER_UUID>', 'Barbería Demo', 'barberia-demo');







