-- Fix trigger_kpi_calculation to use hardcoded URL instead of NULL current_setting
CREATE OR REPLACE FUNCTION public.trigger_kpi_calculation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use hardcoded URL like other working cron jobs
  PERFORM net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/calculate-kpi-values',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE LOG 'KPI calculation triggered at %', now();
END;
$$;