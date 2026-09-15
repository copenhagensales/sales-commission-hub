CREATE OR REPLACE FUNCTION public.get_my_quality_feedback()
 RETURNS TABLE(review_id uuid, role text, result text, sale_id uuid, employee_id uuid, seller_name text, team_id uuid, team_name text, campaign_name text, occurred_at timestamp with time zone, search_key text, reason_labels text[], comment text, completed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid;
  v_auth uuid;
BEGIN
  -- Respekterer "Se som" (læseadgang): viser den viste medarbejders sager.
  v_me := public.effective_employee_id();
  v_auth := public.effective_auth_user_id();
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
      AND r.team_id IN (SELECT public.quality_my_leader_team_ids(v_auth))
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
    -- Vis kun den årsag kontrollanten faktisk valgte. Manglende tjeklistepunkter
    -- er en teknisk konsekvens af samme handling og bruges kun som reserve,
    -- så gamle sager uden fejlkode fortsat viser en årsag.
    SELECT COALESCE(codes.labels, items.labels) AS labels
    FROM (
      SELECT array_remove(array_agg(DISTINCT ec.label), NULL) AS labels
      FROM public.quality_review_error_codes rec
      JOIN public.quality_error_codes ec ON ec.id = rec.error_code_id
      WHERE rec.review_id = m.id
    ) codes
    LEFT JOIN (
      SELECT array_remove(array_agg(DISTINCT ci.label), NULL) AS labels
      FROM public.quality_review_items ri
      JOIN public.quality_checklist_items ci ON ci.id = ri.checklist_item_id
      WHERE ri.review_id = m.id AND ri.state = 'mangler'
    ) items ON TRUE
  ) reasons ON TRUE
  WHERE m.result IN ('afvist', 'godkendt_med_bemaerkning')
    AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = m.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.quality_feedback_acknowledgements a
      WHERE a.review_id = m.id AND a.employee_id = v_me
    )
  ORDER BY 10 DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_quality_feedback_history(p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(review_id uuid, result text, campaign_name text, occurred_at timestamp with time zone, search_key text, reason_labels text[], comment text, completed_at timestamp with time zone, acknowledged_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid;
  v_auth uuid;
  v_target uuid;
  v_team uuid;
BEGIN
  -- Respekterer "Se som" (læseadgang).
  v_me := public.effective_employee_id();
  v_auth := public.effective_auth_user_id();
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

    IF v_team IS NULL OR v_team NOT IN (SELECT public.quality_my_leader_team_ids(v_auth)) THEN
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
    SELECT COALESCE(codes.labels, items.labels) AS labels
    FROM (
      SELECT array_remove(array_agg(DISTINCT ec.label), NULL) AS labels
      FROM public.quality_review_error_codes rec
      JOIN public.quality_error_codes ec ON ec.id = rec.error_code_id
      WHERE rec.review_id = r.id
    ) codes
    LEFT JOIN (
      SELECT array_remove(array_agg(DISTINCT ci.label), NULL) AS labels
      FROM public.quality_review_items ri
      JOIN public.quality_checklist_items ci ON ci.id = ri.checklist_item_id
      WHERE ri.review_id = r.id AND ri.state = 'mangler'
    ) items ON TRUE
  ) reasons ON TRUE
  LEFT JOIN public.quality_feedback_acknowledgements ack
    ON ack.review_id = r.id AND ack.employee_id = r.employee_id AND ack.role = 'saelger'
  WHERE r.employee_id = v_target
    AND r.result IN ('afvist', 'godkendt_med_bemaerkning')
    AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  ORDER BY 4 DESC;
END;
$function$;