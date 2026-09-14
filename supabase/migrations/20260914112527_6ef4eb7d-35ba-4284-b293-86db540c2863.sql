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
  p_started_at timestamptz
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
  v_required_codes int;
  v_leader uuid;
  v_assistant uuid;
  v_team_name text;
BEGIN
  IF NOT (public.is_quality_controller() OR public.am_i_superadmin()) THEN
    RAISE EXCEPTION 'Ingen adgang til at gemme kvalitetskontroller';
  END IF;

  v_reviewer := public.get_current_employee_id();
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Kontrollanten kunne ikke findes i stamdata';
  END IF;

  -- Tilstandene valideres, og punkttypen hentes fra tjeklisten (ikke fra klienten)
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

  IF v_result = 'afvist' THEN
    SELECT count(*) INTO v_required_codes
    FROM public.quality_error_codes ec
    WHERE ec.id = ANY(COALESCE(p_error_code_ids, ARRAY[]::uuid[]))
      AND ec.item_type = 'obligatorisk';
    IF v_required_codes = 0 THEN
      RAISE EXCEPTION 'Afvist kontrol kraever mindst en obligatorisk fejlkode';
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

REVOKE ALL ON FUNCTION public.save_quality_review(uuid, timestamptz, date, uuid, uuid, text, uuid, text, text, uuid, integer, jsonb, uuid[], text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_quality_review(uuid, timestamptz, date, uuid, uuid, text, uuid, text, text, uuid, integer, jsonb, uuid[], text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_quality_review(uuid, timestamptz, date, uuid, uuid, text, uuid, text, text, uuid, integer, jsonb, uuid[], text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_quality_review(uuid, timestamptz, date, uuid, uuid, text, uuid, text, text, uuid, integer, jsonb, uuid[], text, timestamptz) TO service_role;