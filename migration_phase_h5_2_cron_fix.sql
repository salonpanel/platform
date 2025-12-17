-- Phase H.5.2: Fix Release Holds Cron
-- Resolves error 42703 (column updated_at of relation appointments does not exist)
-- by redirecting the logic to the 'bookings' table and ensuring schema correctness.

-- 1. Ensure bookings table has expires_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'bookings'
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE public.bookings ADD COLUMN expires_at timestamptz;
    END IF;
END $$;

-- 2. Create/Replace the RPC function used by /api/cron/release-holds
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Cancel expired holds in bookings table
  WITH rows AS (
    UPDATE bookings
    SET 
        status = 'cancelled',
        updated_at = now() -- Ensure updated_at is updated if it exists
    WHERE status = 'hold'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM rows;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION release_expired_holds() TO authenticated;
GRANT EXECUTE ON FUNCTION release_expired_holds() TO service_role;
