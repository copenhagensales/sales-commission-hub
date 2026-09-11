-- Campaign sales anonymisation moved from the edge function (which exceeds its
-- CPU budget on the current backlog) into Postgres, batched, same model as the
-- dialer_calls cleanup. Only cleanup_mode = 'anonymize_customer' is handled
-- here; 'delete_all' stays with the edge function.

CREATE OR REPLACE FUNCTION public.gdpr_clean_campaign_sales(
  p_limit_per_campaign integer DEFAULT 5000,
  p_batch_size integer DEFAULT 1000,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity_keys text[] := ARRAY[
    'customer_name','customer_email','customer_zip','customer_address','customer_city',
    'phone_number','member_number','current_akasse',
    'opp_nr','opp_nr.','opp-nr','opp-nr.','opp nr','opp nr.','opp_number','opp',
    'legacy_opp_number','sales_id','sales id','salesid'
  ];
  v_policy record;
  v_cutoff timestamptz;
  v_ids uuid[];
  v_done integer;
  v_batch integer;
  v_total integer := 0;
  v_skipped integer := 0;
  v_campaigns jsonb := '[]'::jsonb;
BEGIN
  FOR v_policy IN
    SELECT client_campaign_id, retention_days
    FROM public.campaign_retention_policies
    WHERE is_active
      AND cleanup_mode = 'anonymize_customer'
      AND retention_days IS NOT NULL
      AND retention_days > 0
  LOOP
    v_cutoff := now() - make_interval(days => v_policy.retention_days);
    v_done := 0;

    LOOP
      SELECT array_agg(s.id) INTO v_ids
      FROM (
        SELECT s.id
        FROM public.sales s
        WHERE s.client_campaign_id = v_policy.client_campaign_id
          AND s.sale_datetime < v_cutoff
          AND (
            s.customer_phone IS NOT NULL
            OR s.raw_payload IS NOT NULL
            OR s.external_reference_number IS NOT NULL
            OR s.external_sales_id IS NOT NULL
          )
          -- Safeguard: never touch a sale whose items are not fully mapped,
          -- so commission data can still be reconstructed if needed.
          AND EXISTS (SELECT 1 FROM public.sale_items si WHERE si.sale_id = s.id)
          AND NOT EXISTS (
            SELECT 1 FROM public.sale_items si
            WHERE si.sale_id = s.id
              AND (si.needs_mapping IS TRUE OR si.mapped_commission IS NULL)
          )
        ORDER BY s.sale_datetime
        LIMIT LEAST(p_batch_size, p_limit_per_campaign - v_done)
      ) s;

      IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
        EXIT;
      END IF;

      v_batch := array_length(v_ids, 1);

      IF NOT p_dry_run THEN
        UPDATE public.sales s
        SET customer_phone = NULL,
            customer_company = 'Anonymiseret',
            raw_payload = NULL,
            external_reference_number = NULL,
            external_sales_id = NULL,
            normalized_data = CASE
              WHEN s.normalized_data IS NULL
                OR jsonb_typeof(s.normalized_data) <> 'object' THEN s.normalized_data
              ELSE COALESCE(
                (
                  SELECT jsonb_object_agg(e.key, e.value)
                  FROM jsonb_each(s.normalized_data) e
                  WHERE lower(btrim(e.key)) <> ALL (v_identity_keys)
                ),
                '{}'::jsonb
              )
            END
        WHERE s.id = ANY (v_ids);
      END IF;

      v_done := v_done + v_batch;
      v_total := v_total + v_batch;

      EXIT WHEN p_dry_run OR v_done >= p_limit_per_campaign;
    END LOOP;

    IF v_done > 0 THEN
      v_campaigns := v_campaigns || jsonb_build_object(
        'client_campaign_id', v_policy.client_campaign_id,
        'retention_days', v_policy.retention_days,
        'anonymized', v_done
      );
    END IF;
  END LOOP;

  -- Overdue sales left untouched because their items are not fully mapped.
  SELECT count(*) INTO v_skipped
  FROM public.sales s
  JOIN public.campaign_retention_policies p
    ON p.client_campaign_id = s.client_campaign_id
   AND p.is_active
   AND p.cleanup_mode = 'anonymize_customer'
   AND p.retention_days > 0
  WHERE s.sale_datetime < now() - make_interval(days => p.retention_days)
    AND (
      s.customer_phone IS NOT NULL
      OR s.raw_payload IS NOT NULL
      OR s.external_reference_number IS NOT NULL
      OR s.external_sales_id IS NOT NULL
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.sale_items si WHERE si.sale_id = s.id)
      OR EXISTS (
        SELECT 1 FROM public.sale_items si
        WHERE si.sale_id = s.id
          AND (si.needs_mapping IS TRUE OR si.mapped_commission IS NULL)
      )
    );

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'anonymized', v_total,
    'skipped_unmapped', v_skipped,
    'campaigns', v_campaigns
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_clean_campaign_sales(integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_clean_campaign_sales(integer, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.gdpr_run_campaign_sales_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.gdpr_clean_campaign_sales();

  INSERT INTO public.gdpr_cleanup_log (action, records_affected, details, triggered_by)
  VALUES (
    'campaign_sales_anonymized',
    COALESCE((v_result->>'anonymized')::int, 0),
    v_result,
    'pg_cron:gdpr-campaign-sales-cleanup'
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_run_campaign_sales_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_run_campaign_sales_cleanup() TO service_role;

-- Read-only status for the retention policies page: how much is overdue right
-- now and when the cleanup last ran. Aggregates only, no personal data.
CREATE OR REPLACE FUNCTION public.gdpr_campaign_sales_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'overdue_sales', (
      SELECT count(*)
      FROM public.sales s
      JOIN public.campaign_retention_policies p
        ON p.client_campaign_id = s.client_campaign_id
       AND p.is_active
       AND p.cleanup_mode = 'anonymize_customer'
       AND p.retention_days > 0
      WHERE s.sale_datetime < now() - make_interval(days => p.retention_days)
        AND (
          s.customer_phone IS NOT NULL
          OR s.raw_payload IS NOT NULL
          OR s.external_reference_number IS NOT NULL
          OR s.external_sales_id IS NOT NULL
        )
    ),
    'last_run_at', (
      SELECT max(run_at) FROM public.gdpr_cleanup_log
      WHERE action = 'campaign_sales_anonymized'
    ),
    'last_run_affected', (
      SELECT records_affected FROM public.gdpr_cleanup_log
      WHERE action = 'campaign_sales_anonymized'
      ORDER BY run_at DESC LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.gdpr_campaign_sales_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gdpr_campaign_sales_status() TO authenticated, service_role;

-- Index supporting the overdue lookup per campaign.
CREATE INDEX IF NOT EXISTS idx_sales_campaign_datetime_privacy
  ON public.sales (client_campaign_id, sale_datetime)
  WHERE customer_phone IS NOT NULL
     OR raw_payload IS NOT NULL
     OR external_reference_number IS NOT NULL
     OR external_sales_id IS NOT NULL;

SELECT cron.unschedule('gdpr-campaign-sales-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gdpr-campaign-sales-cleanup');

SELECT cron.schedule(
  'gdpr-campaign-sales-cleanup',
  '0 4 * * *',
  $$SELECT public.gdpr_run_campaign_sales_cleanup();$$
);