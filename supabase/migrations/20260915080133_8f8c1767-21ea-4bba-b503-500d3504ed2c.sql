-- 1. Kvitteringstabel
CREATE TABLE public.quality_feedback_acknowledgements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.quality_reviews(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('saelger', 'teamleder', 'assisterende_teamleder')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, employee_id)
);

CREATE INDEX idx_qfa_employee ON public.quality_feedback_acknowledgements(employee_id);
CREATE INDEX idx_qfa_review ON public.quality_feedback_acknowledgements(review_id);

GRANT SELECT, INSERT ON public.quality_feedback_acknowledgements TO authenticated;
GRANT ALL ON public.quality_feedback_acknowledgements TO service_role;

ALTER TABLE public.quality_feedback_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY qfa_insert_own ON public.quality_feedback_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY qfa_read ON public.quality_feedback_acknowledgements
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_current_employee_id()
    OR public.quality_can_view_all()
    OR EXISTS (
      SELECT 1 FROM public.quality_reviews r
      WHERE r.id = quality_feedback_acknowledgements.review_id
        AND r.team_id IS NOT NULL
        AND r.team_id IN (SELECT public.quality_my_leader_team_ids())
    )
  );

-- Uforanderlig historik
CREATE TRIGGER quality_feedback_ack_immutable
  BEFORE UPDATE OR DELETE ON public.quality_feedback_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION public.quality_block_mutation();

-- 2. Sælgeren skal kunne læse sine egne kontroller
CREATE POLICY quality_reviews_read_own ON public.quality_reviews
  FOR SELECT TO authenticated
  USING (employee_id IS NOT NULL AND employee_id = public.get_current_employee_id());

-- 3. Live-opdatering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quality_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quality_reviews;
  END IF;
END $$;

-- 4. Ukvitterede tilbagemeldinger for den aktuelle bruger
CREATE OR REPLACE FUNCTION public.get_my_quality_feedback()
RETURNS TABLE (
  review_id uuid,
  role text,
  result text,
  sale_id uuid,
  employee_id uuid,
  seller_name text,
  team_id uuid,
  team_name text,
  campaign_name text,
  occurred_at timestamptz,
  search_key text,
  reason_labels text[],
  comment text,
  completed_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := public.get_current_employee_id();
  IF v_me IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mine AS (
    SELECT r.*, 'saelger'::text AS my_role
    FROM public.quality_reviews r
    WHERE r.employee_id = v_me
    UNION ALL
    SELECT r.*,
           CASE WHEN r.team_leader_id = v_me THEN 'teamleder' ELSE 'assisterende_teamleder' END
    FROM public.quality_reviews r
    WHERE r.employee_id IS DISTINCT FROM v_me
      AND r.team_id IS NOT NULL
      AND r.team_id IN (SELECT public.quality_my_leader_team_ids(auth.uid()))
  )
  SELECT
    m.id,
    m.my_role,
    m.result,
    m.sale_id,
    m.employee_id,
    m.seller_name,
    m.team_id,
    m.team_name,
    cc.name,
    COALESCE(call_ref.start_time, m.sale_datetime),
    m.search_key,
    reasons.labels,
    m.comment,
    m.completed_at
  FROM mine m
  LEFT JOIN public.client_campaigns cc ON cc.id = m.client_campaign_id
  LEFT JOIN public.sales s ON s.id = m.sale_id
  LEFT JOIN LATERAL (
    SELECT c.start_time
    FROM public.dialer_calls c
    WHERE c.lead_external_id = COALESCE(NULLIF(s.normalized_data->>'lead_id', ''), NULLIF(s.raw_payload->>'leadId', ''))
      AND c.start_time IS NOT NULL
      AND c.start_time <= m.sale_datetime
      AND c.start_time >= m.sale_datetime - interval '6 hours'
    ORDER BY c.start_time DESC
    LIMIT 1
  ) call_ref ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_remove(array_agg(DISTINCT l), NULL) AS labels
    FROM (
      SELECT ec.label AS l
      FROM public.quality_review_error_codes rec
      JOIN public.quality_error_codes ec ON ec.id = rec.error_code_id
      WHERE rec.review_id = m.id
      UNION
      SELECT ci.label
      FROM public.quality_review_items ri
      JOIN public.quality_checklist_items ci ON ci.id = ri.checklist_item_id
      WHERE ri.review_id = m.id AND ri.state = 'mangler'
    ) q
  ) reasons ON TRUE
  WHERE m.result IN ('afvist', 'godkendt_med_bemaerkning')
    AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = m.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.quality_feedback_acknowledgements a
      WHERE a.review_id = m.id AND a.employee_id = v_me
    )
  ORDER BY 10 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_quality_feedback() TO authenticated;

