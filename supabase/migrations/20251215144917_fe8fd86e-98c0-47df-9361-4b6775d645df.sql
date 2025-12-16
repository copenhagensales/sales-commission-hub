-- Fix the schedule_integration_sync function to use net.http_post instead of extensions.http_post
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
SET search_path TO 'public', 'cron', 'net'
AS $function$
DECLARE
  v_jobid bigint;
BEGIN
  -- Schedule the cron job using net.http_post (NOT extensions.http_post!)
  SELECT cron.schedule(
    p_job_name,
    p_schedule,
    format(
      $$SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{"integration_id": "%s"}'::jsonb
      ) AS request_id;$$,
      p_function_url,
      p_anon_key,
      p_client_id::text
    )
  ) INTO v_jobid;
  
  RETURN v_jobid;
END;
$function$;