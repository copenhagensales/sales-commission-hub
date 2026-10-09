CREATE OR REPLACE FUNCTION public.ramp_expected_at(_day_no integer)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $f$
  -- Forventet kumuleret salg efter arbejdsdag _day_no: ugens krav / 5 pr. arbejdsdag,
  -- sidste ugekrav gaelder for senere uger. Spejler src/lib/rampMinTarget.ts (minCumulativeAt).
  WITH t AS (
    SELECT coalesce((SELECT weekly_min_targets FROM public.ramp_settings ORDER BY created_at LIMIT 1),
                    '[5,8,11,14,17]'::jsonb) AS arr
  )
  SELECT CASE WHEN coalesce(_day_no, 0) <= 0 THEN 0::numeric ELSE round(coalesce((
    SELECT sum((t.arr ->> (least(ceil(d / 5.0)::int, jsonb_array_length(t.arr)) - 1))::numeric / 5)
    FROM t, generate_series(1, _day_no) d
  ), 0), 2) END
$f$;
REVOKE ALL ON FUNCTION public.ramp_expected_at(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ramp_expected_at(integer) TO authenticated, service_role;

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
                   OR public.effective_has_app_role('admin') OR public.is_ramp_extra_viewer();
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
           public.ramp_campaign_ids(en.client_campaign_id) AS campaign_ids,
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
           a.campaign_ids,
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
           public.ramp_product_count(w.campaign_ids, w.email,
                                     greatest(w.monday, w.start_date), w.week_end) AS sales,
           greatest(0, coalesce(ce.p25, 0) - coalesce(cp.p25, 0)) AS p25,
           greatest(0, coalesce(ce.p50, 0) - coalesce(cp.p50, 0)) AS p50,
           greatest(0, coalesce(ce.p75, 0) - coalesce(cp.p75, 0)) AS p75,
           public.ramp_expected_at(w.day_end) - public.ramp_expected_at(w.day_prev) AS expected
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
           public.ramp_product_count(a.campaign_ids, a.email, a.start_date, v_today) AS cum_sales,
           c.p25, c.p50, c.p75,
           public.ramp_expected_at(a.day_no) AS expected_today,
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
                      'p75', wm.p75,
                      'expected', wm.expected
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
           'expected_today', d.expected_today,
           'expected_pct', CASE WHEN d.expected_today > 0
                                THEN round(d.cum_sales / d.expected_today * 100, 1) END,
           'expectation_status', CASE
                       WHEN d.expected_today IS NULL OR d.expected_today <= 0 THEN 'ukendt'
                       WHEN d.cum_sales < d.expected_today THEN 'under'
                       ELSE 'on_track'
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
           'week_complete', (d.has_absence OR d.has_coaching OR d.has_listen),
           'weeks', d.weeks,
           'actions', d.actions
         )), '[]'::jsonb)
    INTO v_result
  FROM detail d;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ramp_create_risk_flags()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_created int := 0;
  v_today date := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
BEGIN
  WITH enrolled AS (
    SELECT en.employee_id, en.client_campaign_id, en.curve_version,
           en.start_date,
           lower(coalesce(e.work_email, e.private_email)) AS email
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    WHERE coalesce(e.work_email, e.private_email) IS NOT NULL
      AND e.employment_end_date IS NULL
  ),
  windowed AS (
    SELECT en.*, public.ramp_workday_no(en.start_date, v_today) AS current_day_no
    FROM enrolled en
  ),
  passed AS (
    SELECT w.*, cp.day_no
    FROM windowed w
    CROSS JOIN (VALUES (10), (15)) AS cp(day_no)
    WHERE w.current_day_no >= cp.day_no
      AND w.current_day_no <= 40
  ),
  dated AS (
    SELECT p.*, w.measure_date
    FROM passed p
    CROSS JOIN LATERAL (
      SELECT d::date AS measure_date
      FROM (
        SELECT d, row_number() OVER (ORDER BY d) AS n
        FROM generate_series(p.start_date::timestamp,
                             p.start_date::timestamp + interval '150 days',
                             interval '1 day') d
        WHERE extract(isodow FROM d) < 6
          AND NOT EXISTS (SELECT 1 FROM public.danish_holiday h WHERE h.date = d::date)
      ) s
      WHERE s.n = p.day_no
    ) w
  ),
  measured AS (
    SELECT d.*,
           public.ramp_product_count(public.ramp_campaign_ids(d.client_campaign_id),
                                     d.email, d.start_date, d.measure_date) AS cum_sales,
           public.ramp_expected_at(d.day_no) AS threshold_value
    FROM dated d
  ),
  inserted AS (
    INSERT INTO public.ramp_risk_flag
      (employee_id, client_campaign_id, day_no, cum_sales, threshold_value, curve_version)
    SELECT m.employee_id, m.client_campaign_id, m.day_no, m.cum_sales, m.threshold_value, m.curve_version
    FROM measured m
    WHERE m.threshold_value IS NOT NULL
      AND m.cum_sales < m.threshold_value
      -- Kun kampagner med opstartskurve, som foer (forventningen er nu maalestokken).
      AND EXISTS (SELECT 1 FROM public.ramp_curve c
                   WHERE c.client_campaign_id = m.client_campaign_id
                     AND c.curve_version = m.curve_version
                     AND c.day_no = m.day_no)
    ON CONFLICT (employee_id, day_no) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_created FROM inserted;

  RETURN v_created;
END;
$function$;