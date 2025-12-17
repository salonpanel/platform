-- Check bookings status constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass
  AND conname LIKE '%status%';
