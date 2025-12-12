-- 1. Validar Auditoría platform.audit_logs
BEGIN;

-- Insertar cliente
INSERT INTO public.customers (id, tenant_id, name, email, phone)
VALUES ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'Audit Test Customer', 'audit@test.com', '+34600000000');

-- Actualizar cliente
UPDATE public.customers
SET phone = '+34611111111'
WHERE id = '99999999-9999-9999-9999-999999999999';

-- Eliminar cliente
DELETE FROM public.customers
WHERE id = '99999999-9999-9999-9999-999999999999';

-- Verificar registros de auditoría
SELECT 
  action,
  resource_type,
  resource_id,
  old_data,
  new_data,
  created_at
FROM platform.audit_logs
WHERE resource_id = '99999999-9999-9999-9999-999999999999'
ORDER BY created_at;

ROLLBACK;
