-- Fix staff_schedules unique constraint to allow split schedules (multiple intervals per day)
-- Change from (tenant_id, staff_id, day_of_week) to (tenant_id, staff_id, day_of_week, start_time, end_time)

BEGIN;

-- Drop the existing unique constraint
ALTER TABLE public.staff_schedules
DROP CONSTRAINT IF EXISTS staff_schedules_tenant_id_staff_id_day_of_week_key;

-- Add new unique constraint that allows multiple intervals per day
ALTER TABLE public.staff_schedules
ADD CONSTRAINT staff_schedules_unique_interval
UNIQUE (tenant_id, staff_id, day_of_week, start_time, end_time);

COMMIT;
