-- Test updated_at triggers
BEGIN;

-- Create test tenant
INSERT INTO public.tenants (id, name, slug, created_at, updated_at) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant', 'test-tenant', NOW(), NOW())
RETURNING id, created_at, updated_at;

-- Wait a moment (simulate delay)
SELECT pg_sleep(0.1);

-- Update tenant and verify updated_at changes
UPDATE public.tenants 
SET name = 'Updated Tenant'
WHERE id = '11111111-1111-1111-1111-111111111111'
RETURNING id, name, created_at, updated_at, updated_at > created_at as updated_at_changed;

ROLLBACK;
