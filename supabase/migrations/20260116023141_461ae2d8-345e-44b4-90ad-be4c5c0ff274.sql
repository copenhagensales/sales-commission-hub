-- Create a scheduled job to calculate KPI values every minute
-- Note: pg_cron uses cron syntax which has minimum granularity of 1 minute
-- The edge function has 30-second caching, so calling every minute is sufficient

-- First ensure the pg_cron extension is available (it should be by default on Supabase)
-- Then schedule the job using pg_net to call the edge function

-- Create a function to trigger the KPI calculation via HTTP
CREATE OR REPLACE FUNCTION public.trigger_kpi_calculation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/calculate-kpi-values';
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Use pg_net to make the HTTP call
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_anon_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE LOG 'KPI calculation triggered at %', now();
END;
$$;

-- Schedule the job to run every minute
-- Note: We use cron.schedule which is available via pg_cron extension
SELECT cron.schedule(
  'calculate-kpi-values',
  '* * * * *',  -- Every minute
  $$SELECT public.trigger_kpi_calculation()$$
);