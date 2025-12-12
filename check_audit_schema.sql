SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'platform' 
  AND table_name = 'audit_logs' 
ORDER BY ordinal_position;
