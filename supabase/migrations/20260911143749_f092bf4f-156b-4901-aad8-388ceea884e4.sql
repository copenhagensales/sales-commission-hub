CREATE OR REPLACE FUNCTION public.gdpr_freetext_field_hits(p_payload jsonb)
RETURNS TABLE(container text, field_label text, rule text)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH containers AS (
    SELECT c.name, p_payload -> c.name AS body
    FROM (VALUES ('data'),('masterDataFields'),('leadResultFields'),('masterData'),('leadResultData')) AS c(name)
  ),
  obj AS (
    SELECT c.name AS container, e.key AS field_label, e.value AS val
    FROM containers c
    CROSS JOIN LATERAL jsonb_each(c.body) e
    WHERE jsonb_typeof(c.body) = 'object'
  ),
  arr AS (
    SELECT c.name AS container, e.value ->> 'label' AS field_label, e.value -> 'value' AS val
    FROM containers c
    CROSS JOIN LATERAL jsonb_array_elements(c.body) e
    WHERE jsonb_typeof(c.body) = 'array' AND jsonb_typeof(e.value) = 'object' AND e.value ? 'label'
  ),
  root AS (
    SELECT 'raw_payload'::text AS container, e.key AS field_label, e.value AS val
    FROM jsonb_each(p_payload) e
    WHERE jsonb_typeof(p_payload) = 'object'
  ),
  all_fields AS (
    SELECT * FROM obj UNION ALL SELECT * FROM arr UNION ALL SELECT * FROM root
  )
  SELECT a.container, a.field_label,
         CASE WHEN btrim(lower(a.field_label)) ~ 'notat|note|noter|bemaerk|bemærk|kommentar|comment|fastgjorte' THEN 'A' ELSE 'B' END
  FROM all_fields a
  WHERE a.field_label IS NOT NULL
    AND (
      btrim(lower(a.field_label)) ~ 'notat|note|noter|bemaerk|bemærk|kommentar|comment|fastgjorte'
      OR (
        jsonb_typeof(a.val) = 'string'
        AND (
          (a.val #>> '{}') ~ E'[\\n\\r]'
          OR (length(a.val #>> '{}') > 120
              AND length(a.val #>> '{}') - length(replace(a.val #>> '{}', ' ', '')) >= 3)
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ingestion_known_fields k
      WHERE k.decision = 'BEHOLD'
        AND btrim(lower(k.field_label)) = btrim(lower(a.field_label))
    );
$$;

CREATE OR REPLACE FUNCTION public.gdpr_strip_freetext_sales(p_dry_run boolean DEFAULT true, p_days integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales integer := 0;
  v_fields jsonb;
  v_campaigns jsonb;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Kun ejere må køre GDPR-fritekstoprydning';
  END IF;

  CREATE TEMP TABLE tmp_freetext_hits ON COMMIT DROP AS
  SELECT s.id, s.source, s.client_campaign_id, h.container, h.field_label, h.rule
  FROM public.sales s
  CROSS JOIN LATERAL public.gdpr_freetext_field_hits(s.raw_payload) h
  WHERE s.raw_payload IS NOT NULL
    AND (p_days IS NULL OR s.created_at > now() - make_interval(days => p_days));

  SELECT count(DISTINCT id) INTO v_sales FROM tmp_freetext_hits;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'antal')::int DESC), '[]'::jsonb) INTO v_fields
  FROM (
    SELECT jsonb_build_object('felt', field_label, 'beholder', container, 'regel', rule,
                              'antal', count(*), 'salg', count(DISTINCT id)) AS x
    FROM tmp_freetext_hits GROUP BY field_label, container, rule
  ) t;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'salg')::int DESC), '[]'::jsonb) INTO v_campaigns
  FROM (
    SELECT jsonb_build_object('kampagne', coalesce(cc.name, 'ukendt'), 'kilde', h.source,
                              'salg', count(DISTINCT h.id)) AS x
    FROM tmp_freetext_hits h
    LEFT JOIN public.client_campaigns cc ON cc.id = h.client_campaign_id
    GROUP BY cc.name, h.source
  ) t;

  IF p_dry_run THEN
    RETURN jsonb_build_object('dry_run', true, 'salg', v_sales, 'felter', v_fields, 'kampagner', v_campaigns);
  END IF;

  RAISE EXCEPTION 'Oprydning af eksisterende salg er ikke godkendt endnu (Kasper godkender tallene først)';
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_strip_freetext_sales(boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gdpr_strip_freetext_sales(boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_freetext_field_hits(jsonb) TO authenticated;