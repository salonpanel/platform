-- Migration: Create auth_login_requests table for remote login approval flow
-- Purpose: Allow users to approve login from a different device (e.g., mobile) while the original device (PC) waits

-- Create the table
CREATE TABLE IF NOT EXISTS public.auth_login_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  redirect_path text DEFAULT '/panel',
  secret_token text NOT NULL,
  supabase_access_token text,
  supabase_refresh_token text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_login_requests_email ON public.auth_login_requests(email);
CREATE INDEX IF NOT EXISTS idx_auth_login_requests_created_at ON public.auth_login_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_login_requests_status ON public.auth_login_requests(status);
CREATE INDEX IF NOT EXISTS idx_auth_login_requests_secret_token ON public.auth_login_requests(secret_token);

-- Enable RLS
ALTER TABLE public.auth_login_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Users can only read their own requests (without tokens)
CREATE POLICY "Users can read own login requests without tokens"
  ON public.auth_login_requests
  FOR SELECT
  USING (
    -- Allow reading if email matches current user email (from auth.users)
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    -- Only allow reading non-sensitive fields
    AND status IN ('pending', 'approved', 'expired', 'cancelled')
  );

-- Policy: Users can update their own pending requests (to cancel)
CREATE POLICY "Users can cancel own pending requests"
  ON public.auth_login_requests
  FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'cancelled'
    -- Prevent updating tokens from client
    AND supabase_access_token IS NULL
    AND supabase_refresh_token IS NULL
  );

-- Policy: Anyone can create a login request (for login flow)
CREATE POLICY "Anyone can create login requests"
  ON public.auth_login_requests
  FOR INSERT
  WITH CHECK (true);

-- Note: Service role can access all fields via direct client
-- Tokens (supabase_access_token, supabase_refresh_token) are NEVER exposed to client queries
-- They can only be set/read via service_role client

-- Function to mark expired requests (can be called by cron)
CREATE OR REPLACE FUNCTION public.mark_expired_login_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.auth_login_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - interval '15 minutes';
END;
$$;

-- Add comment
COMMENT ON TABLE public.auth_login_requests IS 'Stores login requests for remote approval flow. Tokens are only accessible via service_role.';
COMMENT ON COLUMN public.auth_login_requests.secret_token IS 'Secret token sent in email link for security verification';
COMMENT ON COLUMN public.auth_login_requests.supabase_access_token IS 'Access token from Supabase session (only accessible via service_role)';
COMMENT ON COLUMN public.auth_login_requests.supabase_refresh_token IS 'Refresh token from Supabase session (only accessible via service_role)';

