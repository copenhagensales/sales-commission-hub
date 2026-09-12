CREATE OR REPLACE FUNCTION public.ramp_session_recipients(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := public.effective_employee_id();
  v_today date := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
  v_member jsonb;
  v_seller jsonb;
  v_leaders jsonb;
BEGIN
  IF NOT public.can_view_ramp_team() THEN
    RETURN NULL;
  END IF;

  SELECT m
    INTO v_member
  FROM jsonb_array_elements(public.get_ramp_team_overview()) m
  WHERE (m->>'employee_id')::uuid = p_employee_id
  LIMIT 1;

  IF v_member IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'employee_id', e.id,
           'name', trim(concat_ws(' ', e.first_name, e.last_name)),
           'email', lower(coalesce(e.work_email, e.private_email)),
           'campaign_name', v_member->>'campaign_name',
           'day_no', (v_member->>'day_no')::int
         )
    INTO v_seller
  FROM public.employee_master_data e
  WHERE e.id = p_employee_id;

  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
           'employee_id', l.id,
           'name', trim(concat_ws(' ', l.first_name, l.last_name)),
           'email', lower(coalesce(l.work_email, l.private_email))
         )), '[]'::jsonb)
    INTO v_leaders
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  CROSS JOIN LATERAL (
    SELECT t.team_leader_id AS lid
    UNION SELECT t.assistant_team_leader_id
    UNION SELECT al.employee_id FROM public.team_assistant_leaders al WHERE al.team_id = t.id
  ) ids
  JOIN public.employee_master_data l ON l.id = ids.lid
  WHERE tm.employee_id = p_employee_id
    AND coalesce(l.is_active, true) = true
    AND l.id IS DISTINCT FROM p_employee_id
    AND coalesce(l.work_email, l.private_email) IS NOT NULL;

  RETURN jsonb_build_object(
    'performed_by', v_me,
    'performed_by_name', (SELECT trim(concat_ws(' ', first_name, last_name))
                            FROM public.employee_master_data WHERE id = v_me),
    'seller', v_seller,
    'leaders', v_leaders,
    'iso_week', (v_member->>'iso_week')::int,
    'weeks', coalesce(v_member->'weeks', '[]'::jsonb),
    'band_low', (v_member->>'p25')::numeric,
    'band_median', (v_member->>'p50')::numeric,
    'band_high', (v_member->>'p75')::numeric
  );
END;
$function$;