
-- Dead Letter Queue for failed sync records
CREATE TABLE IF NOT EXISTS public.sync_failed_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL,
  dataset TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  run_id TEXT
);

CREATE INDEX idx_sync_failed_records_unresolved 
  ON public.sync_failed_records (integration_id, dataset) 
  WHERE resolved_at IS NULL;

ALTER TABLE public.sync_failed_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for sync_failed_records"
  ON public.sync_failed_records
  FOR ALL
  USING (false);

-- Transactional watermark update RPC
CREATE OR REPLACE FUNCTION public.upsert_sync_state_atomic(
  p_integration_id UUID,
  p_dataset TEXT,
  p_last_success_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO dialer_sync_state (integration_id, dataset, last_success_at, updated_at)
  VALUES (p_integration_id, p_dataset, p_last_success_at, now())
  ON CONFLICT (integration_id, dataset)
  DO UPDATE SET
    last_success_at = EXCLUDED.last_success_at,
    updated_at = now();
END;
$$;

-- Daily summary table
CREATE TABLE IF NOT EXISTS public.sync_daily_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  summary_date DATE NOT NULL,
  provider TEXT NOT NULL,
  total_api_calls INTEGER NOT NULL DEFAULT 0,
  total_records_processed INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  error_runs INTEGER NOT NULL DEFAULT 0,
  skipped_runs INTEGER NOT NULL DEFAULT 0,
  total_rate_limit_hits INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (summary_date, provider)
);

ALTER TABLE public.sync_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for sync_daily_summary"
  ON public.sync_daily_summary
  FOR ALL
  USING (false);
