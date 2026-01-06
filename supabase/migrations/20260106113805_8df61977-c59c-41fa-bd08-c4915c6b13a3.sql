-- Add security columns to job_positions
ALTER TABLE public.job_positions 
  ADD COLUMN IF NOT EXISTS requires_mfa boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_timeout_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS max_session_hours integer DEFAULT 10;

-- Add security columns to employee_master_data
ALTER TABLE public.employee_master_data 
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_login_count integer DEFAULT 0;

-- Create failed_login_attempts table for security monitoring
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  user_agent text,
  attempted_at timestamptz DEFAULT now(),
  failure_reason text
);

-- Enable RLS
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Only owners can view failed login attempts
CREATE POLICY "Owners can view failed login attempts"
  ON public.failed_login_attempts
  FOR SELECT
  USING (public.is_owner(auth.uid()));

-- Edge functions can insert (service role)
CREATE POLICY "Service role can insert failed login attempts"
  ON public.failed_login_attempts
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON public.failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_attempted_at ON public.failed_login_attempts(attempted_at DESC);