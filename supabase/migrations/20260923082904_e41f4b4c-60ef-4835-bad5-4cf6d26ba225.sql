-- Samlet holdoverblik: alle aktive saelgere paa ramp-kampagnerne som IKKE er i dag 1-40.
-- Ingen norm (p25/p50/p75 = null) og ingen risikoflag; kun tal + ugens faste forloeb.
CREATE OR REPLACE FUNCTION public.get_ramp_full_team()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := public.effective_employee_id();
  v_all boolean := public.effective_is_owner()
                   OR public.effective_is_superadmin()
                   OR public.effective_has_app_role('admin');
  v_today date := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
  v_monday date := date_trunc('week', (now() AT TIME ZONE 'Europe/Copenhagen'))::date;
  v_program_start date := (SELECT weekly_program_start_date FROM public.ramp_settings ORDER BY created_at LIMIT 1);
  v_result jsonb;
BEGIN
  IF NOT public.can_view_ramp_team() THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH ramp_campaign AS (
    SELECT cc.id AS campaign_id,
           cc.name AS campaign_name,
           public.ramp_campaign_ids(cc.id) AS campaign_ids
    FROM public.client_campaigns cc
    WHERE cc.ramp_enabled = true
  ),
  ramp_clients AS (
    SELECT DISTINCT cc.client_id
    FROM ramp_campaign rc
    JOIN public.client_campaigns cc ON cc.id = ANY(rc.campaign_ids)
  ),
  -- Saelgere der stadig hoerer til opstartssektionen (dag 1-40) udelades helt.
  in_ramp AS (
    SELECT en.employee_id
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    JOIN public.client_campaigns cc ON cc.id = en.client_campaign_id AND cc.ramp_enabled = true
    WHERE public.ramp_workday_no(en.start_date, v_today) BETWEEN 1 AND 40
  ),
  candidates AS (
    -- Aktive medarbejdere i teams knyttet til ramp-kunderne
    SELECT DISTINCT tm.employee_id
    FROM public.team_clients tc
    JOIN ramp_clients rc ON rc.client_id = tc.client_id
    JOIN public.team_members tm ON tm.team_id = tc.team_id
    UNION
    -- Fallback: aktive med salg paa ramp-kampagnerne de seneste 90 dage uden teamkobling
    SELECT DISTINCT e.id
    FROM public.employee_master_data e
    JOIN public.sales s
      ON s.agent_email = lower(coalesce(e.work_email, e.private_email))
    WHERE s.client_campaign_id IN (SELECT cc.id FROM ramp_campaign rc
                                     JOIN public.client_campaigns cc ON cc.id = ANY(rc.campaign_ids))
      AND s.sale_datetime >= (v_today - 90)::timestamptz
  ),
  team AS (
    SELECT e.id AS employee_id,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           coalesce(e.employment_start_date, v_today - 180) AS start_date,
           e.employment_end_date,
           (SELECT array_agg(DISTINCT cid)
              FROM ramp_campaign rc, unnest(rc.campaign_ids) AS cid) AS campaign_ids,
           (SELECT string_agg(DISTINCT rc.campaign_name, ' · ') FROM ramp_campaign rc) AS campaign_name,
           (SELECT t.name FROM public.team_members tm
              JOIN public.teams t ON t.id = tm.team_id
             WHERE tm.employee_id = e.id
             ORDER BY t.name LIMIT 1) AS team_name
    FROM public.employee_master_data e
    JOIN candidates c ON c.employee_id = e.id
    WHERE coalesce(e.is_active, true) = true
      AND (e.employment_end_date IS NULL OR e.employment_end_date > v_today)
      AND coalesce(e.work_email, e.private_email) IS NOT NULL
      AND e.id IS DISTINCT FROM v_me
      AND NOT EXISTS (SELECT 1 FROM in_ramp ir WHERE ir.employee_id = e.id)
      AND (
        v_all
        OR EXISTS (
          SELECT 1
          FROM public.team_members tm
          JOIN public.teams t ON t.id = tm.team_id
          WHERE tm.employee_id = e.id
            AND (
              t.team_leader_id = v_me
              OR t.assistant_team_leader_id = v_me
              OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                          WHERE al.team_id = t.id AND al.employee_id = v_me)
            )
        )
      )
  ),
  weeks AS (
    SELECT t.employee_id,
           t.campaign_ids,
           t.email,
           w.monday::date AS monday,
           row_number() OVER (PARTITION BY t.employee_id ORDER BY w.monday) AS week_no,
           least(w.monday::date + 6, v_today) AS week_end
    FROM team t
    CROSS JOIN LATERAL generate_series(
      v_monday - interval '35 days',
      v_monday,
      interval '7 days'
    ) w(monday)
  ),
  weeks_metrics AS (
    SELECT w.employee_id,
           w.week_no,
           extract(isoyear FROM w.monday)::int AS iso_year,
           extract(week FROM w.monday)::int AS iso_week,
           public.ramp_product_count(w.campaign_ids, w.email, w.monday, w.week_end) AS sales
    FROM weeks w
  ),
  detail AS (
    SELECT t.*,
           public.ramp_workday_no(t.start_date, v_today) AS day_no,
           public.ramp_product_count(t.campaign_ids, t.email, t.start_date, v_today) AS cum_sales,
           public.ramp_week_workdays(t.start_date, v_monday, t.employment_end_date) AS workdays_this_week,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = t.employee_id
                      AND ac.action_type = '1-1 samtale'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_coaching,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = t.employee_id
                      AND ac.action_type = 'medlyt med feedback'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_listen,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = t.employee_id
                      AND ac.action_type = 'fravær hele ugen'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_absence,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'week_no', wm.week_no,
                      'iso_year', wm.iso_year,
                      'iso_week', wm.iso_week,
                      'sales', wm.sales,
                      'p25', NULL,
                      'p50', NULL,
                      'p75', NULL
                    ) ORDER BY wm.week_no)
             FROM weeks_metrics wm WHERE wm.employee_id = t.employee_id
           ), '[]'::jsonb) AS weeks,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'action_type', ac.action_type,
                      'performed_at', ac.performed_at,
                      'performed_by_name', trim(concat_ws(' ', p.first_name, p.last_name)),
                      'note', ac.note,
                      'recipients', coalesce(ac.recipients, ARRAY[]::text[])
                    ) ORDER BY ac.performed_at DESC)
             FROM public.ramp_flag_action ac
             LEFT JOIN public.employee_master_data p ON p.id = ac.performed_by
             WHERE ac.employee_id = t.employee_id
           ), '[]'::jsonb) AS actions
    FROM team t
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'employee_id', d.employee_id,
           'employee_name', d.employee_name,
           'campaign_name', d.campaign_name,
           'team_name', d.team_name,
           'day_no', d.day_no,
           'days_left', 0,
           'cum_sales', d.cum_sales,
           'p25', NULL,
           'p50', NULL,
           'p75', NULL,
           'status', 'ukendt',
           'flag_id', NULL,
           'flag_created_at', NULL,
           'flag_days_open', NULL,
           'iso_year', extract(isoyear FROM v_monday)::int,
           'iso_week', extract(week FROM v_monday)::int,
           'workdays_this_week', d.workdays_this_week,
           'has_coaching', d.has_coaching,
           'has_listen', d.has_listen,
           'has_absence', d.has_absence,
           'weekly_program_start_date', v_program_start,
           'weekly_program_active', (v_program_start IS NOT NULL AND v_monday >= v_program_start),
           'week_required', (
             d.workdays_this_week >= 2
             AND NOT d.has_absence
             AND v_program_start IS NOT NULL
             AND v_monday >= v_program_start
           ),
           'week_complete', (d.has_absence OR d.has_coaching OR d.has_listen),
           'weeks', d.weeks,
           'actions', d.actions
         ) ORDER BY d.employee_name), '[]'::jsonb)
    INTO v_result
  FROM detail d;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_ramp_full_team() TO authenticated;

-- Modtagere til ugens forloeb: virker nu ogsaa for saelgere uden opstartsforloeb.
CREATE OR REPLACE FUNCTION public.ramp_session_recipients(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := public.effective_employee_id();
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
    SELECT m
      INTO v_member
    FROM jsonb_array_elements(public.get_ramp_full_team()) m
    WHERE (m->>'employee_id')::uuid = p_employee_id
    LIMIT 1;
  END IF;

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