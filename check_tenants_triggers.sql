-- Check triggers on tenants table
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgrelid = 'public.tenants'::regclass 
  AND tgisinternal = false;
