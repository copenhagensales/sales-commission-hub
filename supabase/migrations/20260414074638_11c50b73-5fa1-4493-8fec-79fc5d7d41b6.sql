
-- 1. Fix the current cron schedule to 13:00 UTC (15:00 CEST)
SELECT cron.unschedule('fm-checklist-daily-summary');

SELECT cron.schedule(
  'fm-checklist-daily-summary',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/fm-checklist-daily-summary',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2. Create function to sync send_time → cron
CREATE OR REPLACE FUNCTION public.update_checklist_email_cron(new_time text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'net', 'extensions'
AS $$
DECLARE
  v_local_time time;
  v_utc_time time;
  v_hour int;
  v_minute int;
  v_schedule text;
BEGIN
  -- Parse HH:MM string
  v_local_time := new_time::time;
  
  -- Convert Danish local time to UTC (handles CET/CEST automatically)
  v_utc_time := (
    (current_date + v_local_time) AT TIME ZONE 'Europe/Copenhagen' AT TIME ZONE 'UTC'
  )::time;
  
  v_hour := EXTRACT(HOUR FROM v_utc_time);
  v_minute := EXTRACT(MINUTE FROM v_utc_time);
  v_schedule := v_minute || ' ' || v_hour || ' * * *';
  
  -- Remove old job and create new one with updated schedule
  PERFORM cron.unschedule('fm-checklist-daily-summary');
  
  PERFORM cron.schedule(
    'fm-checklist-daily-summary',
    v_schedule,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb) AS request_id;',
      'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/fm-checklist-daily-summary',
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'
    )
  );
END;
$$;
