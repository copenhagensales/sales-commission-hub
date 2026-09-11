-- Batch the metadata cleanup so the job stays bounded as the call volume grows.
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
  v_batch integer;
  v_batch_size constant integer := 20000;
BEGIN
  -- Removes identity keys from expired dialer calls while keeping every
  -- statistical field (time, duration, status, agent, campaign) untouched.
  -- lead_external_id is NOT NULL, so it is overwritten with the row's own
  -- internal id, which cannot be looked up in the dialer.
  IF p_cutoff IS NULL OR p_allowed_metadata_keys IS NULL THEN
    RAISE EXCEPTION 'cutoff and allowed metadata keys are required';
  END IF;

  IF p_dry_run THEN
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

    RETURN jsonb_build_object(
      'dry_run', true,
      'cutoff', p_cutoff,
      'recordings_cleared', v_recordings,
      'lead_keys_cleared', v_lead_keys,
      'metadata_rows_cleaned', v_metadata
    );
  END IF;

  LOOP
    WITH batch AS (
      SELECT id FROM dialer_calls
      WHERE recording_url IS NOT NULL AND start_time < p_cutoff
      LIMIT v_batch_size
    )
    UPDATE dialer_calls dc
    SET recording_url = NULL, updated_at = now()
    FROM batch b WHERE dc.id = b.id;
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_recordings := v_recordings + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  LOOP
    WITH batch AS (
      SELECT id FROM dialer_calls
      WHERE lead_external_id IS DISTINCT FROM id::text AND start_time < p_cutoff
      LIMIT v_batch_size
    )
    UPDATE dialer_calls dc
    SET lead_external_id = dc.id::text, updated_at = now()
    FROM batch b WHERE dc.id = b.id;
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_lead_keys := v_lead_keys + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  LOOP
    WITH batch AS (
      SELECT d.id FROM dialer_calls d
      WHERE d.start_time < p_cutoff
        AND d.metadata IS NOT NULL
        AND jsonb_typeof(d.metadata) = 'object'
        AND EXISTS (
          SELECT 1 FROM jsonb_object_keys(d.metadata) k
          WHERE NOT (k = ANY (p_allowed_metadata_keys))
        )
      LIMIT v_batch_size
    )
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
    FROM batch b WHERE dc.id = b.id;
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_metadata := v_metadata + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', false,
    'cutoff', p_cutoff,
    'recordings_cleared', v_recordings,
    'lead_keys_cleared', v_lead_keys,
    'metadata_rows_cleaned', v_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_clean_dialer_calls(timestamptz, text[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_clean_dialer_calls(timestamptz, text[], boolean) TO service_role;

-- Version-control the schedule itself so it survives a rebuild of the environment.
SELECT cron.unschedule('gdpr-dialer-calls-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gdpr-dialer-calls-cleanup');

SELECT cron.schedule(
  'gdpr-dialer-calls-cleanup',
  '45 3 * * *',
  $$select public.gdpr_run_dialer_calls_cleanup();$$
);