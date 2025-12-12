-- Test platform.audit_customer_changes trigger
BEGIN;

-- Create tenant
INSERT INTO public.tenants (id, name, slug) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant', 'test-tenant');

-- Check initial audit log count
SELECT COUNT(*) as initial_audit_count FROM platform.audit_logs;

-- Insert customer (should trigger audit)
INSERT INTO public.customers (id, tenant_id, name, email, phone) 
VALUES (
  '22222222-2222-2222-2222-222222222222', 
  '11111111-1111-1111-1111-111111111111', 
  'Test Customer', 
  'test@example.com',
  '+34612345678'
);

-- Check audit log created
SELECT COUNT(*) as final_audit_count FROM platform.audit_logs;

-- View audit log details
SELECT 
  action, 
  entity_type, 
  entity_id, 
  changes->>'name' as customer_name,
  changes->>'email' as customer_email
FROM platform.audit_logs
WHERE entity_id = '22222222-2222-2222-2222-222222222222'::uuid;

-- Update customer (should audit change)
UPDATE public.customers
SET phone = '+34698765432'
WHERE id = '22222222-2222-2222-2222-222222222222';

-- Check both audits exist
SELECT action, entity_type, changes->'old'->>'phone' as old_phone, changes->'new'->>'phone' as new_phone
FROM platform.audit_logs
WHERE entity_id = '22222222-2222-2222-2222-222222222222'::uuid
ORDER BY created_at;

ROLLBACK;
