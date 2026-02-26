ALTER TABLE public.integration_sync_runs 
  ADD COLUMN IF NOT EXISTS rate_limit_daily_limit integer,
  ADD COLUMN IF NOT EXISTS rate_limit_remaining integer,
  ADD COLUMN IF NOT EXISTS rate_limit_reset integer;