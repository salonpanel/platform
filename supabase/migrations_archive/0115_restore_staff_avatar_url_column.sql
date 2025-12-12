-- Restore staff.avatar_url column to satisfy existing REST queries
-- This is a safe, backwards-compatible change: if the column exists, nothing breaks.

BEGIN;

-- 1) Add the column if it does not exist
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMIT;
