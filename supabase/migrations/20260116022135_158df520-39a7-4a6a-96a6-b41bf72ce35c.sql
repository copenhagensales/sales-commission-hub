-- Create table for pre-calculated KPI values
CREATE TABLE public.kpi_cached_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_slug TEXT NOT NULL,
  period_type TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global',
  scope_id UUID,
  value NUMERIC NOT NULL DEFAULT 0,
  formatted_value TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kpi_slug, period_type, scope_type, scope_id)
);

-- Create indexes for fast lookups
CREATE INDEX idx_kpi_cached_values_slug_period ON public.kpi_cached_values(kpi_slug, period_type);
CREATE INDEX idx_kpi_cached_values_scope ON public.kpi_cached_values(scope_type, scope_id);
CREATE INDEX idx_kpi_cached_values_calculated_at ON public.kpi_cached_values(calculated_at);

-- Enable RLS
ALTER TABLE public.kpi_cached_values ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users (cached values are not sensitive)
CREATE POLICY "Authenticated users can read cached KPI values"
ON public.kpi_cached_values
FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert/update (edge function uses service role)
CREATE POLICY "Service role can manage cached KPI values"
ON public.kpi_cached_values
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_kpi_cached_values_updated_at
  BEFORE UPDATE ON public.kpi_cached_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.kpi_cached_values IS 'Pre-calculated KPI values updated by background job every 30 seconds';