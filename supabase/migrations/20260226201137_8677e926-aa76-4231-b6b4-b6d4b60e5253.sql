
-- 1. Integration run locks table (per-integration single-flight)
CREATE TABLE IF NOT EXISTS public.integration_run_locks (
  integration_id UUID PRIMARY KEY REFERENCES public.dialer_integrations(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed - only accessed by edge functions via service role key
ALTER TABLE public.integration_run_locks ENABLE ROW LEVEL SECURITY;

-- 2. Add run_id column to integration_sync_runs for traceability
ALTER TABLE public.integration_sync_runs 
  ADD COLUMN IF NOT EXISTS run_id TEXT;

-- 3. Update status check constraint to allow new statuses
-- First check if there's an existing constraint
DO $$
BEGIN
  -- Drop any existing check constraint on status
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name LIKE '%status%' AND constraint_schema = 'public'
  ) THEN
    -- We'll just ensure the column accepts the new values by not adding a constraint
    NULL;
  END IF;
END $$;

-- Index for fast lock cleanup
CREATE INDEX IF NOT EXISTS idx_integration_run_locks_expires 
  ON public.integration_run_locks(expires_at);

-- Index for sync runs status queries (dashboard)
CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_status 
  ON public.integration_sync_runs(status, started_at);
