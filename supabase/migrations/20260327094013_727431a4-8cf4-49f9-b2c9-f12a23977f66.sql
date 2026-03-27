
CREATE OR REPLACE FUNCTION public.cleanup_stale_leaderboard_cache()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM kpi_leaderboard_cache
  WHERE calculated_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_integration_sync(p_job_name text, p_schedule text, p_function_url text, p_anon_key text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'net', 'extensions'
AS $function$
DECLARE
  v_jobid bigint;
  v_command text;
BEGIN
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
  
  SELECT cron.schedule(p_job_name, p_schedule, v_command) INTO v_jobid;
  
  RETURN v_jobid;
END;
$function$;
