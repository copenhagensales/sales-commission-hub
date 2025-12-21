-- Create login_events table to track user logins
CREATE TABLE public.login_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT
);

-- Enable RLS
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries on recent logins
CREATE INDEX idx_login_events_logged_in_at ON public.login_events (logged_in_at DESC);
CREATE INDEX idx_login_events_user_email ON public.login_events (user_email);

-- Policy: Only owners and teamledere can view login events
CREATE POLICY "Admins can view login events"
ON public.login_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.system_roles sr
    WHERE sr.user_id = auth.uid()
    AND sr.role IN ('ejer', 'teamleder')
  )
);

-- Policy: System can insert login events (via service role)
CREATE POLICY "System can insert login events"
ON public.login_events
FOR INSERT
WITH CHECK (true);