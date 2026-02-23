
-- Add enrichment tracking columns to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_last_attempt timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_error text;

-- Partial index for healer queries
CREATE INDEX IF NOT EXISTS idx_sales_enrichment_pending
  ON public.sales (enrichment_status, enrichment_attempts, sale_datetime DESC)
  WHERE enrichment_status IN ('pending', 'failed');

-- Provider sync locks table
CREATE TABLE IF NOT EXISTS public.provider_sync_locks (
  provider text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.provider_sync_locks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to locks (edge functions use service role)
CREATE POLICY "Service role can manage sync locks"
  ON public.provider_sync_locks
  FOR ALL
  USING (true)
  WITH CHECK (true);
