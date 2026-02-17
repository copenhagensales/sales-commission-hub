
-- Migration 1: Create dialer_sessions table
CREATE TABLE public.dialer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.dialer_integrations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  lead_external_id text,
  agent_external_id text,
  campaign_external_id text,
  status text NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  session_seconds integer,
  has_cdr boolean DEFAULT false,
  cdr_duration_seconds integer,
  cdr_disposition text,
  source text NOT NULL DEFAULT 'adversus',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (integration_id, external_id)
);

-- Indexes
CREATE INDEX idx_dialer_sessions_integration_start ON public.dialer_sessions (integration_id, start_time DESC);
CREATE INDEX idx_dialer_sessions_integration_campaign ON public.dialer_sessions (integration_id, campaign_external_id, start_time DESC);
CREATE INDEX idx_dialer_sessions_integration_agent ON public.dialer_sessions (integration_id, agent_external_id, start_time DESC);
CREATE INDEX idx_dialer_sessions_integration_status ON public.dialer_sessions (integration_id, status, start_time DESC);

-- RLS
ALTER TABLE public.dialer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view sessions"
  ON public.dialer_sessions FOR SELECT
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Service role can insert sessions"
  ON public.dialer_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update sessions"
  ON public.dialer_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_dialer_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_dialer_sessions_updated_at
  BEFORE UPDATE ON public.dialer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dialer_sessions_updated_at();

-- Migration 2: Create dialer_sync_state table
CREATE TABLE public.dialer_sync_state (
  integration_id uuid NOT NULL REFERENCES public.dialer_integrations(id) ON DELETE CASCADE,
  dataset text NOT NULL,
  last_success_at timestamptz,
  cursor text,
  last_error_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, dataset)
);

ALTER TABLE public.dialer_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view sync state"
  ON public.dialer_sync_state FOR SELECT
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Service role can insert sync state"
  ON public.dialer_sync_state FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update sync state"
  ON public.dialer_sync_state FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Migration 3: Add integration_id to dialer_calls (nullable, non-breaking)
ALTER TABLE public.dialer_calls ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.dialer_integrations(id);

-- Backfill integration_id from dialer_name
UPDATE public.dialer_calls dc
SET integration_id = di.id
FROM public.dialer_integrations di
WHERE dc.dialer_name = di.name
  AND dc.integration_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_dialer_calls_integration_start ON public.dialer_calls (integration_id, start_time DESC);

-- Migration 4: Create dialer_session_daily_metrics view
CREATE OR REPLACE VIEW public.dialer_session_daily_metrics AS
SELECT
  date_trunc('day', start_time)::date AS date,
  integration_id,
  campaign_external_id,
  agent_external_id,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'success') AS success_sessions,
  COUNT(*) FILTER (WHERE status = 'notInterested') AS not_interested_sessions,
  COUNT(*) FILTER (WHERE status = 'invalid') AS invalid_sessions,
  COUNT(*) FILTER (WHERE status = 'unqualified') AS unqualified_sessions,
  COUNT(*) FILTER (WHERE status IN ('automaticRedial','privateRedial')) AS redial_sessions,
  AVG(session_seconds) FILTER (WHERE session_seconds > 0) AS avg_session_seconds,
  COUNT(*) FILTER (WHERE has_cdr = true) AS sessions_with_calls,
  AVG(cdr_duration_seconds) FILTER (WHERE has_cdr AND cdr_duration_seconds > 0) AS avg_call_duration
FROM public.dialer_sessions
WHERE start_time IS NOT NULL
GROUP BY 1, 2, 3, 4;
