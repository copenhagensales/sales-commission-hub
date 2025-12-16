-- Drop the old function first
DROP FUNCTION IF EXISTS public.schedule_integration_sync(text, text, text, text, uuid);

-- Create the function with different dollar quoting
CREATE OR REPLACE FUNCTION public.schedule_integration_sync(
  p_job_name text,
  p_schedule text,
  p_function_url text,
  p_anon_key text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_jobid bigint;
  v_command text;
BEGIN
  -- Build the command string
  v_command := format(
    'SELECT net.http_post(
        url := %L,
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer %s"}''::jsonb,
        body := %L::jsonb
      ) AS request_id;',
    p_function_url,
    p_anon_key,
    p_payload::text
  );
  
  -- Schedule the cron job
  SELECT cron.schedule(p_job_name, p_schedule, v_command) INTO v_jobid;
  
  RETURN v_jobid;
END;
$func$;