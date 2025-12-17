-- Quick audit validation
BEGIN;
INSERT INTO public.tenants (id, name, slug) VALUES ('11111111-1111-1111-1111-111111111111', 'Test', 'test');
SELECT COUNT(*) FROM platform.audit_logs;
ROLLBACK;