-- 5. Kvittering
CREATE OR REPLACE FUNCTION public.acknowledge_quality_feedback(p_review_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_ok boolean;
BEGIN
  v_me := public.get_current_employee_id();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Medarbejderen kunne ikke findes i stamdata';
  END IF;

  IF p_role NOT IN ('saelger', 'teamleder', 'assisterende_teamleder') THEN
    RAISE EXCEPTION 'Ugyldig rolle';
  END IF;

  SELECT
    CASE
      WHEN p_role = 'saelger' THEN r.employee_id = v_me
      ELSE r.team_id IS NOT NULL
           AND r.team_id IN (SELECT public.quality_my_leader_team_ids(auth.uid()))
    END
  INTO v_ok
  FROM public.quality_reviews r
  WHERE r.id = p_review_id;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Ingen adgang til at kvittere for denne tilbagemelding';
  END IF;

  INSERT INTO public.quality_feedback_acknowledgements (review_id, employee_id, role)
  VALUES (p_review_id, v_me, p_role)
  ON CONFLICT (review_id, employee_id) DO NOTHING;

  RETURN jsonb_build_object('acknowledged', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_quality_feedback(uuid, text) TO authenticated;

-- 6. Permanent historik til profilen
CREATE OR REPLACE FUNCTION public.get_quality_feedback_history(p_employee_id uuid DEFAULT NULL)
RETURNS TABLE (
  review_id uuid,
  result text,
  campaign_name text,
  occurred_at timestamptz,
  search_key text,
  reason_labels text[],
  comment text,
  completed_at timestamptz,
  acknowledged_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_target uuid;
  v_team uuid;
BEGIN
  v_me := public.get_current_employee_id();
  v_target := COALESCE(p_employee_id, v_me);
  IF v_target IS NULL THEN
    RETURN;
  END IF;

  IF v_target <> COALESCE(v_me, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT public.quality_can_view_all() THEN
    SELECT tm.team_id INTO v_team
    FROM public.team_members tm
    WHERE tm.employee_id = v_target
    ORDER BY tm.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_team IS NULL OR v_team NOT IN (SELECT public.quality_my_leader_team_ids(auth.uid())) THEN
      RAISE EXCEPTION 'Ingen adgang til denne medarbejders kvalitetshistorik';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.result,
    cc.name,
    COALESCE(call_ref.start_time, r.sale_datetime),
    r.search_key,
    reasons.labels,
    r.comment,
    r.completed_at,
    ack.created_at
  FROM public.quality_reviews r
  LEFT JOIN public.client_campaigns cc ON cc.id = r.client_campaign_id
  LEFT JOIN public.sales s ON s.id = r.sale_id
  LEFT JOIN LATERAL (
    SELECT c.start_time
    FROM public.dialer_calls c
    WHERE c.lead_external_id = COALESCE(NULLIF(s.normalized_data->>'lead_id', ''), NULLIF(s.raw_payload->>'leadId', ''))
      AND c.start_time IS NOT NULL
      AND c.start_time <= r.sale_datetime
      AND c.start_time >= r.sale_datetime - interval '6 hours'
    ORDER BY c.start_time DESC
    LIMIT 1
  ) call_ref ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_remove(array_agg(DISTINCT l), NULL) AS labels
    FROM (
      SELECT ec.label AS l
      FROM public.quality_review_error_codes rec
      JOIN public.quality_error_codes ec ON ec.id = rec.error_code_id
      WHERE rec.review_id = r.id
      UNION
      SELECT ci.label
      FROM public.quality_review_items ri
      JOIN public.quality_checklist_items ci ON ci.id = ri.checklist_item_id
      WHERE ri.review_id = r.id AND ri.state = 'mangler'
    ) q
  ) reasons ON TRUE
  LEFT JOIN public.quality_feedback_acknowledgements ack
    ON ack.review_id = r.id AND ack.employee_id = r.employee_id AND ack.role = 'saelger'
  WHERE r.employee_id = v_target
    AND r.result IN ('afvist', 'godkendt_med_bemaerkning')
    AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  ORDER BY 4 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quality_feedback_history(uuid) TO authenticated;

-- 7. To tydelige handlinger for kontrollanten: feedback eller afvis
DROP FUNCTION IF EXISTS public.save_quality_review(uuid, timestamptz, date, uuid, uuid, text, uuid, text, text, uuid, integer, jsonb, uuid[], text, timestamptz);

CREATE OR REPLACE FUNCTION public.save_quality_review(
  p_sale_id uuid,
  p_sale_datetime timestamptz,
  p_sale_date date,
  p_client_campaign_id uuid,
  p_employee_id uuid,
  p_seller_name text,
  p_team_id uuid,
  p_team_name text,
  p_search_key text,
  p_checklist_id uuid,
  p_checklist_version integer,
  p_items jsonb,
  p_error_code_ids uuid[],
  p_comment text,
  p_started_at timestamptz,
  p_intent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer uuid;
  v_result text;
  v_missing_required int;
  v_missing_quality int;
  v_review_id uuid;
  v_any_codes int;
  v_leader uuid;
  v_assistant uuid;
  v_team_name text;
BEGIN
  IF NOT (public.is_quality_controller() OR public.am_i_superadmin()) THEN
    RAISE EXCEPTION 'Ingen adgang til at gemme kvalitetskontroller';
  END IF;

  IF p_intent IS NOT NULL AND p_intent NOT IN ('feedback', 'afvist') THEN
    RAISE EXCEPTION 'Ugyldig handling';
  END IF;

  v_reviewer := public.get_current_employee_id();
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Kontrollanten kunne ikke findes i stamdata';
  END IF;

  CREATE TEMP TABLE _qr_items ON COMMIT DROP AS
  SELECT
    (i->>'checklist_item_id')::uuid AS checklist_item_id,
    i->>'state' AS state,
    ci.item_type
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) i
  JOIN public.quality_checklist_items ci
    ON ci.id = (i->>'checklist_item_id')::uuid
   AND ci.checklist_id = p_checklist_id;

  IF EXISTS (SELECT 1 FROM _qr_items WHERE state NOT IN ('ok', 'mangler', 'ikke_relevant')) THEN
    RAISE EXCEPTION 'Ugyldig tilstand paa et tjeklistepunkt';
  END IF;

  SELECT
    count(*) FILTER (WHERE item_type = 'obligatorisk' AND state = 'mangler'),
    count(*) FILTER (WHERE item_type = 'kvalitet' AND state = 'mangler')
  INTO v_missing_required, v_missing_quality
  FROM _qr_items;

  v_result := CASE
    WHEN v_missing_required > 0 THEN 'afvist'
    WHEN v_missing_quality > 0 THEN 'godkendt_med_bemaerkning'
    ELSE 'godkendt'
  END;

  -- Kontrollantens eksplicitte handling vejer tungest
  IF p_intent = 'afvist' THEN
    v_result := 'afvist';
  ELSIF p_intent = 'feedback' AND v_result = 'godkendt' THEN
    v_result := 'godkendt_med_bemaerkning';
  END IF;

  IF v_result = 'afvist' THEN
    SELECT count(*) INTO v_any_codes
    FROM public.quality_error_codes ec
    WHERE ec.id = ANY(COALESCE(p_error_code_ids, ARRAY[]::uuid[]));
    IF v_any_codes = 0 THEN
      RAISE EXCEPTION 'Afvist kontrol kraever mindst en fejlkode';
    END IF;
  END IF;

  SELECT t.team_leader_id, t.assistant_team_leader_id, t.name
  INTO v_leader, v_assistant, v_team_name
  FROM public.teams t
  WHERE t.id = p_team_id;

  INSERT INTO public.quality_reviews (
    sale_id, sale_datetime, sale_date, client_campaign_id,
    employee_id, seller_name, team_id, team_name,
    team_leader_id, assistant_team_leader_id, reviewer_employee_id,
    checklist_id, checklist_version, result, comment, search_key, started_at
  ) VALUES (
    p_sale_id, p_sale_datetime, p_sale_date, p_client_campaign_id,
    p_employee_id, p_seller_name, p_team_id, COALESCE(p_team_name, v_team_name),
    v_leader, v_assistant, v_reviewer,
    p_checklist_id, p_checklist_version, v_result,
    NULLIF(left(btrim(COALESCE(p_comment, '')), 500), ''), p_search_key, p_started_at
  )
  RETURNING id INTO v_review_id;

  INSERT INTO public.quality_review_items (review_id, checklist_item_id, item_type, state)
  SELECT v_review_id, checklist_item_id, item_type, state FROM _qr_items;

  INSERT INTO public.quality_review_error_codes (review_id, error_code_id)
  SELECT v_review_id, ec.id
  FROM public.quality_error_codes ec
  WHERE ec.id = ANY(COALESCE(p_error_code_ids, ARRAY[]::uuid[]));

  RETURN jsonb_build_object('review_id', v_review_id, 'result', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_quality_review(uuid, timestamptz, date, uuid, uuid, text, uuid, text, text, uuid, integer, jsonb, uuid[], text, timestamptz, text) TO authenticated;