-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create wrapper function to schedule a cron job
CREATE OR REPLACE FUNCTION public.schedule_integration_sync(
  p_job_name text,
  p_schedule text,
  p_function_url text,
  p_anon_key text,
  p_client_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'extensions'
AS $function$
DECLARE
  v_jobid bigint;
BEGIN
  -- Schedule the cron job
  SELECT cron.schedule(
    p_job_name,
    p_schedule,
    format(
      $$SELECT extensions.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{"client_id": "%s"}'::jsonb
      );$$,
      p_function_url,
      p_anon_key,
      p_client_id::text
    )
  ) INTO v_jobid;
  
  RETURN v_jobid;
END;
$function$;

-- Create wrapper function to unschedule a cron job
CREATE OR REPLACE FUNCTION public.unschedule_integration_sync(p_job_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  PERFORM cron.unschedule(p_job_name);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;