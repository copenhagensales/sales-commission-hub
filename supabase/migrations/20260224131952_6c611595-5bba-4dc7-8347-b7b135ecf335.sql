
-- Create kpi_period_snapshots table for permanent storage of completed payroll periods
CREATE TABLE public.kpi_period_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_slug text NOT NULL,
  period_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid,
  value numeric NOT NULL DEFAULT 0,
  formatted_value text,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT kpi_period_snapshots_unique UNIQUE (kpi_slug, period_key, scope_type, scope_id)
);

-- Index for period lookups
CREATE INDEX idx_kpi_period_snapshots_period_scope 
  ON public.kpi_period_snapshots (period_key, scope_type, scope_id);

-- Index for time-series queries
CREATE INDEX idx_kpi_period_snapshots_slug_scope_start 
  ON public.kpi_period_snapshots (kpi_slug, scope_type, scope_id, period_start);

-- Enable RLS
ALTER TABLE public.kpi_period_snapshots ENABLE ROW LEVEL SECURITY;

-- Read policy: authenticated users can read all snapshots
CREATE POLICY "Authenticated users can read kpi_period_snapshots"
  ON public.kpi_period_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

-- Write policy: only service role (edge functions) can insert/update
-- No insert/update/delete policies for authenticated = only service_role can write
