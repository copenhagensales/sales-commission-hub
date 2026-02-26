
-- Circuit breaker table for auto-pausing integrations after repeated failures
CREATE TABLE IF NOT EXISTS public.integration_circuit_breaker (
  integration_id UUID NOT NULL PRIMARY KEY REFERENCES public.dialer_integrations(id) ON DELETE CASCADE,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  paused_until TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_circuit_breaker ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role key)
CREATE POLICY "Service role full access" ON public.integration_circuit_breaker
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.integration_circuit_breaker IS 'Tracks consecutive sync failures per integration. Auto-pauses after threshold to prevent API hammering.';
