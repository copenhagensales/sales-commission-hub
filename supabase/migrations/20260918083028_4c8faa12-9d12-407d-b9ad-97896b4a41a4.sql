-- Hjælper: fjerner alle felter med decision='BLOKER' fra et salgs beholdere.
-- Returnerer { raw, normalized, removed, labels } — ændrer intet i basen.
CREATE OR REPLACE FUNCTION public.gdpr_strip_blocked_jsonb(p_raw jsonb, p_norm jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_raw jsonb := p_raw;
  v_norm jsonb := p_norm;
  v_removed int := 0;
  v_labels text[] := '{}';
  r record;
  v_sub jsonb;
  v_new jsonb;
  v_before int;
  v_after int;
BEGIN
  FOR r IN
    SELECT DISTINCT container, field_label
    FROM public.ingestion_known_fields
    WHERE decision = 'BLOKER'
  LOOP
    IF r.container = 'normalized_data' THEN
      IF v_norm IS NOT NULL AND jsonb_typeof(v_norm) = 'object' AND v_norm ? r.field_label THEN
        v_norm := v_norm - r.field_label;
        v_removed := v_removed + 1;
        v_labels := v_labels || (r.container || '.' || r.field_label);
      END IF;

    ELSIF r.container = 'raw_payload' THEN
      IF v_raw IS NOT NULL AND jsonb_typeof(v_raw) = 'object' AND v_raw ? r.field_label THEN
        v_raw := v_raw - r.field_label;
        v_removed := v_removed + 1;
        v_labels := v_labels || (r.container || '.' || r.field_label);
      END IF;

    ELSE
      IF v_raw IS NULL OR jsonb_typeof(v_raw) <> 'object' THEN
        CONTINUE;
      END IF;
      v_sub := v_raw -> r.container;
      IF v_sub IS NULL THEN
        CONTINUE;
      END IF;

      IF jsonb_typeof(v_sub) = 'object' THEN
        IF v_sub ? r.field_label THEN
          v_raw := jsonb_set(v_raw, ARRAY[r.container], v_sub - r.field_label);
          v_removed := v_removed + 1;
          v_labels := v_labels || (r.container || '.' || r.field_label);
        END IF;

      ELSIF jsonb_typeof(v_sub) = 'array' THEN
        SELECT count(*) INTO v_before FROM jsonb_array_elements(v_sub) e;
        SELECT coalesce(jsonb_agg(e), '[]'::jsonb) INTO v_new
        FROM jsonb_array_elements(v_sub) e
        WHERE coalesce(e ->> 'label', e ->> 'name') IS DISTINCT FROM r.field_label;
        SELECT count(*) INTO v_after FROM jsonb_array_elements(v_new) e;
        IF v_after < v_before THEN
          v_raw := jsonb_set(v_raw, ARRAY[r.container], v_new);
          v_removed := v_removed + (v_before - v_after);
          v_labels := v_labels || (r.container || '.' || r.field_label);
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'raw', v_raw,
    'normalized', v_norm,
    'removed', v_removed,
    'labels', to_jsonb(v_labels)
  );
END;
$$;

-- Batch-kørsel med keyset-paginering. Idempotent: allerede rensede salg ændres ikke.
CREATE OR REPLACE FUNCTION public.gdpr_strip_blocked_fields_backfill(
  p_after_id uuid DEFAULT NULL,
  p_batch_size int DEFAULT 5000,
  p_triggered_by text DEFAULT 'manuel'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_res jsonb;
  v_scanned int := 0;
  v_cleaned int := 0;
  v_fields int := 0;
  v_failed int := 0;
  v_last uuid := p_after_id;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT coalesce(public.am_i_superadmin(), false) THEN
    RAISE EXCEPTION 'Ingen adgang';
  END IF;

  FOR v_sale IN
    SELECT id, raw_payload, normalized_data, client_campaign_id
    FROM public.sales
    WHERE p_after_id IS NULL OR id > p_after_id
    ORDER BY id
    LIMIT p_batch_size
  LOOP
    v_scanned := v_scanned + 1;
    v_last := v_sale.id;

    v_res := public.gdpr_strip_blocked_jsonb(v_sale.raw_payload, v_sale.normalized_data);
    IF (v_res ->> 'removed')::int = 0 THEN
      CONTINUE;
    END IF;

    BEGIN
      UPDATE public.sales
      SET raw_payload = CASE WHEN v_res -> 'raw' = 'null'::jsonb THEN NULL ELSE v_res -> 'raw' END,
          normalized_data = CASE WHEN v_res -> 'normalized' = 'null'::jsonb THEN NULL ELSE v_res -> 'normalized' END
      WHERE id = v_sale.id;

      v_cleaned := v_cleaned + 1;
      v_fields := v_fields + (v_res ->> 'removed')::int;

      INSERT INTO public.gdpr_cleanup_log (action, records_affected, triggered_by, details)
      VALUES (
        'strip_blocked_fields_backfill',
        1,
        p_triggered_by,
        jsonb_build_object(
          'sale_id', v_sale.id,
          'client_campaign_id', v_sale.client_campaign_id,
          'fields_removed', (v_res ->> 'removed')::int,
          'fields', v_res -> 'labels'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'sales_cleaned', v_cleaned,
    'fields_removed', v_fields,
    'failed', v_failed,
    'last_id', v_last,
    'done', v_scanned < p_batch_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_strip_blocked_fields_backfill(uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gdpr_strip_blocked_fields_backfill(uuid, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gdpr_strip_blocked_jsonb(jsonb, jsonb) TO service_role;