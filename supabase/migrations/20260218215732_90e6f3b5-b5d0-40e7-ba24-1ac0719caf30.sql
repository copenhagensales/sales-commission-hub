
-- Tabel: integration_sync_runs
CREATE TABLE integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES dialer_integrations(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running',
  actions text[],
  records_processed integer DEFAULT 0,
  api_calls_made integer DEFAULT 0,
  retries integer DEFAULT 0,
  rate_limit_hits integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabel: integration_schedule_audit
CREATE TABLE integration_schedule_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES dialer_integrations(id),
  changed_by uuid,
  change_type text NOT NULL,
  old_config jsonb,
  new_config jsonb,
  old_schedule text,
  new_schedule text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Udvid integration_logs
ALTER TABLE integration_logs
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS api_calls integer,
  ADD COLUMN IF NOT EXISTS retries integer,
  ADD COLUMN IF NOT EXISTS rate_limit_hits integer;

-- Index for hurtige opslag
CREATE INDEX idx_sync_runs_integration_time
  ON integration_sync_runs (integration_id, started_at DESC);
CREATE INDEX idx_schedule_audit_integration_time
  ON integration_schedule_audit (integration_id, created_at DESC);

-- RLS
ALTER TABLE integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_schedule_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read sync runs"
  ON integration_sync_runs FOR SELECT
  USING (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can read audit log"
  ON integration_schedule_audit FOR SELECT
  USING (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Service role inserts sync runs"
  ON integration_sync_runs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role inserts audit"
  ON integration_schedule_audit FOR INSERT
  WITH CHECK (true);
