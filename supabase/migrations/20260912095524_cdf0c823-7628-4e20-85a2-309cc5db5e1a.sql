CREATE OR REPLACE FUNCTION public.get_ramp_team_overview()
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

  WITH enrolled AS (
    SELECT en.employee_id,
           en.client_campaign_id,
           en.start_date,
           en.curve_version,
           e.employment_end_date,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           public.ramp_workday_no(en.start_date, v_today) AS day_no
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    JOIN public.client_campaigns cc ON cc.id = en.client_campaign_id AND cc.ramp_enabled = true
    WHERE coalesce(e.is_active, true) = true
      AND (e.employment_end_date IS NULL OR e.employment_end_date > v_today)
      AND en.employee_id IS DISTINCT FROM v_me
      AND (
        v_all
        OR EXISTS (
          SELECT 1
          FROM public.team_members tm
          JOIN public.teams t ON t.id = tm.team_id
          WHERE tm.employee_id = en.employee_id
            AND (
              t.team_leader_id = v_me
              OR t.assistant_team_leader_id = v_me
              OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                          WHERE al.team_id = t.id AND al.employee_id = v_me)
            )
        )
      )
  ),
  active AS (
    SELECT * FROM enrolled WHERE day_no BETWEEN 1 AND 40
  ),
  weeks_raw AS (
    SELECT a.employee_id,
           a.client_campaign_id,
           a.curve_version,
           a.start_date,
           a.email,
           w.monday::date AS monday,
           row_number() OVER (PARTITION BY a.employee_id ORDER BY w.monday) AS week_no,
           row_number() OVER (PARTITION BY a.employee_id ORDER BY w.monday DESC) AS week_rev
    FROM active a
    CROSS JOIN LATERAL generate_series(
      date_trunc('week', a.start_date::timestamp),
      date_trunc('week', v_today::timestamp),
      interval '7 days'
    ) w(monday)
  ),
  weeks AS (
    SELECT wr.*,
           least(wr.monday + 6, v_today) AS week_end,
           least(public.ramp_workday_no(wr.start_date, least(wr.monday + 6, v_today)), 40) AS day_end,
           CASE WHEN wr.monday <= wr.start_date THEN 0
                ELSE least(public.ramp_workday_no(wr.start_date, wr.monday - 1), 40) END AS day_prev
    FROM weeks_raw wr
    WHERE wr.week_rev <= 6
  ),
  weeks_metrics AS (
    SELECT w.employee_id,
           w.week_no,
           extract(isoyear FROM w.monday)::int AS iso_year,
           extract(week FROM w.monday)::int AS iso_week,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = w.client_campaign_id
                AND sa.agent_email = w.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date
                    BETWEEN greatest(w.monday, w.start_date) AND w.week_end
           )::int AS sales,
           greatest(0, coalesce(ce.p25, 0) - coalesce(cp.p25, 0)) AS p25,
           greatest(0, coalesce(ce.p50, 0) - coalesce(cp.p50, 0)) AS p50,
           greatest(0, coalesce(ce.p75, 0) - coalesce(cp.p75, 0)) AS p75
    FROM weeks w
    LEFT JOIN public.ramp_curve ce
      ON ce.client_campaign_id = w.client_campaign_id
     AND ce.curve_version = w.curve_version
     AND ce.day_no = w.day_end
    LEFT JOIN public.ramp_curve cp
      ON cp.client_campaign_id = w.client_campaign_id
     AND cp.curve_version = w.curve_version
     AND cp.day_no = w.day_prev
  ),
  detail AS (
    SELECT a.employee_id,
           a.employee_name,
           a.day_no,
           greatest(0, 40 - a.day_no) AS days_left,
           cc.name AS campaign_name,
           (SELECT t.name FROM public.team_members tm
              JOIN public.teams t ON t.id = tm.team_id
             WHERE tm.employee_id = a.employee_id
             ORDER BY t.name LIMIT 1) AS team_name,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = a.client_campaign_id
                AND sa.agent_email = a.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= a.start_date
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date <= v_today
           )::int AS cum_sales,
           c.p25, c.p50, c.p75,
           f.id AS flag_id,
           f.created_at AS flag_created_at,
           CASE WHEN f.id IS NULL THEN NULL
                ELSE greatest(0, (date_part('epoch', now() - f.created_at) / 86400)::int)
           END AS flag_days_open,
           public.ramp_week_workdays(a.start_date, v_monday, a.employment_end_date) AS workdays_this_week,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = a.employee_id
                      AND ac.action_type = '1-1 samtale'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_coaching,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = a.employee_id
                      AND ac.action_type = 'medlyt med feedback'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_listen,
           EXISTS (SELECT 1 FROM public.ramp_flag_action ac
                    WHERE ac.employee_id = a.employee_id
                      AND ac.action_type = 'fravær hele ugen'
                      AND (ac.performed_at AT TIME ZONE 'Europe/Copenhagen')::date
                          BETWEEN v_monday AND v_monday + 6) AS has_absence,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'week_no', wm.week_no,
                      'iso_year', wm.iso_year,
                      'iso_week', wm.iso_week,
                      'sales', wm.sales,
                      'p25', wm.p25,
                      'p50', wm.p50,
                      'p75', wm.p75
                    ) ORDER BY wm.week_no)
             FROM weeks_metrics wm WHERE wm.employee_id = a.employee_id
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
             WHERE ac.employee_id = a.employee_id
           ), '[]'::jsonb) AS actions
    FROM active a
    LEFT JOIN public.client_campaigns cc ON cc.id = a.client_campaign_id
    LEFT JOIN public.ramp_curve c
      ON c.client_campaign_id = a.client_campaign_id
     AND c.curve_version = a.curve_version
     AND c.day_no = a.day_no
    LEFT JOIN LATERAL (
      SELECT rf.id, rf.created_at
      FROM public.ramp_risk_flag rf
      WHERE rf.employee_id = a.employee_id AND rf.status = 'open'
      ORDER BY rf.created_at ASC
      LIMIT 1
    ) f ON true
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'employee_id', d.employee_id,
           'employee_name', d.employee_name,
           'campaign_name', d.campaign_name,
           'team_name', d.team_name,
           'day_no', d.day_no,
           'days_left', d.days_left,
           'cum_sales', d.cum_sales,
           'p25', d.p25,
           'p50', d.p50,
           'p75', d.p75,
           'status', CASE
                       WHEN d.p25 IS NULL THEN 'ukendt'
                       WHEN d.cum_sales > d.p75 THEN 'over'
                       WHEN d.cum_sales < d.p25 THEN 'under'
                       ELSE 'midt'
                     END,
           'flag_id', d.flag_id,
           'flag_created_at', d.flag_created_at,
           'flag_days_open', d.flag_days_open,
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
           'week_complete', (d.has_absence OR (d.has_coaching AND d.has_listen)),
           'weeks', d.weeks,
           'actions', d.actions
         )), '[]'::jsonb)
    INTO v_result
  FROM detail d;

  RETURN v_result;
END;
$function$;

ALTER TABLE public.ramp_flag_action
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS recipients text[];

CREATE OR REPLACE FUNCTION public.ramp_session_recipients(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_me uuid := public.effective_employee_id();
  v_today date := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
  v_ok boolean := false;
  v_seller jsonb;
  v_leaders jsonb;
BEGIN
  IF NOT public.can_view_ramp_team() THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_ramp_team_overview()) m
    WHERE (m->>'employee_id')::uuid = p_employee_id
  ) INTO v_ok;

  IF NOT v_ok THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'employee_id', e.id,
           'name', trim(concat_ws(' ', e.first_name, e.last_name)),
           'email', lower(coalesce(e.work_email, e.private_email)),
           'campaign_name', (SELECT cc.name FROM public.employee_ramp_enrollment en
                              JOIN public.client_campaigns cc ON cc.id = en.client_campaign_id
                             WHERE en.employee_id = e.id LIMIT 1),
           'day_no', (SELECT public.ramp_workday_no(en.start_date, v_today)
                        FROM public.employee_ramp_enrollment en
                       WHERE en.employee_id = e.id LIMIT 1)
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
    'leaders', v_leaders
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.ramp_session_recipients(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.ramp_session_recipients(uuid) TO authenticated, service_role;