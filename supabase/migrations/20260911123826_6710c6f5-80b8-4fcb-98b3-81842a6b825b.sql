CREATE OR REPLACE FUNCTION public.gdpr_run_dialer_calls_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy record;
  v_result jsonb;
BEGIN
  -- Daily backstop for dialer call identity data. Runs in SQL because the
  -- gdpr-data-cleanup edge function can exhaust its CPU budget on the sales
  -- sections before reaching the dialer step.
  SELECT retention_days, cleanup_mode INTO v_policy
  FROM data_retention_policies
  WHERE data_type = 'dialer_calls' AND is_active = true
  LIMIT 1;

  IF v_policy IS NULL OR coalesce(v_policy.retention_days, 0) <= 0 THEN
    RETURN jsonb_build_object('skipped', 'no active dialer_calls policy');
  END IF;

  IF v_policy.cleanup_mode <> 'anonymize' THEN
    RETURN jsonb_build_object('skipped', 'cleanup_mode must be anonymize');
  END IF;

  v_result := public.gdpr_clean_dialer_calls(
    now() - make_interval(days => v_policy.retention_days),
    array['disposition','hangupCause','callType','answerTime','direction','wrapUpDuration','dialingDuration','isSale','result','project','orgCode'],
    false
  );

  INSERT INTO gdpr_cleanup_log (action, records_affected, details, triggered_by)
  VALUES ('dialer_calls_anonymized',
          coalesce((v_result->>'recordings_cleared')::int, 0)
        + coalesce((v_result->>'lead_keys_cleared')::int, 0)
        + coalesce((v_result->>'metadata_rows_cleaned')::int, 0),
          v_result,
          'pg_cron');

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_run_dialer_calls_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_run_dialer_calls_cleanup() TO service_role;