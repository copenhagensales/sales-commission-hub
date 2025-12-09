-- Create integration_logs table for centralized logging
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type text NOT NULL CHECK (integration_type IN ('dialer', 'crm')),
  integration_id uuid,
  integration_name text,
  status text NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_integration_logs_created_at ON public.integration_logs (created_at DESC);
CREATE INDEX idx_integration_logs_status ON public.integration_logs (status);
CREATE INDEX idx_integration_logs_type ON public.integration_logs (integration_type);

-- Enable RLS
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Managers can view logs
CREATE POLICY "Managers can view integration logs"
  ON public.integration_logs
  FOR SELECT
  USING (is_manager_or_above(auth.uid()));

-- Service can insert logs (for edge functions)
CREATE POLICY "Service can insert integration logs"
  ON public.integration_logs
  FOR INSERT
  WITH CHECK (true);

-- Owners can delete old logs
CREATE POLICY "Owners can delete integration logs"
  ON public.integration_logs
  FOR DELETE
  USING (is_owner(auth.uid()));