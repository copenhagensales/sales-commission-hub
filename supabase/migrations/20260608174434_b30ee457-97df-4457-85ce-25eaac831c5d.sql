
-- Create a private table holding internal secrets used by cron jobs
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.internal_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lock the schema and table down completely from client roles
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.internal_secrets FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON TABLE private.internal_secrets TO service_role;

-- Seed a cron secret once (do nothing on conflict, so re-runs preserve it)
INSERT INTO private.internal_secrets (name, value)
VALUES ('cron_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- SECURITY DEFINER helper so edge functions can validate a presented token
-- without needing direct read access to the secret table.
CREATE OR REPLACE FUNCTION public.verify_internal_cron_secret(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.internal_secrets
    WHERE name = 'cron_secret' AND value = _token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_internal_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_cron_secret(text) TO service_role;

-- Re-schedule the two existing cron jobs to use the x-cron-secret header
-- read from the private table at runtime.
DO $$
DECLARE
  v_secret text;
  v_url_prefix text := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/';
BEGIN
  SELECT value INTO v_secret FROM private.internal_secrets WHERE name = 'cron_secret';

  -- cleanup-inactive-employees-daily
  PERFORM cron.unschedule('cleanup-inactive-employees-daily');
  PERFORM cron.schedule(
    'cleanup-inactive-employees-daily',
    '0 3 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM private.internal_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $cmd$, v_url_prefix || 'cleanup-inactive-employees')
  );

  -- snapshot-payroll-period-monthly
  PERFORM cron.unschedule('snapshot-payroll-period-monthly');
  PERFORM cron.schedule(
    'snapshot-payroll-period-monthly',
    '0 2 15 * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM private.internal_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $cmd$, v_url_prefix || 'snapshot-payroll-period')
  );
END $$;
