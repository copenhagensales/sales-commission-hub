
-- Create sensitive data access log table
CREATE TABLE public.sensitive_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  field_accessed text NOT NULL,
  access_type text NOT NULL DEFAULT 'edit',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

-- Owners can read all logs
CREATE POLICY "Owners can read all access logs"
  ON public.sensitive_data_access_log
  FOR SELECT
  TO authenticated
  USING (public.is_owner(auth.uid()));

-- Authenticated users can insert their own logs
CREATE POLICY "Authenticated users can insert access logs"
  ON public.sensitive_data_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index for querying
CREATE INDEX idx_sensitive_log_created_at ON public.sensitive_data_access_log(created_at DESC);
CREATE INDEX idx_sensitive_log_employee_id ON public.sensitive_data_access_log(employee_id);
