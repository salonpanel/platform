-- Restore staff.color column to satisfy existing REST queries
-- This is a safe, backwards-compatible change: if the column exists, nothing breaks.

BEGIN;

-- 1) Add the column if it does not exist
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS color text;

-- 2) Optional: assign a default color to existing rows without color
UPDATE public.staff
SET color = COALESCE(color, '#4F46E5');

COMMIT;
