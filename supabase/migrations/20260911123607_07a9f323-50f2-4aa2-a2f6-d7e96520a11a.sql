CREATE OR REPLACE FUNCTION public.gdpr_clean_dialer_calls(
  p_cutoff timestamptz,
  p_allowed_metadata_keys text[],
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recordings integer := 0;
  v_lead_keys integer := 0;
  v_metadata integer := 0;
BEGIN
  -- Removes identity keys from expired dialer calls while keeping every
  -- statistical field (time, duration, status, agent, campaign) untouched.
  -- lead_external_id is NOT NULL, so it is overwritten with the row's own
  -- internal id, which cannot be looked up in the dialer.
  IF p_cutoff IS NULL OR p_allowed_metadata_keys IS NULL THEN
    RAISE EXCEPTION 'cutoff and allowed metadata keys are required';
  END IF;

  SELECT count(*) INTO v_recordings
  FROM dialer_calls
  WHERE recording_url IS NOT NULL AND start_time < p_cutoff;

  SELECT count(*) INTO v_lead_keys
  FROM dialer_calls
  WHERE lead_external_id IS DISTINCT FROM id::text AND start_time < p_cutoff;

  SELECT count(*) INTO v_metadata
  FROM dialer_calls d
  WHERE d.start_time < p_cutoff
    AND d.metadata IS NOT NULL
    AND jsonb_typeof(d.metadata) = 'object'
    AND EXISTS (
      SELECT 1 FROM jsonb_object_keys(d.metadata) k
      WHERE NOT (k = ANY (p_allowed_metadata_keys))
    );

  IF NOT p_dry_run THEN
    UPDATE dialer_calls
    SET recording_url = NULL, updated_at = now()
    WHERE recording_url IS NOT NULL AND start_time < p_cutoff;

    UPDATE dialer_calls
    SET lead_external_id = id::text, updated_at = now()
    WHERE lead_external_id IS DISTINCT FROM id::text AND start_time < p_cutoff;

    UPDATE dialer_calls dc
    SET metadata = NULLIF(
          (
            SELECT coalesce(jsonb_object_agg(k, dc.metadata -> k), '{}'::jsonb)
            FROM jsonb_object_keys(dc.metadata) k
            WHERE k = ANY (p_allowed_metadata_keys)
          ),
          '{}'::jsonb
        ),
        updated_at = now()
    WHERE dc.start_time < p_cutoff
      AND dc.metadata IS NOT NULL
      AND jsonb_typeof(dc.metadata) = 'object'
      AND EXISTS (
        SELECT 1 FROM jsonb_object_keys(dc.metadata) k
        WHERE NOT (k = ANY (p_allowed_metadata_keys))
      );
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'cutoff', p_cutoff,
    'recordings_cleared', v_recordings,
    'lead_keys_cleared', v_lead_keys,
    'metadata_rows_cleaned', v_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_clean_dialer_calls(timestamptz, text[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_clean_dialer_calls(timestamptz, text[], boolean) TO service_role;